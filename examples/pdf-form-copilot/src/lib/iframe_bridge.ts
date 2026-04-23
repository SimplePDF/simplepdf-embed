import { useCallback, useEffect, useRef, useSyncExternalStore, type RefObject } from 'react'

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

export type IframeBridge = {
  isEditorReady: () => boolean
  isDocumentLoaded: () => boolean
  getDocumentId: () => string | null
  loadDocument: (args: LoadDocumentArgs) => Promise<BridgeResult>
  goTo: (args: { page: number }) => Promise<BridgeResult>
  selectTool: (args: { tool: SupportedFieldType | null }) => Promise<BridgeResult>
  detectFields: (args?: { debugMode?: boolean }) => Promise<BridgeResult<{ detected_count: number }>>
  removeFields: (args?: RemoveFieldsArgs) => Promise<BridgeResult<{ removed_count: number }>>
  getDocumentContent: (args: { extractionMode: 'auto' | 'ocr' }) => Promise<BridgeResult<DocumentContentResult>>
  getFields: () => Promise<BridgeResult<{ fields: FieldRecord[] }>>
  setFieldValue: (args: { fieldId: string; value: string | null }) => Promise<BridgeResult>
  focusField: (args: { fieldId: string }) => Promise<BridgeResult<{ hint: { type: 'user_action_expected'; message: string } } | null>>
  createField: (args: CreateFieldArgs) => Promise<BridgeResult<{ field_id: string }>>
  submit: (args: { downloadCopy: boolean }) => Promise<BridgeResult>
}

type CreateBridgeArgs = {
  iframeRef: RefObject<HTMLIFrameElement | null>
  editorOrigin: string
  onReady: () => void
  onDocumentLoaded: () => void
}

const createBridge = ({
  iframeRef,
  editorOrigin,
  onReady,
  onDocumentLoaded,
}: CreateBridgeArgs): { bridge: IframeBridge; dispose: () => void } => {
  const pending = new Map<string, PendingRequest>()
  let isEditorReady = false
  let isDocumentLoaded = false
  let documentId: string | null = null

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
          error: { code: 'timeout', message: `Iframe request '${type}' timed out after ${REQUEST_TIMEOUT_MS}ms` },
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

  const markEditorReady = (source: 'editor_ready_event' | 'probe_response' | 'fallback_timeout'): void => {
    if (source === 'editor_ready_event') {
      // A fresh EDITOR_READY event means the iframe has (re)mounted and a new
      // document load cycle is starting. Reset isDocumentLoaded so consumers
      // wait for the new DOCUMENT_LOADED signal before treating the editor as
      // fully usable.
      isDocumentLoaded = false
    }
    if (isEditorReady) {
      return
    }
    isEditorReady = true
    if (source === 'fallback_timeout') {
      console.warn(`[copilot] editor readiness hard-fallback after ${EDITOR_READY_HARD_FALLBACK_MS}ms`)
    } else if (source === 'probe_response') {
      console.info('[copilot] editor ready via GET_FIELDS probe response')
    } else {
      console.info('[copilot] EDITOR_READY received')
    }
    onReady()
  }

  const markDocumentLoaded = (source: 'document_loaded_event' | 'probe_success' | 'fallback_timeout'): void => {
    if (isDocumentLoaded) {
      return
    }
    isDocumentLoaded = true
    if (source === 'probe_success') {
      console.info('[copilot] document loaded inferred from GET_FIELDS probe success')
    } else if (source === 'fallback_timeout') {
      console.warn(`[copilot] document-loaded hard-fallback after ${EDITOR_READY_HARD_FALLBACK_MS}ms`)
    } else {
      console.info('[copilot] DOCUMENT_LOADED received')
    }
    stopProbing()
    onDocumentLoaded()
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

  const readyTimeout = setTimeout(() => {
    markEditorReady('fallback_timeout')
    markDocumentLoaded('fallback_timeout')
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
        // Notify subscribers so a late-arriving DOCUMENT_LOADED (after the
        // probe already flipped isDocumentLoaded true) still propagates the
        // fresh documentId to consumers via useSyncExternalStore.
        onDocumentLoaded()
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
    entry.resolve(result ?? { success: false, error: { code: 'missing_result', message: 'REQUEST_RESULT payload had no result' } })
  }

  window.addEventListener('message', onMessage)

  const bridge: IframeBridge = {
    isEditorReady: () => isEditorReady,
    isDocumentLoaded: () => isDocumentLoaded,
    getDocumentId: () => documentId,
    loadDocument: ({ dataUrl, name, initialPage }) =>
      sendRequest('LOAD_DOCUMENT', { data_url: dataUrl, name, page: initialPage }),
    goTo: ({ page }) => sendRequest('GO_TO', { page }),
    selectTool: ({ tool }) => sendRequest('SELECT_TOOL', { tool }),
    detectFields: (args) => sendRequest('DETECT_FIELDS', { debug_mode: args?.debugMode === true }),
    removeFields: (args) => sendRequest('REMOVE_FIELDS', { field_ids: args?.fieldIds ?? null, page: args?.page ?? null }),
    getDocumentContent: ({ extractionMode }) => sendRequest('GET_DOCUMENT_CONTENT', { extraction_mode: extractionMode }),
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

export const useIframeBridge = ({
  iframeRef,
  editorOrigin,
  resetKey,
}: UseIframeBridgeArgs): {
  bridge: IframeBridge | null
  isEditorReady: boolean
  isDocumentLoaded: boolean
  documentId: string | null
} => {
  const bridgeRef = useRef<IframeBridge | null>(null)
  const listenersRef = useRef<Set<() => void>>(new Set())

  useEffect(() => {
    const notify = () => {
      for (const listener of listenersRef.current) {
        listener()
      }
    }
    const { bridge, dispose } = createBridge({
      iframeRef,
      editorOrigin,
      onReady: notify,
      onDocumentLoaded: notify,
    })
    bridgeRef.current = bridge
    // Notify subscribers so the fresh false snapshot is picked up immediately.
    for (const listener of listenersRef.current) {
      listener()
    }
    return () => {
      dispose()
      bridgeRef.current = null
      for (const listener of listenersRef.current) {
        listener()
      }
    }
  }, [iframeRef, editorOrigin, resetKey])

  const subscribe = useCallback((listener: () => void): (() => void) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const getEditorReadySnapshot = useCallback((): boolean => bridgeRef.current?.isEditorReady() ?? false, [])
  const getDocumentLoadedSnapshot = useCallback((): boolean => bridgeRef.current?.isDocumentLoaded() ?? false, [])
  const getDocumentIdSnapshot = useCallback((): string | null => bridgeRef.current?.getDocumentId() ?? null, [])
  const getBooleanServerSnapshot = useCallback((): boolean => false, [])
  const getDocumentIdServerSnapshot = useCallback((): string | null => null, [])

  const isEditorReady = useSyncExternalStore(subscribe, getEditorReadySnapshot, getBooleanServerSnapshot)
  const isDocumentLoaded = useSyncExternalStore(subscribe, getDocumentLoadedSnapshot, getBooleanServerSnapshot)
  const documentId = useSyncExternalStore(subscribe, getDocumentIdSnapshot, getDocumentIdServerSnapshot)

  return { bridge: bridgeRef.current, isEditorReady, isDocumentLoaded, documentId }
}
