import { type BridgeLogger, NOOP_LOGGER } from './logger'
import {
  type BridgeRequestType,
  type BridgeResult,
  type BridgeState,
  type CreateFieldArgs,
  type DocumentContentResult,
  type FieldRecord,
  type IframeBridge,
  isBridgeResultLike,
  type LoadDocumentArgs,
  type RemoveFieldsArgs,
} from './types'

type PendingRequest = {
  resolve: (result: BridgeResult<unknown>) => void
  requestType: BridgeRequestType
  startedAtMs: number
  timeoutId: ReturnType<typeof setTimeout>
}

const DEFAULT_REQUEST_TIMEOUT_MS = 6_000
const HEAVY_REQUEST_TIMEOUT_MS = 30_000
const EDITOR_READY_PROBE_INTERVAL_MS = 500
const EDITOR_READY_HARD_FALLBACK_MS = 30_000

// Only DETECT_FIELDS and GET_DOCUMENT_CONTENT do real work on the editor side
// (OCR, whole-document scan) that can legitimately exceed a few seconds. Every
// other request is either a postMessage round-trip or a targeted DOM op and
// should resolve well inside 6s. A request that overshoots is a symptom, not a
// cold path to tolerate.
const getRequestTimeoutMs = (requestType: BridgeRequestType): number => {
  switch (requestType) {
    case 'DETECT_FIELDS':
    case 'GET_DOCUMENT_CONTENT':
      return HEAVY_REQUEST_TIMEOUT_MS
    case 'CREATE_FIELD':
    case 'FOCUS_FIELD':
    case 'GET_FIELDS':
    case 'GO_TO':
    case 'LOAD_DOCUMENT':
    case 'REMOVE_FIELDS':
    case 'SELECT_TOOL':
    case 'SET_FIELD_VALUE':
    case 'SUBMIT':
      return DEFAULT_REQUEST_TIMEOUT_MS
    default:
      requestType satisfies never
      return DEFAULT_REQUEST_TIMEOUT_MS
  }
}

const generateRequestId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `req_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}

export type CreateBridgeArgs = {
  // Getter returning the iframe element. Called each time the bridge needs
  // to reach the editor (postMessage send, probe, identity check on incoming
  // messages). Framework-agnostic: React callers pass `() => ref.current`;
  // vanilla JS callers pass `() => document.getElementById('my-iframe')`;
  // Vue callers pass `() => myRef.value`.
  getIframe: () => HTMLIFrameElement | null
  // Origin the iframe is served from. The bridge verifies every incoming
  // message against this value and sends postMessage with it as the target
  // origin.
  editorOrigin: string
  // Optional: receive state-machine transitions. Subscribe/unsubscribe via
  // the returned `subscribe` function is the alternative pull-based API.
  onStateChange?: (state: BridgeState) => void
  // Optional structured logger. Defaults to no-op.
  logger?: BridgeLogger
}

export type EmbedBridge = {
  bridge: IframeBridge
  subscribe: (listener: (state: BridgeState) => void) => () => void
  dispose: () => void
}

export const createBridge = ({
  getIframe,
  editorOrigin,
  onStateChange,
  logger = NOOP_LOGGER,
}: CreateBridgeArgs): EmbedBridge => {
  const pending = new Map<string, PendingRequest>()
  const listeners = new Set<(state: BridgeState) => void>()
  let state: BridgeState = { kind: 'booting' }
  let documentId: string | null = null

  if (onStateChange !== undefined) {
    listeners.add(onStateChange)
  }

  const notify = (): void => {
    for (const listener of listeners) {
      listener(state)
    }
  }

  const transitionTo = (next: BridgeState): void => {
    state = next
    notify()
  }

  const sendRequest = <TData>(
    type: BridgeRequestType,
    data: Record<string, unknown>,
  ): Promise<BridgeResult<TData>> =>
    new Promise((resolve) => {
      const iframe = getIframe()
      if (iframe === null || iframe.contentWindow === null) {
        resolve({
          success: false,
          error: { code: 'iframe_not_ready', message: 'Iframe is not mounted' },
        })
        return
      }

      const requestId = generateRequestId()
      const timeoutMs = getRequestTimeoutMs(type)
      const startedAtMs = Date.now()
      logger.info('iframe.request_sent', { request_id: requestId, type, timeout_ms: timeoutMs })
      const timeoutId = setTimeout(() => {
        pending.delete(requestId)
        logger.warn('iframe.request_timed_out', {
          request_id: requestId,
          type,
          elapsed_ms: Date.now() - startedAtMs,
        })
        resolve({
          success: false,
          error: {
            code: 'timeout',
            message: `Iframe request '${type}' timed out after ${timeoutMs}ms`,
          },
        })
      }, timeoutMs)

      pending.set(requestId, {
        // The stored resolver is typed `BridgeResult<unknown>`; the outer
        // promise is `BridgeResult<TData>`. The cast is the generic boundary
        // between the bridge (which cannot know per-tool payload shapes) and
        // the caller (who declared TData). Runtime validation belongs in the
        // client-tools layer via Zod, not here.
        resolve: (result) => resolve(result as BridgeResult<TData>),
        requestType: type,
        startedAtMs,
        timeoutId,
      })

      const outbound = { type, request_id: requestId, data }
      logger.debug('iframe.raw_sent', { payload: outbound })
      iframe.contentWindow.postMessage(JSON.stringify(outbound), editorOrigin)
    })

  const probeRequestIds = new Set<string>()
  let probeInterval: ReturnType<typeof setInterval> | null = null

  const stopProbing = (): void => {
    if (probeInterval !== null) {
      clearInterval(probeInterval)
      probeInterval = null
    }
    probeRequestIds.clear()
  }

  type EditorReadySource = 'editor_ready_event' | 'probe_response' | 'fallback_timeout'
  type DocumentLoadedSource = 'document_loaded_event' | 'probe_success'

  const logEditorReady = (source: EditorReadySource): void => {
    switch (source) {
      case 'editor_ready_event':
        logger.info('editor.ready_via_event', {})
        return
      case 'probe_response':
        logger.info('editor.ready_via_probe', {})
        return
      case 'fallback_timeout':
        logger.warn('editor.ready_fallback_timeout', { timeout_ms: EDITOR_READY_HARD_FALLBACK_MS })
        return
      default:
        source satisfies never
    }
  }

  const markEditorReady = (source: EditorReadySource): void => {
    if (source === 'editor_ready_event' && state.kind === 'document_loaded') {
      // Fresh EDITOR_READY after a document was loaded means the iframe is
      // re-mounting for a new document cycle. Drop back to editor_ready and
      // wait for the new DOCUMENT_LOADED signal.
      logEditorReady(source)
      transitionTo({ kind: 'editor_ready' })
      return
    }
    if (state.kind !== 'booting') {
      return
    }
    logEditorReady(source)
    transitionTo({ kind: 'editor_ready' })
  }

  const markDocumentLoaded = (source: DocumentLoadedSource): void => {
    if (state.kind === 'document_loaded') {
      return
    }
    switch (source) {
      case 'probe_success':
        logger.info('document.loaded_via_probe', {})
        break
      case 'document_loaded_event':
        logger.info('document.loaded_via_event', {})
        break
      default:
        source satisfies never
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
    iframe.contentWindow.postMessage(
      JSON.stringify({ type: 'GET_FIELDS', request_id: probeId, data: {} }),
      editorOrigin,
    )
  }

  // Fallback only for editor readiness, never for document-loaded. A
  // document-loaded fallback would wrongly flip consumers to "ready" on the
  // custom-PDF path where the user hasn't picked a file yet.
  const readyTimeout = setTimeout(() => {
    markEditorReady('fallback_timeout')
  }, EDITOR_READY_HARD_FALLBACK_MS)

  // Active probing: fire a GET_FIELDS request every 500ms until the editor
  // confirms a document is loaded (success: true) or the hard fallback fires.
  // A success: false with code 'bad_request:no_document_loaded' still counts
  // as an editor-ready signal (the postMessage bridge is alive), so we flip
  // state on the first response but keep probing for doc-loaded.
  sendProbe()
  probeInterval = setInterval(sendProbe, EDITOR_READY_PROBE_INTERVAL_MS)

  const onMessage = (event: MessageEvent<string>): void => {
    if (event.origin !== editorOrigin) {
      if (event.origin !== '' && typeof event.data === 'string' && event.data.length < 200) {
        logger.debug('iframe.ignored_cross_origin_message', {
          origin: event.origin,
          expected: editorOrigin,
        })
      }
      return
    }
    const iframe = getIframe()
    // Iframe torn down (ref cleared between dispatch and receive, or a
    // spurious message delivered after dispose): don't transition state on
    // a dead iframe, don't resolve requests it will never look up.
    if (iframe === null) {
      return
    }
    if (event.source !== iframe.contentWindow) {
      return
    }

    const payload = ((): {
      type: string
      data?: Record<string, unknown>
      request_id?: string
    } | null => {
      try {
        return JSON.parse(event.data)
      } catch {
        return null
      }
    })()

    if (payload === null) {
      return
    }

    logger.debug('iframe.raw_received', { payload })

    if (payload.type === 'EDITOR_READY') {
      markEditorReady('editor_ready_event')
      return
    }

    if (payload.type === 'DOCUMENT_LOADED') {
      const rawDocId = payload.data?.document_id
      if (typeof rawDocId === 'string' && rawDocId !== '' && documentId !== rawDocId) {
        documentId = rawDocId
        // A late-arriving DOCUMENT_LOADED (after the probe already flipped
        // the state to document_loaded) must still propagate the fresh
        // documentId to consumers.
        if (state.kind === 'document_loaded') {
          transitionTo({ kind: 'document_loaded', documentId })
          return
        }
      }
      markDocumentLoaded('document_loaded_event')
      return
    }

    if (payload.type !== 'REQUEST_RESULT') {
      return
    }

    const requestId = typeof payload.data?.request_id === 'string' ? payload.data.request_id : null
    if (requestId === null) {
      return
    }
    if (probeRequestIds.has(requestId)) {
      // The iframe answered a readiness probe. Any response means the
      // postMessage bridge is alive → editor ready. A success: true payload
      // additionally means a document is loaded (the editor rejects GET_FIELDS
      // with bad_request:no_document_loaded otherwise), so we can flip the
      // state without waiting for a DOCUMENT_LOADED event — some PDFs never
      // emit it (e.g. docs with no AcroFields).
      probeRequestIds.delete(requestId)
      markEditorReady('probe_response')
      const probeResult = payload.data?.result
      if (isBridgeResultLike(probeResult) && probeResult.success === true) {
        markDocumentLoaded('probe_success')
      }
      return
    }
    const entry = pending.get(requestId)
    if (entry === undefined) {
      logger.warn('iframe.request_missing_pending', { request_id: requestId })
      return
    }
    pending.delete(requestId)
    clearTimeout(entry.timeoutId)
    const rawResult = payload.data?.result
    const result: BridgeResult<unknown> = ((): BridgeResult<unknown> => {
      if (!isBridgeResultLike(rawResult)) {
        return {
          success: false,
          error: { code: 'missing_result', message: 'REQUEST_RESULT payload had no result' },
        }
      }
      // Editor-side void ops emit `{ success: true }` without `data`. Normalize
      // to `{ success: true, data: null }` so middleware and consumers don't
      // have to handle the missing-field shape.
      if (rawResult.success === true && !('data' in rawResult)) {
        return { success: true, data: null }
      }
      return rawResult
    })()
    logger.info('iframe.request_received', {
      request_id: requestId,
      type: entry.requestType,
      elapsed_ms: Date.now() - entry.startedAtMs,
      success: result.success,
    })
    entry.resolve(result)
  }

  window.addEventListener('message', onMessage)

  const bridge: IframeBridge = {
    getState: () => state,
    loadDocument: ({ dataUrl, name, initialPage }: LoadDocumentArgs) =>
      sendRequest('LOAD_DOCUMENT', { data_url: dataUrl, name, page: initialPage }),
    goTo: ({ page }) => sendRequest('GO_TO', { page }),
    selectTool: ({ tool }) => sendRequest('SELECT_TOOL', { tool }),
    detectFields: (args) => sendRequest('DETECT_FIELDS', { debug_mode: args?.debugMode === true }),
    removeFields: (args?: RemoveFieldsArgs) =>
      sendRequest('REMOVE_FIELDS', {
        field_ids: args?.fieldIds ?? null,
        page: args?.page ?? null,
      }),
    getDocumentContent: ({ extractionMode }) =>
      sendRequest<DocumentContentResult>('GET_DOCUMENT_CONTENT', { extraction_mode: extractionMode }),
    getFields: () => sendRequest<{ fields: FieldRecord[] }>('GET_FIELDS', {}),
    setFieldValue: ({ fieldId, value }) => sendRequest('SET_FIELD_VALUE', { field_id: fieldId, value }),
    focusField: ({ fieldId }) => sendRequest('FOCUS_FIELD', { field_id: fieldId }),
    createField: ({ type, x, y, width, height, page, value }: CreateFieldArgs) =>
      sendRequest<{ field_id: string }>('CREATE_FIELD', {
        type,
        x,
        y,
        width,
        height,
        page,
        value: value ?? null,
      }),
    submit: ({ downloadCopy }) => sendRequest('SUBMIT', { download_copy: downloadCopy }),
  }

  const subscribe = (listener: (nextState: BridgeState) => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const dispose = (): void => {
    window.removeEventListener('message', onMessage)
    clearTimeout(readyTimeout)
    stopProbing()
    for (const { timeoutId, resolve } of pending.values()) {
      clearTimeout(timeoutId)
      resolve({
        success: false,
        error: { code: 'bridge_disposed', message: 'Iframe bridge was disposed' },
      })
    }
    pending.clear()
    listeners.clear()
  }

  return { bridge, subscribe, dispose }
}
