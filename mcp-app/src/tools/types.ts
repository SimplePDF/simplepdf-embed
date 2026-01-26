import { z } from 'zod';

export const FieldType = z.enum(['TEXT', 'BOXED_TEXT', 'CHECKBOX', 'SIGNATURE', 'PICTURE']);
export type FieldType = z.infer<typeof FieldType>;

export const ExtractionMode = z.enum(['auto', 'ocr']);
export type ExtractionMode = z.infer<typeof ExtractionMode>;

export const DisplayPdfInput = z.object({
  url: z.string().describe('URL of the PDF document to load'),
  name: z.string().optional().describe('Display name for the document'),
  page: z.number().int().positive().optional().describe('Initial page to display (1-indexed)'),
});
export type DisplayPdfInput = z.infer<typeof DisplayPdfInput>;

export const AddAnnotationInput = z.object({
  type: FieldType.describe('Type of annotation to add'),
  page: z.number().int().positive().describe('Page number (1-indexed)'),
  x: z.number().describe('X coordinate in PDF points from left'),
  y: z.number().describe('Y coordinate in PDF points from bottom'),
  width: z.number().positive().describe('Width in PDF points'),
  height: z.number().positive().describe('Height in PDF points'),
  value: z.string().optional().describe('Initial value for the annotation'),
});
export type AddAnnotationInput = z.infer<typeof AddAnnotationInput>;

export const ExtractContentInput = z.object({
  extraction_mode: ExtractionMode.optional().default('auto').describe('Extraction mode: auto or ocr'),
});
export type ExtractContentInput = z.infer<typeof ExtractContentInput>;

export const NavigatePageInput = z.object({
  page: z.number().int().positive().describe('Page number to navigate to (1-indexed)'),
});
export type NavigatePageInput = z.infer<typeof NavigatePageInput>;

export const SubmitDocumentInput = z.object({
  download_copy: z.boolean().optional().default(false).describe('Whether to trigger download of the filled PDF'),
});
export type SubmitDocumentInput = z.infer<typeof SubmitDocumentInput>;

export const ClearAnnotationsInput = z.object({
  field_ids: z.array(z.string()).optional().describe('Specific field IDs to remove (omit to clear all)'),
  page: z.number().int().positive().optional().describe('Only clear fields on this page'),
});
export type ClearAnnotationsInput = z.infer<typeof ClearAnnotationsInput>;
