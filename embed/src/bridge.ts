import { INTERNAL_PROTOCOL } from './internal-protocol'
import { type BridgeLogger, makeSafeLogger, NOOP_LOGGER } from './logger'
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

export type AttachEmbedArgs = {
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
  // up (createEmbed's create path uses it to remove the iframe it created).
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

export const attachEmbed = ({
  getIframe,
  editorOrigin,
  logger: providedLogger = NOOP_LOGGER,
  onDispose,
}: AttachEmbedArgs): Embed => {
  const logger = makeSafeLogger(providedLogger)
  const pending = new Map<string, PendingRequest>()
  let state: BridgeState = { kind: 'booting' }
  let documentId: string | null = null
  let disposed = false

  // Per-event channels. Each owns its listener Set + subscribe/emit/clear, and a
  // throwing listener can't stop the others or break cleanup. The mapped type
  // keeps `on` and the emit call sites exact per event without any cast.
  type Channel<T> = {
    subscribe: (listener: (payload: T) => void) => () => void
    emit: (payload: T) => void
    clear: () => void
  }
  const reportListenerError = (error: unknown): void =>
    logger.error('iframe.listener_threw', { message: error instanceof Error ? error.message : String(error) })
  const makeChannel = <T>(): Channel<T> => {
    const listeners = new Set<(payload: T) => void>()
    return {
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      emit: (payload) => {
        for (const listener of listeners) {
          try {
            listener(payload)
          } catch (error) {
            reportListenerError(error)
          }
        }
      },
      clear: () => listeners.clear(),
    }
  }
  const channels: { [E in BridgeEventName]: Channel<BridgeEventMap[E]> } = {
    state_change: makeChannel(),
    submission_sent: makeChannel(),
    page_focused: makeChannel(),
    disposed: makeChannel(),
  }
  const on = <E extends BridgeEventName>(event: E, listener: (payload: BridgeEventMap[E]) => void): (() => void) =>
    channels[event].subscribe(listener)

  const transitionTo = (next: BridgeState): void => {
    state = next
    channels.state_change.emit(state)
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
        logger.debug('iframe.request_posted', { request_id: requestId, type: wireType, char_count: outbound.length })
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

  let readyTimeout: ReturnType<typeof setTimeout> | null = null
  const clearReadyTimeout = (): void => {
    if (readyTimeout !== null) {
      clearTimeout(readyTimeout)
      readyTimeout = null
    }
  }

  const markDocumentLoaded = (): void => {
    if (state.kind === 'document_loaded') {
      return
    }
    clearReadyTimeout()
    stopProbing()
    transitionTo({ kind: 'document_loaded', documentId })
  }

  const sendProbe = (): void => {
    const iframe = getIframe()
    if (iframe === null || iframe.contentWindow === null) {
      return
    }
    const probeId = generateRequestId()
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ type: 'GET_FIELDS', request_id: probeId, data: {} }),
        editorOrigin,
      )
      // Track only successfully-posted probes (a failed post leaves no id to match).
      probeRequestIds.add(probeId)
    } catch {
      // Best-effort liveness probe; a transient post failure just retries next tick.
    }
  }

  // Hard readiness fallback. It only WARNS if we are still booting (the editor
  // never confirmed readiness), and it stops the 500ms probe loop: by this point
  // either a document loaded (probing already stopped) or none has, in which case
  // we rely on the DOCUMENT_LOADED event rather than probing — and accumulating
  // probe ids — indefinitely.
  readyTimeout = setTimeout(() => {
    readyTimeout = null
    if (state.kind === 'booting') {
      logger.warn('editor.ready_fallback_timeout', { timeout_ms: EDITOR_READY_HARD_FALLBACK_MS })
    }
    markEditorReady('fallback')
    stopProbing()
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
        channels.submission_sent.emit(submission)
      }
      return
    }

    if (payload.type === PAGE_FOCUSED_EVENT) {
      const pageFocused = asPageFocused(payload.data)
      if (pageFocused !== null) {
        channels.page_focused.emit(pageFocused)
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
      // Not a tracked request: a late/stale reply, or a probe reply received after
      // the probe loop was torn down. Not an error.
      logger.debug('iframe.request_unmatched', { request_id: requestId })
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
    clearReadyTimeout()
    stopProbing()
    for (const { timeoutId, resolve } of pending.values()) {
      clearTimeout(timeoutId)
      resolve({
        success: false,
        error: { code: 'unexpected:bridge_disposed', message: 'Editor bridge was disposed' },
      })
    }
    pending.clear()
    channels.disposed.emit(undefined)
    for (const channel of Object.values(channels)) {
      channel.clear()
    }
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
