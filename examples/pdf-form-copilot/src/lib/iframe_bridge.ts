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
const EDITOR_READY_FALLBACK_MS = 4_000

const generateRequestId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `req_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}

export type IframeBridge = {
  isEditorReady: () => boolean
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
}

const createBridge = ({ iframeRef, editorOrigin, onReady }: CreateBridgeArgs): { bridge: IframeBridge; dispose: () => void } => {
  const pending = new Map<string, PendingRequest>()
  let isEditorReady = false

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

  const markReady = (source: 'editor_ready_event' | 'fallback_timeout'): void => {
    if (isEditorReady) {
      return
    }
    isEditorReady = true
    if (source === 'fallback_timeout') {
      console.warn('[copilot] EDITOR_READY never arrived; flipping isEditorReady optimistically after timeout')
    } else {
      console.info('[copilot] EDITOR_READY received')
    }
    onReady()
  }

  const readyTimeout = setTimeout(() => {
    markReady('fallback_timeout')
  }, EDITOR_READY_FALLBACK_MS)

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
      markReady('editor_ready_event')
      return
    }

    if (payload.type !== 'REQUEST_RESULT') {
      return
    }

    const requestId = typeof payload.data?.request_id === 'string' ? payload.data.request_id : null
    if (requestId === null) {
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
}

export const useIframeBridge = ({
  iframeRef,
  editorOrigin,
}: UseIframeBridgeArgs): { bridge: IframeBridge | null; isEditorReady: boolean } => {
  const bridgeRef = useRef<IframeBridge | null>(null)
  const readyListenersRef = useRef<Set<() => void>>(new Set())

  useEffect(() => {
    const { bridge, dispose } = createBridge({
      iframeRef,
      editorOrigin,
      onReady: () => {
        for (const listener of readyListenersRef.current) {
          listener()
        }
      },
    })
    bridgeRef.current = bridge
    return () => {
      dispose()
      bridgeRef.current = null
    }
  }, [iframeRef, editorOrigin])

  const subscribe = useCallback((listener: () => void): (() => void) => {
    readyListenersRef.current.add(listener)
    return () => {
      readyListenersRef.current.delete(listener)
    }
  }, [])

  const getSnapshot = useCallback((): boolean => bridgeRef.current?.isEditorReady() ?? false, [])
  const getServerSnapshot = useCallback((): boolean => false, [])

  const isEditorReady = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return { bridge: bridgeRef.current, isEditorReady }
}
