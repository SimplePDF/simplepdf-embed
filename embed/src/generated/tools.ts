// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.
import * as Schemas from './schemas'

// The agentic tool registry. Each tool name is the camelCase operation name;
// load_document is excluded here (a host/setup action; the WebMCP surface registers it).
export const TOOL_DEFINITIONS = {
  buildPdf: { description: "Build and display a PDF locally from Typst code. Read get_documentation for task recipes, templates, fonts and limits. Request inspect:{} for revision-bound page images in the same response. Use a stable idempotency key; poll the job if needed. Inspect the successful revision with simplepdf_embed_get_annotated_page. Manual edits block replacement. Does not submit or share.", inputSchema: Schemas.BuildPdfInput },
  getDocumentation: { description: "Read task documentation for the SimplePDF browser API. Omit topic for the index. Includes PDF building, templates, forms, fields and inspection. Guidance does not modify the document or grant permissions.", inputSchema: Schemas.GetDocumentationInput },
  batchSetFieldValues: { description: "Set existing fields, addressed by ids from the field list, in one atomic undo step. If any update is rejected, nothing changes and the call fails with bad_request:batch_validation_failed, whose details list each rejection with its field id, code and message. Text is set at once, never typed. Returns no data.", inputSchema: Schemas.BatchSetFieldValuesInput },
  createField: { description: "Create a new overlay field on a page. Returns the id of the created field.", inputSchema: Schemas.CreateFieldInput },
  deleteFields: { description: "Delete overlay fields: the ones listed, every one on a page, or every one in the document. Returns the number of fields deleted. Destructive.", inputSchema: Schemas.DeleteFieldsInput },
  deletePages: { description: "Delete pages from the document (it cannot delete every visible page). Returns no data. Destructive.", inputSchema: Schemas.DeletePagesInput },
  detectFields: { description: "Automatically detect fillable fields in the loaded document and add them as editable fields. Returns the number of fields detected.", inputSchema: Schemas.DetectFieldsInput },
  download: { description: "Generate and download the current document as a PDF. Returns no data.", inputSchema: Schemas.DownloadInput },
  focusField: { description: "Scroll an existing field into view and focus it, addressed by its id from the field list. Returns a hint describing the user action expected next.", inputSchema: Schemas.FocusFieldInput },
  getAnnotatedPage: { description: "Render a page as a PNG with every field outlined and numbered, so a vision model can see which field sits where on the printed form (placement only: read values from the field list). Returns the page, the PNG as a data URL, its width and height in pixels, and badges mapping each number drawn on the image to a field id; as a WebMCP tool the PNG arrives as an image block and the rest as a text block.", inputSchema: Schemas.GetAnnotatedPageInput },
  getDocumentContent: { description: "Extract the document's content page by page as Markdown, or as plain text when optical recognition is forced. Use it to read what the document says. Returns the document name and each page's content.", inputSchema: Schemas.GetDocumentContentInput },
  getFields: { description: "List every fillable field in the loaded document, including native dropdown and radio AcroFields. Each field reports its id, name, type, page, current value, and the options its value must be one of, if any. Call this first to discover field ids before reading or setting values. To SEE where each field sits on the printed page, render the annotated page. Returns the field list.", inputSchema: Schemas.GetFieldsInput },
  goTo: { description: "Scroll the editor to a page. Returns no data.", inputSchema: Schemas.GoToInput },
  movePage: { description: "Move a page to another position, reordering the document. Returns no data. Destructive.", inputSchema: Schemas.MovePageInput },
  rotatePage: { description: "Rotate a page 90 degrees clockwise. Returns no data. Destructive.", inputSchema: Schemas.RotatePageInput },
  selectTool: { description: "Activate a field-placement tool in the editor toolbar so the user can draw that field type, or pass null to clear the active tool. Returns no data.", inputSchema: Schemas.SelectToolInput },
  setFieldValue: { description: "Set or clear (null) one existing field, addressed by its id from the field list. Text is typed out unless animate is false. Returns no data.", inputSchema: Schemas.SetFieldValueInput },
  submit: { description: "Submit the completed document through the editor's finalization flow. This is irreversible. Fails with bad_request:missing_required_fields when required fields are unfilled. Returns no data.", inputSchema: Schemas.SubmitInput },
} as const

export type SimplePDFToolName = keyof typeof TOOL_DEFINITIONS
