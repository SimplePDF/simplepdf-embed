// Public type surface for @simplepdf/embed. Zero runtime dependencies: every
// editor-derived part is imported (type-only) from the generated contract, and
// the bridge/package-owned parts are composed in here. The editor iframe lib is
// the single source of truth; nothing in this file restates a wire shape.

import type {
  CreateFieldInput,
  CreateFieldOutput,
  DeleteFieldsInput,
  DeleteFieldsOutput,
  DeletePagesInput,
  DetectFieldsOutput,
  EditorErrorCode,
  FocusFieldInput,
  FocusFieldOutput,
  GetDocumentContentInput,
  GetDocumentContentOutput,
  GetFieldsOutput,
  GoToInput,
  LoadDocumentInput,
  MissingRequiredFieldsDetails,
  MovePageInput,
  PageFocusedPayload,
  RotatePageInput,
  SelectToolInput,
  SetFieldValueInput,
  SubmissionSentPayload,
  SubmitInput,
} from './generated/contract'

export type {
  CreateFieldInput,
  CreateFieldOutput,
  DeleteFieldsInput,
  DeleteFieldsOutput,
  DeletePagesInput,
  DetectFieldsOutput,
  DocumentContentPage,
  DocumentContentResult,
  EditorErrorCode,
  ExtractionMode,
  FieldType,
  FocusFieldInput,
  FocusFieldOutput,
  GetDocumentContentInput,
  GetDocumentContentOutput,
  GetFieldsOutput,
  GoToInput,
  Locale,
  LoadDocumentInput,
  MissingRequiredFieldsDetails,
  MovePageInput,
  OverlayToolType,
  PageFocusedPayload,
  RotatePageInput,
  SelectToolInput,
  SetFieldValueInput,
  SubmissionSentPayload,
  SubmitInput,
} from './generated/contract'

// A single field as reported by get_fields. Alias kept for ergonomics; the
// shape is owned by the generated GetFieldsOutput.
export type FieldRecord = GetFieldsOutput['fields'][number]

// --- Error model -----------------------------------------------------------

// Codes the bridge / adapters produce (transport / lifecycle / pre-flight). These
// never travel on the wire; the editor never emits them. Owned by the package.
// `bad_request:invalid_input` is emitted by the /tools router when an agentic call
// fails schema validation before dispatch (the thin root bridge does not validate).
export type BridgeOwnedErrorCode =
  | 'bad_request:invalid_input'
  | 'unexpected:timeout'
  | 'unexpected:iframe_not_mounted'
  | 'unexpected:bridge_disposed'
  | 'unexpected:malformed_result'
  | 'unexpected:unknown'

// The complete, closed error union: package-owned transport codes UNION the
// generated editor codes (the customer-facing set already redacted at the wire
// boundary, where internal failures collapse to unexpected:internal_error).
export type BridgeErrorCode = BridgeOwnedErrorCode | EditorErrorCode

// bad_request:missing_required_fields carries typed details; every other code
// is a plain { code, message }. Discriminated on `code`.
export type BridgeError =
  | {
      code: 'bad_request:missing_required_fields'
      message: string
      details: MissingRequiredFieldsDetails
    }
  | { code: Exclude<BridgeErrorCode, 'bad_request:missing_required_fields'>; message: string }

export type BridgeResult<TData = null> =
  | { success: true; data: TData }
  | { success: false; error: BridgeError }

// --- Lifecycle -------------------------------------------------------------

// Strictly forward: booting -> editor_ready -> document_loaded (with a drop
// back to editor_ready when the iframe re-mounts for a fresh document).
export type BridgeState =
  | { kind: 'booting' }
  | { kind: 'editor_ready' }
  | { kind: 'document_loaded'; documentId: string | null }

// Events a consumer can subscribe to via embed.on(...). The two editor-derived
// events mirror the manifest's outbound events; state_change/disposed are the
// package-owned lifecycle signals.
export type BridgeEventMap = {
  state_change: BridgeState
  submission_sent: SubmissionSentPayload
  page_focused: PageFocusedPayload
  disposed: undefined
}

export type BridgeEventName = keyof BridgeEventMap

// --- Bridge surface --------------------------------------------------------

// The programmatic method surface. Each method validates nothing client-side
// (the editor owns validation and always replies with a typed Result); it posts
// the request, correlates the reply by request_id, and resolves to a typed
// BridgeResult — it never throws. Inputs are typed for TS consumers; at runtime
// any value is accepted (the editor is the validation authority).
export type IframeBridge = {
  createField: (input: CreateFieldInput) => Promise<BridgeResult<CreateFieldOutput>>
  deleteFields: (input: DeleteFieldsInput) => Promise<BridgeResult<DeleteFieldsOutput>>
  deletePages: (input: DeletePagesInput) => Promise<BridgeResult>
  detectFields: () => Promise<BridgeResult<DetectFieldsOutput>>
  download: () => Promise<BridgeResult>
  focusField: (input: FocusFieldInput) => Promise<BridgeResult<FocusFieldOutput>>
  getDocumentContent: (input?: GetDocumentContentInput) => Promise<BridgeResult<GetDocumentContentOutput>>
  getFields: () => Promise<BridgeResult<GetFieldsOutput>>
  goTo: (input: GoToInput) => Promise<BridgeResult>
  loadDocument: (input: LoadDocumentInput) => Promise<BridgeResult>
  movePage: (input: MovePageInput) => Promise<BridgeResult>
  rotatePage: (input: RotatePageInput) => Promise<BridgeResult>
  selectTool: (input: SelectToolInput) => Promise<BridgeResult>
  setFieldValue: (input: SetFieldValueInput) => Promise<BridgeResult>
  submit: (input: SubmitInput) => Promise<BridgeResult>
  getState: () => BridgeState
}
// IframeBridge's method set is drift-guarded against the generated operation set
// in ./generated/drift.ts (a new operation fails the build until added above).

// The full handle returned by createEmbed. Convention: name the
// variable `embed`.
export type Embed = IframeBridge & {
  readonly state: BridgeState
  on: <E extends BridgeEventName>(event: E, listener: (payload: BridgeEventMap[E]) => void) => () => void
  dispose: () => void
  readonly iframe: HTMLIFrameElement | null
}
