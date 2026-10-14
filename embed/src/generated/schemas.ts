// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.
import { z } from 'zod'

export const BatchSetFieldValuesInput = z.object({
  updates: z.array(z.object({
  fieldId: z.string().describe("ID of the field to update."),
  value: z.string().nullable().describe("New value for the field, or null to clear it. If the field has options (see the field list), it must be one of them; otherwise a string (text/checkbox), or a data URL or http(s) URL, fetched by the editor (signature/picture), or plain text for a signature, drawn as a typed signature."),
})).describe("The fields to set, at least one, each field at most once. Fields not listed keep their value."),
})
export type BatchSetFieldValuesInput = z.infer<typeof BatchSetFieldValuesInput>
export const CreateFieldInput = z.object({
  type: z.enum(["TEXT", "SIGNATURE", "PICTURE", "CHECKBOX", "COMB_TEXT"]).describe("Field type to create."),
  x: z.number().describe("Field x position, in PDF points."),
  y: z.number().describe("Field y position, in PDF points."),
  width: z.number().describe("Field width, in PDF points."),
  height: z.number().describe("Field height, in PDF points."),
  page: z.number().int().describe("1-based page to place the field on."),
  value: z.string().describe("Optional initial value. A string for text/checkbox fields; a data URL or http(s) URL (fetched by the editor) for signature/picture fields, or plain text for a signature, drawn as a typed signature.").optional(),
})
export type CreateFieldInput = z.infer<typeof CreateFieldInput>
export const DeleteFieldsInput = z.object({
  fieldIds: z.array(z.string()).describe("IDs of the fields to delete. Omit to delete every field on the target page.").optional(),
  page: z.number().int().describe("1-based page to scope the deletion to. Omit to target all pages.").optional(),
})
export type DeleteFieldsInput = z.infer<typeof DeleteFieldsInput>
export const DeletePagesInput = z.object({
  pages: z.array(z.number().int()).describe("1-based page numbers to delete."),
})
export type DeletePagesInput = z.infer<typeof DeletePagesInput>
export const DetectFieldsInput = z.object({})
export type DetectFieldsInput = z.infer<typeof DetectFieldsInput>
export const DownloadInput = z.object({})
export type DownloadInput = z.infer<typeof DownloadInput>
export const FocusFieldInput = z.object({
  fieldId: z.string().describe("ID of the field to focus and scroll into view."),
})
export type FocusFieldInput = z.infer<typeof FocusFieldInput>
export const GetAnnotatedPageInput = z.object({
  page: z.number().int().describe("1-based page to render, at its current position."),
})
export type GetAnnotatedPageInput = z.infer<typeof GetAnnotatedPageInput>
export const GetDocumentContentInput = z.object({
  extractionMode: z.enum(["auto", "ocr"]).describe("Extraction strategy: 'auto' (default) or 'ocr' to force optical recognition.").optional(),
})
export type GetDocumentContentInput = z.infer<typeof GetDocumentContentInput>
export const GetFieldsInput = z.object({})
export type GetFieldsInput = z.infer<typeof GetFieldsInput>
export const GoToInput = z.object({
  page: z.number().int().describe("1-based page to navigate to."),
})
export type GoToInput = z.infer<typeof GoToInput>
export const LoadDocumentInput = z.object({
  dataUrl: z.string().describe("The document to load: a data URL, or an http(s) URL the editor fetches."),
  name: z.string().describe("Optional display name for the document.").optional(),
  page: z.number().int().describe("Optional 1-based page to open the document on.").optional(),
})
export type LoadDocumentInput = z.infer<typeof LoadDocumentInput>
export const MovePageInput = z.object({
  fromPage: z.number().int().describe("1-based current position of the page to move."),
  toPage: z.number().int().describe("1-based destination position for the page."),
})
export type MovePageInput = z.infer<typeof MovePageInput>
export const RotatePageInput = z.object({
  page: z.number().int().describe("1-based page to rotate."),
})
export type RotatePageInput = z.infer<typeof RotatePageInput>
export const SelectToolInput = z.object({
  tool: z.enum(["TEXT", "SIGNATURE", "PICTURE", "CHECKBOX", "COMB_TEXT"]).nullable().describe("Tool to activate, or null to deselect."),
})
export type SelectToolInput = z.infer<typeof SelectToolInput>
export const SetFieldValueInput = z.object({
  animate: z.boolean().describe("Type a text value out character by character (true, the default) so a person watching the editor can follow the field being filled, or set it at once (false) for headless or batch filling where speed matters. Only text values are typed: checkbox, option, signature, picture and null values are always set at once.").optional(),
  fieldId: z.string().describe("ID of the field to update."),
  value: z.string().nullable().describe("New value for the field, or null to clear it. If the field has options (see the field list), it must be one of them; otherwise a string (text/checkbox), or a data URL or http(s) URL, fetched by the editor (signature/picture), or plain text for a signature, drawn as a typed signature."),
})
export type SetFieldValueInput = z.infer<typeof SetFieldValueInput>
export const SubmitInput = z.object({
  downloadCopy: z.boolean().describe("When true, the signer also receives a downloaded copy on submit."),
})
export type SubmitInput = z.infer<typeof SubmitInput>
