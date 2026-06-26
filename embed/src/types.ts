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

// Strictly forward: booting -> editorReady -> documentLoaded (with a drop back to
// editorReady when the iframe re-mounts for a fresh document). INTERNAL to the bridge
// (readiness probing + createEmbed's load-when-ready gate); not on the public handle —
// readiness is observable via the EDITOR_READY / DOCUMENT_LOADED editor events.
export type BridgeState =
  | { kind: 'booting' }
  | { kind: 'editorReady' }
  | { kind: 'documentLoaded'; documentId: string | null }

// The editor's outbound events, forwarded to onEmbedEvent VERBATIM: SCREAMING_SNAKE
// `type` + snake_case `data` (the stable, established contract — deliberately NOT
// camelCased, unlike op payloads). EDITOR_READY / DOCUMENT_LOADED are the lifecycle
// wire events; PAGE_FOCUSED / SUBMISSION_SENT take their payloads from the manifest.
export type EditorEvent =
  | { type: 'EDITOR_READY'; data: Record<string, never> }
  | { type: 'DOCUMENT_LOADED'; data: { document_id: string } }
  | { type: 'PAGE_FOCUSED'; data: PageFocusedPayload }
  | { type: 'SUBMISSION_SENT'; data: SubmissionSentPayload }

// Event type -> payload, derived from EditorEvent, for the granular on(type, handler).
export type EditorEventMap = { [TEvent in EditorEvent as TEvent['type']]: TEvent['data'] }

// --- Handle groups ---------------------------------------------------------

// `embed.actions` — the editor operations. Each validates nothing client-side (the
// editor owns validation and always replies with a typed Result); it posts the request,
// correlates the reply by request_id, and resolves to a typed BridgeResult — it never
// throws. Drift-guarded against the generated operation set in ./generated/drift.ts
// (a new operation fails the build until added here).
export type IframeActions = {
  createField: (input: CreateFieldInput) => Promise<BridgeResult<CreateFieldOutput>>
  deleteFields: (input?: DeleteFieldsInput) => Promise<BridgeResult<DeleteFieldsOutput>>
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
}

// `embed.events` — granular, EventEmitter-style subscription to the editor's outbound
// events. `on(type, handler)` hands the handler that event's typed payload and returns
// an unsubscribe function.
export type EmbedEvents = {
  on: <TEventType extends keyof EditorEventMap>(
    type: TEventType,
    handler: (data: EditorEventMap[TEventType]) => void,
  ) => () => void
}

// `embed.lifecycle` — teardown.
export type EmbedLifecycle = {
  dispose: () => void
}

// The handle returned by createEmbed: three groups — `actions`, `events`, `lifecycle`.
// Convention: name the variable `embed` (e.g. `embed.actions.goTo({ page })`,
// `embed.events.on('SUBMISSION_SENT', …)`, `embed.lifecycle.dispose()`).
export type Embed = {
  actions: IframeActions
  events: EmbedEvents
  lifecycle: EmbedLifecycle
}
