// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.
// Zero runtime dependencies: the zero-dep root imports only from this module and method-names.ts.
import type { METHOD_NAMES } from './method-names'

export const LOCALES = ["fr", "en", "it", "de", "pt", "es", "ja", "nl"] as const
export type Locale = (typeof LOCALES)[number]

export const EDITOR_ERROR_CODES = ["bad_request:batch_validation_failed", "bad_request:download_blocked", "bad_request:editor_not_ready", "bad_request:event_not_allowed", "bad_request:failed_to_load_document", "bad_request:field_not_found", "bad_request:invalid_dimensions", "bad_request:invalid_event_type", "bad_request:invalid_field_ids", "bad_request:invalid_field_type", "bad_request:invalid_page", "bad_request:invalid_signature_url", "bad_request:invalid_tool", "bad_request:invalid_value", "bad_request:missing_required_fields", "bad_request:no_document_loaded", "bad_request:page_not_found", "bad_request:page_out_of_range", "bad_request:plan_upgrade_required", "bad_request:read_only", "bad_request:signup_required", "forbidden:editing_not_allowed", "forbidden:origin_not_whitelisted", "forbidden:whitelist_required", "unexpected:internal_error"] as const
export type EditorErrorCode = (typeof EDITOR_ERROR_CODES)[number]

export const FIELD_TYPES = ["TEXT", "SIGNATURE", "PICTURE", "CHECKBOX", "COMB_TEXT", "DROPDOWN", "RADIO"] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export const OVERLAY_TOOL_TYPES = ["TEXT", "SIGNATURE", "PICTURE", "CHECKBOX", "COMB_TEXT"] as const
export type OverlayToolType = (typeof OVERLAY_TOOL_TYPES)[number]

export const EXTRACTION_MODES = ["auto", "ocr"] as const
export type ExtractionMode = (typeof EXTRACTION_MODES)[number]

export type BatchSetFieldValuesInput = { updates: Array<{ fieldId: string; value: string | null }> }
export type BatchSetFieldValuesOutput = null
export type CreateFieldInput = { type: OverlayToolType; x: number; y: number; width: number; height: number; page: number; value?: string }
export type CreateFieldOutput = { fieldId: string }
export type DeleteFieldsInput = { fieldIds?: string[]; page?: number }
export type DeleteFieldsOutput = { deletedCount: number }
export type DeletePagesInput = { pages: number[] }
export type DeletePagesOutput = null
export type DetectFieldsInput = Record<string, never>
export type DetectFieldsOutput = { detectedCount: number }
export type DownloadInput = Record<string, never>
export type DownloadOutput = null
export type FocusFieldInput = { fieldId: string }
export type FocusFieldOutput = { hint: { type: "user_action_expected"; message: string } }
export type GetAnnotatedPageInput = { page: number }
export type GetAnnotatedPageOutput = { page: number; imageDataUrl: string; imageWidth: number; imageHeight: number; badges: Record<string, string> }
export type GetDocumentContentInput = { extractionMode?: ExtractionMode }
export type GetDocumentContentOutput = { name: string; pages: Array<{ page: number; content: string }> }
export type GetFieldsInput = Record<string, never>
export type GetFieldsOutput = { fields: Array<{ fieldId: string; name: string | null; type: FieldType; page: number; value: string | null; options: string[] | null }> }
export type GoToInput = { page: number }
export type GoToOutput = null
export type LoadDocumentInput = { dataUrl: string; name?: string; page?: number }
export type LoadDocumentOutput = null
export type MovePageInput = { fromPage: number; toPage: number }
export type MovePageOutput = null
export type RotatePageInput = { page: number }
export type RotatePageOutput = null
export type SelectToolInput = { tool: OverlayToolType | null }
export type SelectToolOutput = null
export type SetFieldValueInput = { animate?: boolean; fieldId: string; value: string | null }
export type SetFieldValueOutput = null
export type SubmitInput = { downloadCopy: boolean }
export type SubmitOutput = null

export type DocumentContentResult = GetDocumentContentOutput
export type DocumentContentPage = GetDocumentContentOutput['pages'][number]

export type BatchValidationFailedDetails = { failures: Array<{ fieldId: string; code: "bad_request:field_not_found" | "bad_request:invalid_signature_url" | "bad_request:invalid_value" | "bad_request:read_only"; message: string }> }
export type MissingRequiredFieldsDetails = { unfilledRequiredFieldsCount: number }
export type EditorErrorDetailsByCode = {
  'bad_request:batch_validation_failed': BatchValidationFailedDetails
  'bad_request:missing_required_fields': MissingRequiredFieldsDetails
}

export type EditorReadyPayload = Record<string, never>
export type DocumentLoadedPayload = { document_id: string }
export type PageFocusedPayload = { previous_page: number | null; current_page: number; total_pages: number }
export type SubmissionSentPayload = { document_id: string; submission_id: string }

export const OPERATIONS = [
  {
    request_type: "BATCH_SET_FIELD_VALUES",
    wire_type: "BATCH_SET_FIELD_VALUES",
    method: "batchSetFieldValues",
    description: "Set existing fields, addressed by ids from the field list, in one atomic undo step. If any update is rejected, nothing changes and the call fails with bad_request:batch_validation_failed, whose details list each rejection with its field id, code and message. Text is set at once, never typed. Returns no data.",
    error_codes: ["bad_request:batch_validation_failed", "bad_request:invalid_value", "bad_request:no_document_loaded"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* BatchSetFieldValues */,
  {
    request_type: "CREATE_FIELD",
    wire_type: "CREATE_FIELD",
    method: "createField",
    description: "Create a new overlay field on a page. Returns the id of the created field.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:no_document_loaded", "bad_request:invalid_page", "bad_request:invalid_dimensions", "bad_request:invalid_value", "bad_request:page_out_of_range", "bad_request:page_not_found", "bad_request:invalid_field_type", "bad_request:invalid_signature_url"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* CreateField */,
  {
    request_type: "DELETE_FIELDS",
    wire_type: "DELETE_FIELDS",
    method: "deleteFields",
    description: "Delete overlay fields: the ones listed, every one on a page, or every one in the document. Returns the number of fields deleted. Destructive.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:no_document_loaded", "bad_request:invalid_field_ids", "bad_request:invalid_page", "bad_request:page_out_of_range", "bad_request:page_not_found"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* DeleteFields */,
  {
    request_type: "DELETE_PAGES",
    wire_type: "DELETE_PAGES",
    method: "deletePages",
    description: "Delete pages from the document (it cannot delete every visible page). Returns no data. Destructive.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:invalid_page", "bad_request:page_out_of_range", "bad_request:no_document_loaded", "bad_request:page_not_found"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* DeletePages */,
  {
    request_type: "DETECT_FIELDS",
    wire_type: "DETECT_FIELDS",
    method: "detectFields",
    description: "Automatically detect fillable fields in the loaded document and add them as editable fields. Returns the number of fields detected.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:no_document_loaded"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* DetectFields */,
  {
    request_type: "DOWNLOAD",
    wire_type: "DOWNLOAD",
    method: "download",
    description: "Generate and download the current document as a PDF. Returns no data.",
    error_codes: ["bad_request:no_document_loaded", "bad_request:missing_required_fields", "bad_request:download_blocked"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* Download */,
  {
    request_type: "FOCUS_FIELD",
    wire_type: "FOCUS_FIELD",
    method: "focusField",
    description: "Scroll an existing field into view and focus it, addressed by its id from the field list. Returns a hint describing the user action expected next.",
    error_codes: ["bad_request:invalid_value", "bad_request:no_document_loaded", "bad_request:field_not_found"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* FocusField */,
  {
    request_type: "GET_ANNOTATED_PAGE",
    wire_type: "GET_ANNOTATED_PAGE",
    method: "getAnnotatedPage",
    description: "Render a page as a PNG with every field outlined and numbered, so a vision model can see which field sits where on the printed form (placement only: read values from the field list). Returns the page, the PNG as a data URL, its width and height in pixels, and badges mapping each number drawn on the image to a field id; as a WebMCP tool the PNG arrives as an image block and the rest as a text block.",
    error_codes: ["bad_request:no_document_loaded", "bad_request:invalid_page", "bad_request:page_out_of_range"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* GetAnnotatedPage */,
  {
    request_type: "GET_DOCUMENT_CONTENT",
    wire_type: "GET_DOCUMENT_CONTENT",
    method: "getDocumentContent",
    description: "Extract the document's content page by page as Markdown, or as plain text when optical recognition is forced. Use it to read what the document says. Returns the document name and each page's content.",
    error_codes: ["bad_request:invalid_value", "bad_request:no_document_loaded"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* GetDocumentContent */,
  {
    request_type: "GET_FIELDS",
    wire_type: "GET_FIELDS",
    method: "getFields",
    description: "List every fillable field in the loaded document, including native dropdown and radio AcroFields. Each field reports its id, name, type, page, current value, and the options its value must be one of, if any. Call this first to discover field ids before reading or setting values. To SEE where each field sits on the printed page, render the annotated page. Returns the field list.",
    error_codes: ["bad_request:no_document_loaded"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* GetFields */,
  {
    request_type: "GO_TO",
    wire_type: "GO_TO",
    method: "goTo",
    description: "Scroll the editor to a page. Returns no data.",
    error_codes: ["bad_request:no_document_loaded", "bad_request:invalid_page", "bad_request:page_out_of_range"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* GoTo */,
  {
    request_type: "LOAD_DOCUMENT",
    wire_type: "LOAD_DOCUMENT",
    method: "loadDocument",
    description: "Replace the document in the editor with one supplied as a base64 data URL or an http(s) URL the editor fetches. Destructive: the current document and every edit in it are discarded. Replies once the document and its fields are ready, so the next operation can act on it, and DOCUMENT_LOADED follows the reply; the URL already open is left as is and answers once it settles; a document that cannot be loaded or prepared answers bad_request:failed_to_load_document. Returns no data.",
    error_codes: ["bad_request:failed_to_load_document", "bad_request:invalid_value", "bad_request:invalid_page"] as const,
    is_agentic_tool: false,
    has_output: false,
  } /* LoadDocument */,
  {
    request_type: "MOVE_PAGE",
    wire_type: "MOVE_PAGE",
    method: "movePage",
    description: "Move a page to another position, reordering the document. Returns no data. Destructive.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:invalid_page", "bad_request:page_out_of_range", "bad_request:no_document_loaded", "bad_request:page_not_found"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* MovePage */,
  {
    request_type: "ROTATE_PAGE",
    wire_type: "ROTATE_PAGE",
    method: "rotatePage",
    description: "Rotate a page 90 degrees clockwise. Returns no data. Destructive.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:invalid_page", "bad_request:page_out_of_range", "bad_request:no_document_loaded", "bad_request:page_not_found"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* RotatePage */,
  {
    request_type: "SELECT_TOOL",
    wire_type: "SELECT_TOOL",
    method: "selectTool",
    description: "Activate a field-placement tool in the editor toolbar so the user can draw that field type, or pass null to clear the active tool. Returns no data.",
    error_codes: ["bad_request:no_document_loaded", "bad_request:invalid_tool"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* SelectTool */,
  {
    request_type: "SET_FIELD_VALUE",
    wire_type: "SET_FIELD_VALUE",
    method: "setFieldValue",
    description: "Set or clear (null) one existing field, addressed by its id from the field list. Text is typed out unless animate is false. Returns no data.",
    error_codes: ["bad_request:field_not_found", "bad_request:invalid_signature_url", "bad_request:invalid_value", "bad_request:read_only", "bad_request:no_document_loaded"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* SetFieldValue */,
  {
    request_type: "SUBMIT",
    wire_type: "SUBMIT",
    method: "submit",
    description: "Submit the completed document through the editor's finalization flow. This is irreversible. Fails with bad_request:missing_required_fields when required fields are unfilled. Returns no data.",
    error_codes: ["bad_request:no_document_loaded", "bad_request:invalid_value", "bad_request:missing_required_fields"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* Submit */,
] as const

export type WireType = (typeof OPERATIONS)[number]["wire_type"]
export type RequestType = (typeof OPERATIONS)[number]["request_type"]
export type MethodName = (typeof METHOD_NAMES)[number]

export const OUTBOUND_EVENTS = [
  { event_type: "EDITOR_READY", description: "Pushed once when the editor iframe boots in loading-placeholder mode (the loadingPlaceholder=true iframe query flag, which @simplepdf/embed sets while it waits to post LOAD_DOCUMENT) and accepts operations; before it, LOAD_DOCUMENT fails with bad_request:editor_not_ready and every other operation with bad_request:no_document_loaded. An iframe opened with a document instead goes straight to DOCUMENT_LOADED. It is not replayed: a listener attached after boot never receives it, so treat bad_request:editor_not_ready as \"retry shortly\" rather than waiting for this event." },
  { event_type: "DOCUMENT_LOADED", description: "Pushed exactly once per loaded document, when the document and its fields are ready; the payload carries the document_id. It follows the LOAD_DOCUMENT reply, which is itself sent once the document is ready, so a request sent after that reply acts on the new document; before any document, operations other than LOAD_DOCUMENT fail with bad_request:no_document_loaded, and until it fires for a document the page opened itself GET_FIELDS may report an incomplete field list. On a blank editor it fires once a document is loaded, by LOAD_DOCUMENT or by the user." },
  { event_type: "PAGE_FOCUSED", description: "Pushed when the focused page changes (the user scrolls to a new page, or a GO_TO completes). The payload reports the current page." },
  { event_type: "SUBMISSION_SENT", description: "Pushed after a SUBMIT completes successfully. This is how you confirm a submission landed: the SUBMIT operation itself resolves with data: null, so listen for this event to get the resulting document_id and submission_id." },
] as const
export type OutboundEventType = (typeof OUTBOUND_EVENTS)[number]["event_type"]
