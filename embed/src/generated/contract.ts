// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.
// Zero runtime dependencies: the zero-dep root imports only from this module.

export const LOCALES = ["fr", "en", "it", "de", "pt", "es", "ja", "nl"] as const
export type Locale = (typeof LOCALES)[number]

export const EDITOR_ERROR_CODES = ["bad_request:editor_not_ready", "bad_request:event_not_allowed", "bad_request:field_not_found", "bad_request:invalid_dimensions", "bad_request:invalid_event_type", "bad_request:invalid_field_ids", "bad_request:invalid_field_type", "bad_request:invalid_page", "bad_request:invalid_signature_url", "bad_request:invalid_tool", "bad_request:invalid_value", "bad_request:missing_required_fields", "bad_request:no_document_loaded", "bad_request:page_not_found", "bad_request:page_out_of_range", "bad_request:plan_upgrade_required", "bad_request:read_only", "bad_request:signup_required", "forbidden:editing_not_allowed", "forbidden:origin_not_whitelisted", "forbidden:whitelist_required", "unexpected:internal_error"] as const
export type EditorErrorCode = (typeof EDITOR_ERROR_CODES)[number]

export const FIELD_TYPES = ["TEXT", "SIGNATURE", "PICTURE", "CHECKBOX", "COMB_TEXT", "DROPDOWN", "RADIO"] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export const OVERLAY_TOOL_TYPES = ["TEXT", "SIGNATURE", "PICTURE", "CHECKBOX", "COMB_TEXT"] as const
export type OverlayToolType = (typeof OVERLAY_TOOL_TYPES)[number]

export const EXTRACTION_MODES = ["auto", "ocr"] as const
export type ExtractionMode = (typeof EXTRACTION_MODES)[number]

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
export type SetFieldValueInput = { fieldId: string; value: string | null }
export type SetFieldValueOutput = null
export type SubmitInput = { downloadCopy: boolean }
export type SubmitOutput = null

export type DocumentContentResult = GetDocumentContentOutput
export type DocumentContentPage = GetDocumentContentOutput['pages'][number]

export type MissingRequiredFieldsDetails = { unfilledRequiredFieldsCount: number }

export type PageFocusedPayload = { previous_page: number | null; current_page: number; total_pages: number }
export type SubmissionSentPayload = { document_id: string; submission_id: string }

export const OPERATIONS = [
  {
    request_type: "CREATE_FIELD",
    wire_type: "CREATE_FIELD",
    method: "createField",
    description: "Create a new overlay field of the given type at an (x, y) position and size (in PDF points) on a 1-based page. Returns { field_id } for the created field. Requires editing to be enabled.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:invalid_page", "bad_request:invalid_dimensions", "bad_request:invalid_value", "bad_request:page_out_of_range", "bad_request:page_not_found", "bad_request:invalid_field_type", "bad_request:invalid_signature_url"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* CreateField */,
  {
    request_type: "DELETE_FIELDS",
    wire_type: "DELETE_FIELDS",
    method: "deleteFields",
    description: "Delete overlay fields by id; omit field_ids to delete every field on the given 1-based page, or omit both field_ids and page to delete every overlay field in the document. Returns { deleted_count }. Destructive; requires editing to be enabled.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:invalid_field_ids", "bad_request:invalid_page", "bad_request:page_out_of_range", "bad_request:page_not_found"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* DeleteFields */,
  {
    request_type: "DELETE_PAGES",
    wire_type: "DELETE_PAGES",
    method: "deletePages",
    description: "Delete one or more 1-based pages from the document (it cannot delete every visible page). Returns no data. Destructive; requires editing to be enabled.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:invalid_page", "bad_request:page_out_of_range", "bad_request:no_document_loaded", "bad_request:page_not_found"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* DeletePages */,
  {
    request_type: "DETECT_FIELDS",
    wire_type: "DETECT_FIELDS",
    method: "detectFields",
    description: "Automatically detect fillable fields in the loaded document and add them as editable fields. Returns { detected_count }. Requires editing to be enabled.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:no_document_loaded"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* DetectFields */,
  {
    request_type: "DOWNLOAD",
    wire_type: "DOWNLOAD",
    method: "download",
    description: "Generate and download the current document as a PDF. Returns no data.",
    error_codes: ["bad_request:no_document_loaded", "bad_request:missing_required_fields"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* Download */,
  {
    request_type: "FOCUS_FIELD",
    wire_type: "FOCUS_FIELD",
    method: "focusField",
    description: "Scroll an existing field into view and focus it, addressed by its id (from get_fields). Returns a hint describing the user action expected next.",
    error_codes: ["bad_request:invalid_value", "bad_request:no_document_loaded", "bad_request:field_not_found"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* FocusField */,
  {
    request_type: "GET_DOCUMENT_CONTENT",
    wire_type: "GET_DOCUMENT_CONTENT",
    method: "getDocumentContent",
    description: "Extract the document's text content page by page (pass extraction_mode 'ocr' to force optical recognition). Use it to read what the document says. Returns { name, pages: [{ page, content }] }.",
    error_codes: ["bad_request:invalid_value", "bad_request:no_document_loaded"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* GetDocumentContent */,
  {
    request_type: "GET_FIELDS",
    wire_type: "GET_FIELDS",
    method: "getFields",
    description: "List every fillable field in the loaded document, including native dropdown and radio AcroFields. Each field reports its id, name, type, page, and current value. Call this first to discover field ids before reading or setting values. Returns { fields }.",
    error_codes: ["bad_request:no_document_loaded"] as const,
    is_agentic_tool: true,
    has_output: true,
  } /* GetFields */,
  {
    request_type: "GO_TO",
    wire_type: "GO_TO",
    method: "goTo",
    description: "Scroll the editor to a specific 1-based page. Returns no data.",
    error_codes: ["bad_request:invalid_page", "bad_request:page_out_of_range"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* GoTo */,
  {
    request_type: "LOAD_DOCUMENT",
    wire_type: "LOAD_DOCUMENT",
    method: "loadDocument",
    description: "Load a document into the editor from a base64 data URL. This is a host/setup action (no agentic tool); it returns no data.",
    error_codes: ["bad_request:invalid_value", "bad_request:invalid_page"] as const,
    is_agentic_tool: false,
    has_output: false,
  } /* LoadDocument */,
  {
    request_type: "MOVE_PAGE",
    wire_type: "MOVE_PAGE",
    method: "movePage",
    description: "Move a page from one 1-based position to another, reordering the document. Returns no data. Destructive; requires editing to be enabled.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:invalid_page", "bad_request:page_out_of_range", "bad_request:no_document_loaded", "bad_request:page_not_found"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* MovePage */,
  {
    request_type: "ROTATE_PAGE",
    wire_type: "ROTATE_PAGE",
    method: "rotatePage",
    description: "Rotate a 1-based page 90 degrees clockwise. Returns no data. Destructive; requires editing to be enabled.",
    error_codes: ["forbidden:editing_not_allowed", "bad_request:invalid_page", "bad_request:page_out_of_range", "bad_request:no_document_loaded", "bad_request:page_not_found"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* RotatePage */,
  {
    request_type: "SELECT_TOOL",
    wire_type: "SELECT_TOOL",
    method: "selectTool",
    description: "Activate a field-placement tool in the editor toolbar so the user can draw that field type, or pass null to clear the active tool. Returns no data.",
    error_codes: ["bad_request:invalid_tool"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* SelectTool */,
  {
    request_type: "SET_FIELD_VALUE",
    wire_type: "SET_FIELD_VALUE",
    method: "setFieldValue",
    description: "Set the value of an existing field addressed by its id (from get_fields), or clear it with null. If the field has options (see get_fields), value must be one of them; otherwise value is a string (text or checkbox value) or a data URL (signature, picture). Returns no data.",
    error_codes: ["bad_request:invalid_value", "bad_request:invalid_signature_url", "bad_request:no_document_loaded", "bad_request:read_only", "bad_request:field_not_found"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* SetFieldValue */,
  {
    request_type: "SUBMIT",
    wire_type: "SUBMIT",
    method: "submit",
    description: "Submit the completed document through the editor's finalization flow. This is irreversible. When download_copy is true the signer also gets a downloaded copy. Fails with missing_required_fields when required fields are unfilled. Returns no data.",
    error_codes: ["bad_request:invalid_value", "bad_request:missing_required_fields"] as const,
    is_agentic_tool: true,
    has_output: false,
  } /* Submit */,
] as const

export type WireType = (typeof OPERATIONS)[number]["wire_type"]
export type RequestType = (typeof OPERATIONS)[number]["request_type"]
export type MethodName = (typeof OPERATIONS)[number]["method"]
export type AgenticToolName = Extract<(typeof OPERATIONS)[number], { is_agentic_tool: true }>["method"]

export const OUTBOUND_EVENTS = [
  { event_type: "PAGE_FOCUSED", description: "Pushed when the focused page changes (the user scrolls to a new page, or a GO_TO completes). The payload reports the current page." },
  { event_type: "SUBMISSION_SENT", description: "Pushed after a SUBMIT completes successfully. This is how you confirm a submission landed: the SUBMIT operation itself resolves with data: null, so listen for this event to get the resulting document_id and submission_id." },
] as const
export type OutboundEventType = (typeof OUTBOUND_EVENTS)[number]["event_type"]
