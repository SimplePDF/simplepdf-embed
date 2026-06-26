// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.
import * as Schemas from './schemas'

// The agentic tool registry. Each tool name is the camelCase operation name;
// load_document is excluded (it is a host/setup action, not an agentic tool).
export const TOOL_DEFINITIONS = {
  createField: { description: "Create a new overlay field of the given type at an (x, y) position and size (in PDF points) on a 1-based page. Returns { field_id } for the created field. Requires editing to be enabled.", inputSchema: Schemas.CreateFieldInput },
  deleteFields: { description: "Delete overlay fields by id; omit field_ids to delete every field on the given 1-based page, or omit both field_ids and page to delete every overlay field in the document. Returns { deleted_count }. Destructive; requires editing to be enabled.", inputSchema: Schemas.DeleteFieldsInput },
  deletePages: { description: "Delete one or more 1-based pages from the document (it cannot delete every visible page). Returns no data. Destructive; requires editing to be enabled.", inputSchema: Schemas.DeletePagesInput },
  detectFields: { description: "Automatically detect fillable fields in the loaded document and add them as editable fields. Returns { detected_count }. Requires editing to be enabled.", inputSchema: Schemas.DetectFieldsInput },
  download: { description: "Generate and download the current document as a PDF. Returns no data.", inputSchema: Schemas.DownloadInput },
  focusField: { description: "Scroll an existing field into view and focus it, addressed by its id (from get_fields). Returns a hint describing the user action expected next.", inputSchema: Schemas.FocusFieldInput },
  getDocumentContent: { description: "Extract the document's text content page by page (pass extraction_mode 'ocr' to force optical recognition). Use it to read what the document says. Returns { name, pages: [{ page, content }] }.", inputSchema: Schemas.GetDocumentContentInput },
  getFields: { description: "List every fillable field in the loaded document, including native dropdown and radio AcroFields. Each field reports its id, name, type, page, and current value. Call this first to discover field ids before reading or setting values. Returns { fields }.", inputSchema: Schemas.GetFieldsInput },
  goTo: { description: "Scroll the editor to a specific 1-based page. Returns no data.", inputSchema: Schemas.GoToInput },
  movePage: { description: "Move a page from one 1-based position to another, reordering the document. Returns no data. Destructive; requires editing to be enabled.", inputSchema: Schemas.MovePageInput },
  rotatePage: { description: "Rotate a 1-based page 90 degrees clockwise. Returns no data. Destructive; requires editing to be enabled.", inputSchema: Schemas.RotatePageInput },
  selectTool: { description: "Activate a field-placement tool in the editor toolbar so the user can draw that field type, or pass null to clear the active tool. Returns no data.", inputSchema: Schemas.SelectToolInput },
  setFieldValue: { description: "Set the value of an existing field addressed by its id (from get_fields), or clear it with null. If the field has options (see get_fields), value must be one of them; otherwise value is a string (text or checkbox value) or a data URL (signature, picture). Returns no data.", inputSchema: Schemas.SetFieldValueInput },
  submit: { description: "Submit the completed document through the editor's finalization flow. This is irreversible. When download_copy is true the signer also gets a downloaded copy. Fails with missing_required_fields when required fields are unfilled. Returns no data.", inputSchema: Schemas.SubmitInput },
} as const

export type SimplePDFToolName = keyof typeof TOOL_DEFINITIONS
