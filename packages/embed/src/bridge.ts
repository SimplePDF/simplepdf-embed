import { INTERNAL_PROTOCOL } from './internal-protocol'
import { type BridgeLogger, NOOP_LOGGER } from './logger'
import { isBridgeResultLike } from './result'
import type { OutboundEventType, WireType } from './generated/contract'
import type {
  BridgeEventMap,
  BridgeEventName,
  BridgeResult,
  BridgeState,
  Embed,
  IframeBridge,
  PageFocusedPayload,
  SubmissionSentPayload,
} from './types'

export type CreateBridgeArgs = {
  // Getter returning the iframe element. Called each time the bridge needs to
  // reach the editor (postMessage send, probe, identity check on incoming
  // messages). Framework-agnostic: React callers pass `() => ref.current`,
  // vanilla callers pass `() => document.getElementById('my-iframe')`.
  getIframe: () => HTMLIFrameElement | null
  // Origin the iframe is served from. Every incoming message is verified against
  // this value, and it is the postMessage target origin.
  editorOrigin: string
  logger?: BridgeLogger
  // Optional teardown hook invoked once on dispose() after the bridge has cleaned
  // up (mountEmbed uses it to remove the iframe it created).
  onDispose?: () => void
}

// One uniform request/response timeout. The editor is proven alive (EDITOR_READY
// + the readiness probe), so this is purely a dead-iframe safety net — deliberately
// generous so a request posted behind a slow FIFO op (auto-detection / OCR) is not
// starved by a per-op budget that starts at enqueue, not at dispatch. Dependent
// calls should be awaited rather than fired concurrently.
const REQUEST_TIMEOUT_MS = 60_000
const EDITOR_READY_PROBE_INTERVAL_MS = 500
const EDITOR_READY_HARD_FALLBACK_MS = 30_000

// Compile-time drift guards: the outbound-event literals the bridge matches must
// remain members of the generated vocabulary, or `tsc` fails (an editor rename
// would otherwise silently stop the bridge emitting that event). Type-only, so
// no generated value (the OPERATIONS table) is pulled into the zero-dep root.
const SUBMISSION_SENT_EVENT: Extract<OutboundEventType, 'SUBMISSION_SENT'> = 'SUBMISSION_SENT'
const PAGE_FOCUSED_EVENT: Extract<OutboundEventType, 'PAGE_FOCUSED'> = 'PAGE_FOCUSED'

const generateRequestId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `req_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}

// The single deliberate trust boundary. The editor is contracted to reply with
// `data` matching the operation's output_schema; that shape cannot be re-derived
// at runtime (the zero-dep root carries no validator), so this generic relabels
// the validated envelope. Errors are TData-independent and pass through untouched.
const relabelResult = <TData>(result: BridgeResult<unknown>): BridgeResult<TData> => {
  if (result.success) {
    return { success: true, data: result.data as TData }
  }
  return result
}

type PendingRequest = {
  resolve: (result: BridgeResult<unknown>) => void
  wireType: WireType
  startedAtMs: number
  timeoutId: ReturnType<typeof setTimeout>
}

const asSubmissionSent = (data: Record<string, unknown> | undefined): SubmissionSentPayload | null => {
  const documentId = data?.document_id
  const submissionId = data?.submission_id
  if (typeof documentId === 'string' && typeof submissionId === 'string') {
    return { document_id: documentId, submission_id: submissionId }
  }
  return null
}

const asPageFocused = (data: Record<string, unknown> | undefined): PageFocusedPayload | null => {
  const previousPage = data?.previous_page
  const currentPage = data?.current_page
  const totalPages = data?.total_pages
  const previousIsValid = previousPage === null || typeof previousPage === 'number'
  if (previousIsValid && typeof currentPage === 'number' && typeof totalPages === 'number') {
    return { previous_page: previousPage, current_page: currentPage, total_pages: totalPages }
  }
  return null
}

export const createBridge = ({ getIframe, editorOrigin, logger = NOOP_LOGGER, onDispose }: CreateBridgeArgs): Embed => {
  const pending = new Map<string, PendingRequest>()
  let state: BridgeState = { kind: 'booting' }
  let documentId: string | null = null
  let disposed = false

  // Typed event emitter. The mapped-type annotations make `on`/`emit` exact per
  // event without any cast.
  type Listener<E extends BridgeEventName> = (payload: BridgeEventMap[E]) => void
  const subscribers = {
    state_change: new Set<Listener<'state_change'>>(),
    submission_sent: new Set<Listener<'submission_sent'>>(),
    page_focused: new Set<Listener<'page_focused'>>(),
    disposed: new Set<Listener<'disposed'>>(),
  }
  const register: { [E in BridgeEventName]: (listener: Listener<E>) => () => void } = {
    state_change: (listener) => {
      subscribers.state_change.add(listener)
      return () => subscribers.state_change.delete(listener)
    },
    submission_sent: (listener) => {
      subscribers.submission_sent.add(listener)
      return () => subscribers.submission_sent.delete(listener)
    },
    page_focused: (listener) => {
      subscribers.page_focused.add(listener)
      return () => subscribers.page_focused.delete(listener)
    },
    disposed: (listener) => {
      subscribers.disposed.add(listener)
      return () => subscribers.disposed.delete(listener)
    },
  }
  // One listener throwing must not stop the others or break cleanup.
  const notifyListeners = <TPayload>(listeners: Set<(payload: TPayload) => void>, payload: TPayload): void => {
    for (const listener of listeners) {
      try {
        listener(payload)
      } catch (error) {
        logger.error('iframe.listener_threw', { message: error instanceof Error ? error.message : String(error) })
      }
    }
  }
  const emit: { [E in BridgeEventName]: (payload: BridgeEventMap[E]) => void } = {
    state_change: (payload) => notifyListeners(subscribers.state_change, payload),
    submission_sent: (payload) => notifyListeners(subscribers.submission_sent, payload),
    page_focused: (payload) => notifyListeners(subscribers.page_focused, payload),
    disposed: (payload) => notifyListeners(subscribers.disposed, payload),
  }
  const on = <E extends BridgeEventName>(event: E, listener: Listener<E>): (() => void) => register[event](listener)

  const transitionTo = (next: BridgeState): void => {
    state = next
    emit.state_change(state)
  }

  const sendRequest = <TData>(wireType: WireType, data: unknown): Promise<BridgeResult<TData>> =>
    new Promise<BridgeResult<TData>>((resolve) => {
      if (disposed) {
        resolve({
          success: false,
          error: { code: 'unexpected:bridge_disposed', message: 'Editor bridge was disposed' },
        })
        return
      }
      const iframe = getIframe()
      if (iframe === null || iframe.contentWindow === null) {
        resolve({
          success: false,
          error: { code: 'unexpected:iframe_not_mounted', message: 'Editor iframe is not mounted' },
        })
        return
      }

      const requestId = generateRequestId()
      const startedAtMs = Date.now()
      // Log identifiers + timing only — never the payload body (it can carry the
      // document data URL, field values, signatures, or other PII).
      logger.info('iframe.request_sent', { request_id: requestId, type: wireType, timeout_ms: REQUEST_TIMEOUT_MS })
      const timeoutId = setTimeout(() => {
        pending.delete(requestId)
        logger.error('iframe.request_timed_out', {
          request_id: requestId,
          type: wireType,
          elapsed_ms: Date.now() - startedAtMs,
        })
        resolve({
          success: false,
          error: { code: 'unexpected:timeout', message: `Editor request '${wireType}' timed out after ${REQUEST_TIMEOUT_MS}ms` },
        })
      }, REQUEST_TIMEOUT_MS)

      pending.set(requestId, {
        resolve: (result) => resolve(relabelResult<TData>(result)),
        wireType,
        startedAtMs,
        timeoutId,
      })

      // Serializing (circular / BigInt input) or posting (dead contentWindow) can
      // throw; convert that into a Result rather than rejecting the promise.
      try {
        const outbound = JSON.stringify({ type: wireType, request_id: requestId, data })
        iframe.contentWindow.postMessage(outbound, editorOrigin)
        logger.debug('iframe.request_posted', { request_id: requestId, type: wireType, byte_count: outbound.length })
      } catch (error) {
        clearTimeout(timeoutId)
        pending.delete(requestId)
        resolve({
          success: false,
          error: {
            code: 'unexpected:unknown',
            message: `Failed to post '${wireType}': ${error instanceof Error ? error.message : String(error)}`,
          },
        })
      }
    })

  // --- Editor-readiness probing ---------------------------------------------
  // Fire a GET_FIELDS every 500ms until the editor confirms a document is loaded
  // (success: true) or the hard fallback fires. A success: false with
  // bad_request:no_document_loaded still proves the postMessage bridge is alive,
  // so we flip to editor_ready on the first response and keep probing for loaded.
  const probeRequestIds = new Set<string>()
  let probeInterval: ReturnType<typeof setInterval> | null = null

  const stopProbing = (): void => {
    if (probeInterval !== null) {
      clearInterval(probeInterval)
      probeInterval = null
    }
    probeRequestIds.clear()
  }

  // `editor_ready_event` = a real EDITOR_READY message (iframe re-mounting for a
  // fresh document cycle). `probe`/`fallback` only prove liveness and must NEVER
  // drop a loaded document back to editor_ready.
  type EditorReadySource = 'editor_ready_event' | 'probe' | 'fallback'
  const markEditorReady = (source: EditorReadySource): void => {
    switch (state.kind) {
      case 'document_loaded':
        if (source === 'editor_ready_event') {
          transitionTo({ kind: 'editor_ready' })
        }
        return
      case 'booting':
        transitionTo({ kind: 'editor_ready' })
        return
      case 'editor_ready':
        return
      default:
        state satisfies never
    }
  }

  const markDocumentLoaded = (): void => {
    if (state.kind === 'document_loaded') {
      return
    }
    stopProbing()
    transitionTo({ kind: 'document_loaded', documentId })
  }

  const sendProbe = (): void => {
    const iframe = getIframe()
    if (iframe === null || iframe.contentWindow === null) {
      return
    }
    const probeId = generateRequestId()
    probeRequestIds.add(probeId)
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ type: 'GET_FIELDS', request_id: probeId, data: {} }),
        editorOrigin,
      )
    } catch {
      // Best-effort liveness probe; a transient post failure just retries next tick.
    }
  }

  // Fallback only for editor readiness, never for document-loaded: a doc-loaded
  // fallback would wrongly flip consumers to "ready" on the custom-PDF path where
  // the user has not picked a file yet.
  const readyTimeout = setTimeout(() => {
    logger.warn('editor.ready_fallback_timeout', { timeout_ms: EDITOR_READY_HARD_FALLBACK_MS })
    markEditorReady('fallback')
  }, EDITOR_READY_HARD_FALLBACK_MS)

  sendProbe()
  probeInterval = setInterval(sendProbe, EDITOR_READY_PROBE_INTERVAL_MS)

  const onMessage = (event: MessageEvent<string>): void => {
    if (event.origin !== editorOrigin) {
      return
    }
    const iframe = getIframe()
    // Iframe torn down (ref cleared between dispatch and receive, or a message
    // delivered after dispose): don't transition or resolve on a dead iframe.
    if (iframe === null || event.source !== iframe.contentWindow) {
      return
    }

    const payload = ((): { type?: string; data?: Record<string, unknown>; request_id?: string } | null => {
      if (typeof event.data !== 'string') {
        return null
      }
      try {
        const parsed: unknown = JSON.parse(event.data)
        return typeof parsed === 'object' && parsed !== null ? parsed : null
      } catch {
        return null
      }
    })()

    if (payload === null) {
      return
    }
    // Log the message type + correlation id only — never the body (PII).
    logger.debug('iframe.message_received', { type: payload.type, request_id: payload.request_id })

    if (payload.type === INTERNAL_PROTOCOL.EDITOR_READY) {
      markEditorReady('editor_ready_event')
      return
    }

    if (payload.type === INTERNAL_PROTOCOL.DOCUMENT_LOADED) {
      const rawDocId = payload.data?.document_id
      if (typeof rawDocId === 'string' && rawDocId !== '' && documentId !== rawDocId) {
        documentId = rawDocId
        if (state.kind === 'document_loaded') {
          // Late DOCUMENT_LOADED after the probe already flipped the state: still
          // propagate the fresh documentId to consumers.
          transitionTo({ kind: 'document_loaded', documentId })
          return
        }
      }
      markDocumentLoaded()
      return
    }

    if (payload.type === SUBMISSION_SENT_EVENT) {
      const submission = asSubmissionSent(payload.data)
      if (submission !== null) {
        emit.submission_sent(submission)
      }
      return
    }

    if (payload.type === PAGE_FOCUSED_EVENT) {
      const pageFocused = asPageFocused(payload.data)
      if (pageFocused !== null) {
        emit.page_focused(pageFocused)
      }
      return
    }

    if (payload.type !== INTERNAL_PROTOCOL.REQUEST_RESULT) {
      return
    }

    const requestId = typeof payload.data?.request_id === 'string' ? payload.data.request_id : null
    if (requestId === null) {
      return
    }
    if (probeRequestIds.has(requestId)) {
      probeRequestIds.delete(requestId)
      markEditorReady('probe')
      const probeResult = payload.data?.result
      if (isBridgeResultLike(probeResult) && probeResult.success === true) {
        markDocumentLoaded()
      }
      return
    }
    const entry = pending.get(requestId)
    if (entry === undefined) {
      logger.error('iframe.request_missing_pending', { request_id: requestId })
      return
    }
    pending.delete(requestId)
    clearTimeout(entry.timeoutId)
    const rawResult = payload.data?.result
    const result: BridgeResult<unknown> = ((): BridgeResult<unknown> => {
      if (!isBridgeResultLike(rawResult)) {
        return {
          success: false,
          error: { code: 'unexpected:malformed_result', message: 'REQUEST_RESULT payload had no valid result' },
        }
      }
      // Editor void ops emit `{ success: true }` without `data`. Normalize to
      // `{ success: true, data: null }` so consumers never see the missing field.
      if (rawResult.success === true && !('data' in rawResult)) {
        return { success: true, data: null }
      }
      return rawResult
    })()
    logger.info('iframe.request_received', {
      request_id: requestId,
      type: entry.wireType,
      elapsed_ms: Date.now() - entry.startedAtMs,
      success: result.success,
    })
    entry.resolve(result)
  }

  window.addEventListener('message', onMessage)

  // The bridge is a thin interface, not a policy engine: the editor owns FIFO
  // ordering, input validation, and typed errors, and always replies. Each method
  // posts the request and correlates the reply; no client-side validation.
  const methods = {
    createField: (input) => sendRequest('CREATE_FIELD', input),
    deleteFields: (input) => sendRequest('DELETE_FIELDS', input),
    deletePages: (input) => sendRequest('DELETE_PAGES', input),
    detectFields: () => sendRequest('DETECT_FIELDS', {}),
    download: () => sendRequest('DOWNLOAD', {}),
    focusField: (input) => sendRequest('FOCUS_FIELD', input),
    getDocumentContent: (input) => sendRequest('GET_DOCUMENT_CONTENT', input ?? {}),
    getFields: () => sendRequest('GET_FIELDS', {}),
    goTo: (input) => sendRequest('GO_TO', input),
    loadDocument: (input) => sendRequest('LOAD_DOCUMENT', input),
    movePage: (input) => sendRequest('MOVE_PAGE', input),
    rotatePage: (input) => sendRequest('ROTATE_PAGE', input),
    selectTool: (input) => sendRequest('SELECT_TOOL', input),
    setFieldValue: (input) => sendRequest('SET_FIELD_VALUE', input),
    submit: (input) => sendRequest('SUBMIT', input),
    getState: () => state,
  } satisfies IframeBridge

  const dispose = (): void => {
    if (disposed) {
      return
    }
    disposed = true
    window.removeEventListener('message', onMessage)
    clearTimeout(readyTimeout)
    stopProbing()
    for (const { timeoutId, resolve } of pending.values()) {
      clearTimeout(timeoutId)
      resolve({
        success: false,
        error: { code: 'unexpected:bridge_disposed', message: 'Editor bridge was disposed' },
      })
    }
    pending.clear()
    emit.disposed(undefined)
    subscribers.state_change.clear()
    subscribers.submission_sent.clear()
    subscribers.page_focused.clear()
    subscribers.disposed.clear()
    onDispose?.()
  }

  const embed: Embed = {
    ...methods,
    on,
    dispose,
    get state() {
      return state
    },
    get iframe() {
      return getIframe()
    },
  }
  return embed
}
