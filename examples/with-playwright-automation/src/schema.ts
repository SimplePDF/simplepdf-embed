import { z } from 'zod';

const FieldType = z.enum(['TEXT', 'BOXED_TEXT', 'SIGNATURE', 'PICTURE', 'CHECKBOX']);
type FieldType = z.infer<typeof FieldType>;

const BaseField = z.object({
  x: z.number().describe('X coordinate in PDF points from bottom-left origin'),
  y: z.number().describe('Y coordinate in PDF points from bottom-left origin'),
  width: z.number().positive().describe('Width in PDF points'),
  height: z.number().positive().describe('Height in PDF points'),
  page: z.number().int().positive().describe('1-indexed page number'),
});

const TextField = BaseField.extend({
  type: z.literal('TEXT'),
  value: z.string().optional(),
});

const BoxedTextField = BaseField.extend({
  type: z.literal('BOXED_TEXT'),
  value: z.string().optional(),
});

const CheckboxField = BaseField.extend({
  type: z.literal('CHECKBOX'),
  value: z.boolean().optional(),
});

const SignatureField = BaseField.extend({
  type: z.literal('SIGNATURE'),
  value: z.string().optional().describe('File path, URL, data URL, or plain text (generates typed signature)'),
});

const PictureField = BaseField.extend({
  type: z.literal('PICTURE'),
  value: z.string().optional().describe('File path, URL, or data URL'),
});

const FieldConfig = z.discriminatedUnion('type', [
  TextField,
  BoxedTextField,
  CheckboxField,
  SignatureField,
  PictureField,
]);
type FieldConfig = z.infer<typeof FieldConfig>;

const AutomationConfig = z.object({
  document: z.string().describe('URL or local file path to PDF'),
  fields: z.array(FieldConfig),
});
type AutomationConfig = z.infer<typeof AutomationConfig>;

export { FieldType, FieldConfig, AutomationConfig };
