// LLM-tool-name registry. The bridge owns the schemas (with descriptions)
// in embed-bridge/schemas.ts; this file just enumerates which bridge
// operations are exposed to the LLM and under which snake_case tool name.
// Adding a new LLM tool = add the entry here. Removing one = drop the
// entry. The factory's switch is exhaustive over this union, so any
// addition forces a matching switch arm at compile time.

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
