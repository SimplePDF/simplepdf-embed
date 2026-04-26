// Shared types for the SimplePDF embed bridge. Pure TypeScript, no
// framework dependencies.

export type BridgeResult<TData = null> =
  | { success: true; data: TData }
  | { success: false; error: { code: string; message: string } }

// Runtime guard for BridgeResult shapes received from the iframe. The
// postMessage payload is JSON parsed from an untrusted source — same-origin
// policy narrows the attacker surface, but a malicious page on the editor
// origin could still forge results. We validate the discriminator + the
// error shape; callers keep the `data` payload as `unknown` and narrow
// further at the dispatch layer.
export const isBridgeResultLike = (value: unknown): value is BridgeResult<unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('success' in value)) {
    return false
  }
  if (value.success === true) {
    // `data` is optional on the wire: the editor-side Result type omits it
    // for void operations (SELECT_TOOL, SET_FIELD_VALUE, GO_TO, SUBMIT…).
    // The bridge normalizes missing `data` to `null` downstream, so the guard
    // accepts both shapes. Requiring `data` here would flip every void
    // success into a fake `missing_result` failure.
    return true
  }
  if (value.success === false) {
    if (!('error' in value)) {
      return false
    }
    const error = value.error
    if (typeof error !== 'object' || error === null) {
      return false
    }
    if (!('code' in error) || !('message' in error)) {
      return false
    }
    return typeof error.code === 'string' && typeof error.message === 'string'
  }
  return false
}

export type SupportedFieldType = 'TEXT' | 'BOXED_TEXT' | 'CHECKBOX' | 'PICTURE' | 'SIGNATURE'

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

// State machine. Transitions are strictly forward (booting -> editor_ready ->
// document_loaded) except for `editor_ready` -> `editor_ready` on EDITOR_READY
// re-emission (fresh iframe, no doc yet). Impossible states like
// `{ editorReady: false, documentLoaded: true }` are unrepresentable.
export type BridgeState =
  | { kind: 'booting' }
  | { kind: 'editor_ready' }
  | { kind: 'document_loaded'; documentId: string | null }

// Request type union. Every postMessage the bridge sends carries one of these
// as its `type` field. The editor honours each.
export type BridgeRequestType =
  | 'LOAD_DOCUMENT'
  | 'GO_TO'
  | 'SELECT_TOOL'
  | 'DETECT_FIELDS'
  | 'REMOVE_FIELDS'
  | 'GET_DOCUMENT_CONTENT'
  | 'GET_FIELDS'
  | 'SET_FIELD_VALUE'
  | 'FOCUS_FIELD'
  | 'CREATE_FIELD'
  | 'SUBMIT'
  | 'DOWNLOAD'
  | 'MOVE_PAGE'
  | 'DELETE_PAGE'
  | 'ROTATE_PAGE'

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
  download: () => Promise<BridgeResult>
  movePage: (args: { fromPage: number; toPage: number }) => Promise<BridgeResult>
  deletePage: (args: { page: number }) => Promise<BridgeResult>
  rotatePage: (args: { page: number }) => Promise<BridgeResult>
}
