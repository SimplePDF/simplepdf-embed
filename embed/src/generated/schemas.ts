// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.
import { z } from 'zod'

export const CreateFieldInput = z.object({
  type: z.enum(["TEXT", "SIGNATURE", "PICTURE", "CHECKBOX", "COMB_TEXT"]).describe("Field type to create."),
  x: z.number().describe("Field x position, in PDF points."),
  y: z.number().describe("Field y position, in PDF points."),
  width: z.number().describe("Field width, in PDF points."),
  height: z.number().describe("Field height, in PDF points."),
  page: z.number().int().describe("1-based page to place the field on."),
  value: z.string().describe("Optional initial value. A string for text/checkbox fields, or a data URL for signature/picture fields.").optional(),
}).describe("Create a new overlay field of the given type at an (x, y) position and size (in PDF points) on a 1-based page. Returns { field_id } for the created field. Requires editing to be enabled.")
export type CreateFieldInput = z.infer<typeof CreateFieldInput>
export const DeleteFieldsInput = z.object({
  fieldIds: z.array(z.string()).describe("IDs of the fields to delete. Omit to delete every field on the target page.").optional(),
  page: z.number().int().describe("1-based page to scope the deletion to. Omit to target all pages.").optional(),
}).describe("Delete overlay fields by id; omit field_ids to delete every field on the given 1-based page, or omit both field_ids and page to delete every overlay field in the document. Returns { deleted_count }. Destructive; requires editing to be enabled.")
export type DeleteFieldsInput = z.infer<typeof DeleteFieldsInput>
export const DeletePagesInput = z.object({
  pages: z.array(z.number().int()).describe("1-based page numbers to delete."),
}).describe("Delete one or more 1-based pages from the document (it cannot delete every visible page). Returns no data. Destructive; requires editing to be enabled.")
export type DeletePagesInput = z.infer<typeof DeletePagesInput>
export const DetectFieldsInput = z.object({}).describe("Automatically detect fillable fields in the loaded document and add them as editable fields. Returns { detected_count }. Requires editing to be enabled.")
export type DetectFieldsInput = z.infer<typeof DetectFieldsInput>
export const DownloadInput = z.object({}).describe("Generate and download the current document as a PDF. Returns no data.")
export type DownloadInput = z.infer<typeof DownloadInput>
export const FocusFieldInput = z.object({
  fieldId: z.string().describe("ID of the field to focus and scroll into view."),
}).describe("Scroll an existing field into view and focus it, addressed by its id (from get_fields). Returns a hint describing the user action expected next.")
export type FocusFieldInput = z.infer<typeof FocusFieldInput>
export const GetDocumentContentInput = z.object({
  extractionMode: z.enum(["auto", "ocr"]).describe("Extraction strategy: 'auto' (default) or 'ocr' to force optical recognition.").optional(),
}).describe("Extract the document's text content page by page (pass extraction_mode 'ocr' to force optical recognition). Use it to read what the document says. Returns { name, pages: [{ page, content }] }.")
export type GetDocumentContentInput = z.infer<typeof GetDocumentContentInput>
export const GetFieldsInput = z.object({}).describe("List every fillable field in the loaded document, including native dropdown and radio AcroFields. Each field reports its id, name, type, page, and current value. Call this first to discover field ids before reading or setting values. Returns { fields }.")
export type GetFieldsInput = z.infer<typeof GetFieldsInput>
export const GoToInput = z.object({
  page: z.number().int().describe("1-based page to navigate to."),
}).describe("Scroll the editor to a specific 1-based page. Returns no data.")
export type GoToInput = z.infer<typeof GoToInput>
export const LoadDocumentInput = z.object({
  dataUrl: z.string().describe("The document to load, as a data URL."),
  name: z.string().describe("Optional display name for the document.").optional(),
  page: z.number().int().describe("Optional 1-based page to open the document on.").optional(),
}).describe("Load a document into the editor from a base64 data URL. This is a host/setup action (no agentic tool); it returns no data.")
export type LoadDocumentInput = z.infer<typeof LoadDocumentInput>
export const MovePageInput = z.object({
  fromPage: z.number().int().describe("1-based current position of the page to move."),
  toPage: z.number().int().describe("1-based destination position for the page."),
}).describe("Move a page from one 1-based position to another, reordering the document. Returns no data. Destructive; requires editing to be enabled.")
export type MovePageInput = z.infer<typeof MovePageInput>
export const RotatePageInput = z.object({
  page: z.number().int().describe("1-based page to rotate 90 degrees clockwise."),
}).describe("Rotate a 1-based page 90 degrees clockwise. Returns no data. Destructive; requires editing to be enabled.")
export type RotatePageInput = z.infer<typeof RotatePageInput>
export const SelectToolInput = z.object({
  tool: z.enum(["TEXT", "SIGNATURE", "PICTURE", "CHECKBOX", "COMB_TEXT"]).nullable().describe("Tool to activate, or null to deselect."),
}).describe("Activate a field-placement tool in the editor toolbar so the user can draw that field type, or pass null to clear the active tool. Returns no data.")
export type SelectToolInput = z.infer<typeof SelectToolInput>
export const SetFieldValueInput = z.object({
  fieldId: z.string().describe("ID of the field to update."),
  value: z.string().nullable().describe("New value for the field, or null to clear it. If the field has options (see get_fields), it must be one of them; otherwise a string (text/checkbox) or a data URL (signature/picture)."),
}).describe("Set the value of an existing field addressed by its id (from get_fields), or clear it with null. If the field has options (see get_fields), value must be one of them; otherwise value is a string (text or checkbox value) or a data URL (signature, picture). Returns no data.")
export type SetFieldValueInput = z.infer<typeof SetFieldValueInput>
export const SubmitInput = z.object({
  downloadCopy: z.boolean().describe("When true, the signer also receives a downloaded copy on submit."),
}).describe("Submit the completed document through the editor's finalization flow. This is irreversible. When download_copy is true the signer also gets a downloaded copy. Fails with missing_required_fields when required fields are unfilled. Returns no data.")
export type SubmitInput = z.infer<typeof SubmitInput>
