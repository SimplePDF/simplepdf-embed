// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.
import { z } from 'zod'

export const CreateFieldInput = z.object({
  type: z.enum(["TEXT", "SIGNATURE", "PICTURE", "CHECKBOX", "COMB_TEXT"]).describe("Field type to create."),
  x: z.number().describe("X of the field's top-left corner, in PDF points from the page's left edge."),
  y: z.number().describe("Y of the field's top-left corner, in PDF points from the page's TOP edge (y grows downward) - the same convention get_fields reports."),
  width: z.number().describe("Field width, in PDF points."),
  height: z.number().describe("Field height, in PDF points."),
  page: z.number().int().describe("1-based page to place the field on."),
  comb: z.object({
  cellOffsets: z.array(z.number()).describe("Per-cell x offsets relative to the field's x, in PDF points. Must start at 0 and increase by at least cell_width between consecutive cells; leave a LARGER gap where the printed cells are grouped (a spaced comb such as an SSN or a date has offsets that jump between groups)."),
  cellWidth: z.number().describe("Width of a single character cell, in PDF points. Must be positive."),
}).describe("Explicit comb cell layout - COMB_TEXT only (rejected for other types). A row of cell blocks under ONE printed label - an SSN (xxx-xx-xxxx), a phone number, a date (MM/DD/YYYY), a ZIP+4 - is a SINGLE COMB_TEXT whose cell_offsets carry the gaps between the groups, not several separate fields. The field width must equal the last offset plus cell_width, so the layout round-trips verbatim through get_fields. Omit for the editor default layout.").optional(),
  value: z.string().describe("Optional initial value. A string for text/checkbox fields, or a data URL for signature/picture fields.").optional(),
}).describe("Create a new overlay field of the given type at an (x, y) position and size, in PDF points with a top-left origin (y grows downward; the same convention get_fields reports, so created geometry reads back identically). Placed on a 1-based page. COMB_TEXT fields accept an explicit comb cell layout, including grouped/spaced layouts (see comb). To adjust an existing field, delete it and recreate it with the corrected geometry - verify placement against the printed form with get_annotated_area. Returns { field_id } for the created field. Requires editing to be enabled.")
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
export const DetectFieldsInput = z.object({}).describe("Automatically detect fillable fields in the loaded document and add them as editable overlay fields. Returns { detected_count }. Detection is a rough STARTING POINT, not the finished layout: text lines land approximately, and a comb row usually comes back as one or more loose TEXT boxes, never resolved into cells. Seed the page with it, then verify against the printed form with get_annotated_area and rebuild the comb rows as explicit COMB_TEXT fields. Requires editing to be enabled.")
export type DetectFieldsInput = z.infer<typeof DetectFieldsInput>
export const DownloadInput = z.object({}).describe("Generate and download the current document as a PDF. Returns no data.")
export type DownloadInput = z.infer<typeof DownloadInput>
export const FocusFieldInput = z.object({
  fieldId: z.string().describe("ID of the field to focus and scroll into view."),
}).describe("Scroll an existing field into view and focus it, addressed by its id (from get_fields). Returns a hint describing the user action expected next.")
export type FocusFieldInput = z.infer<typeof FocusFieldInput>
export const GetAnnotatedAreaInput = z.object({
  page: z.number().int().describe("1-based page to render."),
  x: z.number().describe("X of the area's top-left corner, in PDF points from the page's left edge. Provide x, y, width and height together to render a sub-area; omit all four to render the whole page.").optional(),
  y: z.number().describe("Y of the area's top-left corner, in PDF points from the page's TOP edge (y grows downward).").optional(),
  width: z.number().describe("Area width in PDF points.").optional(),
  height: z.number().describe("Area height in PDF points.").optional(),
  zoom: z.number().describe("Magnification over the whole-page overview scale (~1.4 px per PDF point). 1 (default) renders the area at overview resolution; higher values zoom in for pixel-precise checks. Clamped so the rendered image stays within a bounded pixel budget; the response echoes the effective pixel size.").optional(),
}).describe("Render a badge-annotated PNG of a page or a sub-area of it, to SEE where your fields sit against the printed form. Pass page alone for a whole-page overview; add x, y, width, height (PDF points, top-left origin, y grows downward - the same convention get_fields and create_field use) to crop to a region, and zoom to magnify for fine detail. Every field overlapping the area is outlined with a numbered badge; a COMB_TEXT field additionally has each of its cells outlined - with the gaps between grouped cells left empty - so a zoomed comb row shows your cells against the printed bars: nudge the cell offsets until each cell sits on its bar. Focusing a field (focus_field) surfaces additional alignment feedback in the editor itself. The render shows the printed form plus your field PLACEMENT, not the filled-in values - read those with get_fields. Returns { page, x, y, width, height (the rendered area in PDF points), image_data_url, image_width, image_height (pixels; the px-per-point scale is image_width / width), badges } where badges maps each badge number to its field_id. This is a Premium capability (Plan.ENTERPRISE); lower plans get plan_upgrade_required (or signup_required for anonymous SDK embeds). It renders document content, so like get_document_content it also requires the embedding origin to be whitelisted for the tenant.")
export type GetAnnotatedAreaInput = z.infer<typeof GetAnnotatedAreaInput>
export const GetDocumentContentInput = z.object({
  extractionMode: z.enum(["auto", "ocr"]).describe("Extraction strategy: 'auto' (default) or 'ocr' to force optical recognition.").optional(),
}).describe("Extract the document's text content page by page (pass extraction_mode 'ocr' to force optical recognition). Use it to read what the document says. Returns { name, pages: [{ page, content }] }.")
export type GetDocumentContentInput = z.infer<typeof GetDocumentContentInput>
export const GetFieldsInput = z.object({}).describe("List every fillable field in the loaded document, including native dropdown and radio AcroFields. Each field reports its id, name, type, page, current value, and a geometry object: x, y, width, height in PDF points with a top-left origin (y grows downward, the same convention create_field consumes, so a create-then-read round-trip returns identical numbers) plus the comb cell layout for COMB_TEXT fields. Call this first to discover field ids before reading or setting values, and to verify geometry after create_field. To SEE placement against the printed page, call get_annotated_area. Returns { fields, pages } where pages lists every page with its current 1-based position and its displayed size in PDF points.")
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
