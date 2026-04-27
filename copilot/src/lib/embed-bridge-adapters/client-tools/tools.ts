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

// LLM tool registration map. Each entry pulls its description verbatim
// from the bridge schema's `.describe()` — no duplication. Spread into
// streamText({ tools: withFinalisationTool(LLM_STATIC_TOOLS) }) on both
// the /api/chat and BYOK paths. Adding a new LLM tool is one line here +
// one switch arm in `factory.ts`.
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
