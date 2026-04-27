import type { z } from 'zod'
import {
  DeleteFieldsInput,
  DeletePagesInput,
  DetectFieldsInput,
  FocusFieldInput,
  GetDocumentContentInput,
  GetFieldsInput,
  GoToInput,
  MovePageInput,
  RotatePageInput,
  SelectToolInput,
  SetFieldValueInput,
} from '../../embed-bridge'

// LLM-tool adapter for the bridge. The bridge owns the schemas (with
// descriptions) in embed-bridge/schemas.ts; this file enumerates which
// bridge operations are exposed to the LLM, under which snake_case tool
// name, and pulls each description verbatim from the bridge schema's
// `.describe()` — no duplicated text.
//
// Adding a new LLM tool: add an entry to LLM_STATIC_TOOLS, add the snake
// name to CLIENT_TOOL_NAMES, add a switch arm in factory.ts. The switch
// is exhaustive over ClientToolName, so any addition forces a matching
// arm at compile time.

const tool = <TSchema extends z.ZodType>(inputSchema: TSchema): { description: string; inputSchema: TSchema } => ({
  description: inputSchema.description ?? '',
  inputSchema,
})

export const LLM_STATIC_TOOLS = {
  get_fields: tool(GetFieldsInput),
  get_document_content: tool(GetDocumentContentInput),
  detect_fields: tool(DetectFieldsInput),
  delete_fields: tool(DeleteFieldsInput),
  select_tool: tool(SelectToolInput),
  set_field_value: tool(SetFieldValueInput),
  focus_field: tool(FocusFieldInput),
  go_to_page: tool(GoToInput),
  move_page: tool(MovePageInput),
  delete_pages: tool(DeletePagesInput),
  rotate_page: tool(RotatePageInput),
} as const

export const CLIENT_TOOL_NAMES = [
  'get_fields',
  'get_document_content',
  'detect_fields',
  'delete_fields',
  'select_tool',
  'set_field_value',
  'focus_field',
  'go_to_page',
  'move_page',
  'delete_pages',
  'rotate_page',
  'submit',
  'download',
] as const

export type ClientToolName = (typeof CLIENT_TOOL_NAMES)[number]

export const isClientToolName = (value: unknown): value is ClientToolName =>
  typeof value === 'string' && CLIENT_TOOL_NAMES.some((candidate) => candidate === value)
