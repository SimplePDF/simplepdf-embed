import { type RefObject, useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

export type BridgeResult<TData = null> =
  | { success: true; data: TData }
  | { success: false; error: { code: string; message: string } }

type SupportedFieldType = 'TEXT' | 'BOXED_TEXT' | 'CHECKBOX' | 'PICTURE' | 'SIGNATURE'

export type FieldRecord = {
  field_id: string
  name: string | null
  type: SupportedFieldType
  page: number
  value: string | null
}

export type DocumentContentPage = {
  page: number
  content: string
}

export type DocumentContentResult = {
  name: string
  pages: DocumentContentPage[]
}

export type LoadDocumentArgs = {
  dataUrl: string
  name?: string
  initialPage?: number
}

export type CreateFieldArgs = {
  type: SupportedFieldType
  x: number
  y: number
  width: number
  height: number
  page: number
  value?: string | null
}

export type RemoveFieldsArgs = {
  fieldIds?: string[] | null
  page?: number | null
}

type PendingRequest = {
  resolve: (result: BridgeResult<unknown>) => void
  timeoutId: ReturnType<typeof setTimeout>
}

const REQUEST_TIMEOUT_MS = 30_000
const EDITOR_READY_PROBE_INTERVAL_MS = 500
const EDITOR_READY_HARD_FALLBACK_MS = 30_000

const generateRequestId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `req_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}

// State machine. Transitions are strictly forward (booting -> editor_ready ->
// document_loaded) except for `editor_ready` -> `editor_ready` on EDITOR_READY
// re-emission (fresh iframe, no doc yet). Impossible states like
// `{ editorReady: false, documentLoaded: true }` are unrepresentable.
export type BridgeState =
  | { kind: 'booting' }
  | { kind: 'editor_ready' }
  | { kind: 'document_loaded'; documentId: string | null }

export type IframeBridge = {
  getState: () => BridgeState
  loadDocument: (args: LoadDocumentArgs) => Promise<BridgeResult>
  goTo: (args: { page: number }) => Promise<BridgeResult>
  selectTool: (args: { tool: SupportedFieldType | null }) => Promise<BridgeResult>
  detectFields: (args?: { debugMode?: boolean }) => Promise<BridgeResult<{ detected_count: number }>>
  removeFields: (args?: RemoveFieldsArgs) => Promise<BridgeResult<{ removed_count: number }>>
  getDocumentContent: (args: {
    extractionMode: 'auto' | 'ocr'
  }) => Promise<BridgeResult<DocumentContentResult>>
  getFields: () => Promise<BridgeResult<{ fields: FieldRecord[] }>>
  setFieldValue: (args: { fieldId: string; value: string | null }) => Promise<BridgeResult>
  focusField: (args: {
    fieldId: string
  }) => Promise<BridgeResult<{ hint: { type: 'user_action_expected'; message: string } } | null>>
  createField: (args: CreateFieldArgs) => Promise<BridgeResult<{ field_id: string }>>
  submit: (args: { downloadCopy: boolean }) => Promise<BridgeResult>
}

type CreateBridgeArgs = {
  iframeRef: RefObject<HTMLIFrameElement | null>
  editorOrigin: string
  onStateChange: () => void
}

const createBridge = ({
  iframeRef,
  editorOrigin,
  onStateChange,
}: CreateBridgeArgs): { bridge: IframeBridge; dispose: () => void } => {
  const pending = new Map<string, PendingRequest>()
  let state: BridgeState = { kind: 'booting' }
  let documentId: string | null = null

  const transitionTo = (next: BridgeState): void => {
    state = next
    onStateChange()
  }

  const sendRequest = <TData>(type: string, data: Record<string, unknown>): Promise<BridgeResult<TData>> => {
    return new Promise((resolve) => {
      const iframe = iframeRef.current
      if (!iframe || !iframe.contentWindow) {
        resolve({ success: false, error: { code: 'iframe_not_ready', message: 'Iframe is not mounted' } })
        return
      }

      const requestId = generateRequestId()
      const timeoutId = setTimeout(() => {
        pending.delete(requestId)
        resolve({
          success: false,
          error: {
            code: 'timeout',
            message: `Iframe request '${type}' timed out after ${REQUEST_TIMEOUT_MS}ms`,
          },
        })
      }, REQUEST_TIMEOUT_MS)

      pending.set(requestId, {
        resolve: (result) => resolve(result as BridgeResult<TData>),
        timeoutId,
      })

      iframe.contentWindow.postMessage(JSON.stringify({ type, request_id: requestId, data }), editorOrigin)
    })
  }

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
        console.info('[copilot] EDITOR_READY received')
        return
      case 'probe_response':
        console.info('[copilot] editor ready via GET_FIELDS probe response')
        return
      case 'fallback_timeout':
        console.warn(`[copilot] editor readiness hard-fallback after ${EDITOR_READY_HARD_FALLBACK_MS}ms`)
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
        console.info('[copilot] document loaded inferred from GET_FIELDS probe success')
        break
      case 'document_loaded_event':
        console.info('[copilot] DOCUMENT_LOADED received')
        break
      default:
        source satisfies never
    }
    stopProbing()
    transitionTo({ kind: 'document_loaded', documentId })
  }

  const sendProbe = (): void => {
    const iframe = iframeRef.current
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
  // document-loaded fallback would wrongly flip the chat UI to "ready" on the
  // custom-PDF path where the user hasn't picked a file yet.
  const readyTimeout = setTimeout(() => {
    markEditorReady('fallback_timeout')
  }, EDITOR_READY_HARD_FALLBACK_MS)

  // Active probing: fire a GET_FIELDS request every 500ms until the editor
  // confirms a document is loaded (success: true) or the hard fallback fires.
  // A success: false with code 'bad_request:no_document_loaded' still counts
  // as an editor-ready signal (the postMessage bridge is alive), so we flip
  // isEditorReady on the first response but keep probing for doc-loaded.
  // This handles PDFs that don't emit DOCUMENT_LOADED (e.g. documents with
  // no AcroFields) without waiting the full 30s fallback.
  sendProbe()
  probeInterval = setInterval(sendProbe, EDITOR_READY_PROBE_INTERVAL_MS)

  const onMessage = (event: MessageEvent<string>) => {
    if (event.origin !== editorOrigin) {
      if (event.origin !== '' && typeof event.data === 'string' && event.data.length < 200) {
        console.debug('[copilot] ignored message from', event.origin, '(expected', editorOrigin + ')')
      }
      return
    }
    if (event.source !== iframeRef.current?.contentWindow) {
      return
    }

    const payload = ((): { type: string; data?: Record<string, unknown>; request_id?: string } | null => {
      try {
        return JSON.parse(event.data)
      } catch {
        return null
      }
    })()

    if (payload === null) {
      return
    }

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
        // documentId to consumers. Re-emit the state so useSyncExternalStore
        // picks up the updated payload.
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
      // with bad_request:no_document_loaded otherwise), so we can flip
      // isDocumentLoaded without waiting for a DOCUMENT_LOADED event — some
      // PDFs never emit it (e.g. docs with no AcroFields).
      probeRequestIds.delete(requestId)
      markEditorReady('probe_response')
      const probeResult = payload.data?.result as BridgeResult<unknown> | undefined
      if (probeResult !== undefined && probeResult.success === true) {
        markDocumentLoaded('probe_success')
      }
      return
    }
    const entry = pending.get(requestId)
    if (!entry) {
      return
    }
    pending.delete(requestId)
    clearTimeout(entry.timeoutId)
    const result = payload.data?.result as BridgeResult<unknown> | undefined
    entry.resolve(
      result ?? {
        success: false,
        error: { code: 'missing_result', message: 'REQUEST_RESULT payload had no result' },
      },
    )
  }

  window.addEventListener('message', onMessage)

  const bridge: IframeBridge = {
    getState: () => state,
    loadDocument: ({ dataUrl, name, initialPage }) =>
      sendRequest('LOAD_DOCUMENT', { data_url: dataUrl, name, page: initialPage }),
    goTo: ({ page }) => sendRequest('GO_TO', { page }),
    selectTool: ({ tool }) => sendRequest('SELECT_TOOL', { tool }),
    detectFields: (args) => sendRequest('DETECT_FIELDS', { debug_mode: args?.debugMode === true }),
    removeFields: (args) =>
      sendRequest('REMOVE_FIELDS', { field_ids: args?.fieldIds ?? null, page: args?.page ?? null }),
    getDocumentContent: ({ extractionMode }) =>
      sendRequest('GET_DOCUMENT_CONTENT', { extraction_mode: extractionMode }),
    getFields: () => sendRequest('GET_FIELDS', {}),
    setFieldValue: ({ fieldId, value }) => sendRequest('SET_FIELD_VALUE', { field_id: fieldId, value }),
    focusField: ({ fieldId }) => sendRequest('FOCUS_FIELD', { field_id: fieldId }),
    createField: ({ type, x, y, width, height, page, value }) =>
      sendRequest('CREATE_FIELD', { type, x, y, width, height, page, value: value ?? null }),
    submit: ({ downloadCopy }) => sendRequest('SUBMIT', { download_copy: downloadCopy }),
  }

  const dispose = () => {
    window.removeEventListener('message', onMessage)
    clearTimeout(readyTimeout)
    if (probeInterval !== null) {
      clearInterval(probeInterval)
      probeInterval = null
    }
    probeRequestIds.clear()
    for (const { timeoutId, resolve } of pending.values()) {
      clearTimeout(timeoutId)
      resolve({ success: false, error: { code: 'bridge_disposed', message: 'Iframe bridge was disposed' } })
    }
    pending.clear()
  }

  return { bridge, dispose }
}

type UseIframeBridgeArgs = {
  iframeRef: RefObject<HTMLIFrameElement | null>
  editorOrigin: string
  // When this key changes, the bridge is disposed and re-created. Use it to
  // force a full reset of all iframe state (isEditorReady + isDocumentLoaded +
  // pending requests) whenever the iframe is about to remount — e.g. on a
  // form switch.
  resetKey: string
}

const BOOTING_STATE: BridgeState = { kind: 'booting' }

export const useIframeBridge = ({
  iframeRef,
  editorOrigin,
  resetKey,
}: UseIframeBridgeArgs): {
  bridge: IframeBridge | null
  bridgeState: BridgeState
} => {
  const bridgeRef = useRef<IframeBridge | null>(null)
  const listenersRef = useRef<Set<() => void>>(new Set())

  // resetKey is a manual reset sentinel: changing it tears down the bridge +
  // creates a fresh one (full state-machine + probe + pending-request reset).
  // Used on form / locale switches. We read it off the closure indirectly by
  // including it in the deps, so Biome's static analysis sees it as
  // "unused"; the comment below silences that false-positive.
  useEffect(() => {
    void resetKey
    const notify = () => {
      for (const listener of listenersRef.current) {
        listener()
      }
    }
    const { bridge, dispose } = createBridge({
      iframeRef,
      editorOrigin,
      onStateChange: notify,
    })
    bridgeRef.current = bridge
    // Notify subscribers so the fresh booting snapshot is picked up immediately.
    notify()
    return () => {
      dispose()
      bridgeRef.current = null
      notify()
    }
  }, [iframeRef, editorOrigin, resetKey])

  const subscribe = useCallback((listener: () => void): (() => void) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const getStateSnapshot = useCallback((): BridgeState => bridgeRef.current?.getState() ?? BOOTING_STATE, [])
  const getServerSnapshot = useCallback((): BridgeState => BOOTING_STATE, [])

  const bridgeState = useSyncExternalStore(subscribe, getStateSnapshot, getServerSnapshot)

  return { bridge: bridgeRef.current, bridgeState }
}
