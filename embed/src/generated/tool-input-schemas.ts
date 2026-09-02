// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.
// The agentic operations' input schemas as plain JSON Schema with camelCase keys (the
// SDK-side shape; the bridge lowers the keys to the wire). Read only by src/webmcp.ts,
// which is lazy-loaded, so this table never lands in an entry that did not opt in.
import type { AgenticToolName } from './contract'

export type ToolInputSchema = {
  readonly type: 'object'
  readonly properties?: Readonly<Record<string, unknown>>
  readonly required?: readonly string[]
}

export const TOOL_INPUT_SCHEMAS = {
  createField: {"type":"object","properties":{"type":{"type":"string","enum":["TEXT","SIGNATURE","PICTURE","CHECKBOX","COMB_TEXT"],"description":"Field type to create."},"x":{"type":"number","description":"Field x position, in PDF points."},"y":{"type":"number","description":"Field y position, in PDF points."},"width":{"type":"number","description":"Field width, in PDF points."},"height":{"type":"number","description":"Field height, in PDF points."},"page":{"type":"integer","description":"1-based page to place the field on."},"value":{"description":"Optional initial value. A string for text/checkbox fields, or a data URL for signature/picture fields.","type":"string"}},"required":["type","x","y","width","height","page"]},
  deleteFields: {"type":"object","properties":{"fieldIds":{"description":"IDs of the fields to delete. Omit to delete every field on the target page.","type":"array","items":{"type":"string"}},"page":{"description":"1-based page to scope the deletion to. Omit to target all pages.","type":"integer"}}},
  deletePages: {"type":"object","properties":{"pages":{"type":"array","items":{"type":"integer"},"description":"1-based page numbers to delete."}},"required":["pages"]},
  detectFields: {"type":"object"},
  download: {"type":"object"},
  focusField: {"type":"object","properties":{"fieldId":{"type":"string","description":"ID of the field to focus and scroll into view."}},"required":["fieldId"]},
  getDocumentContent: {"type":"object","properties":{"extractionMode":{"description":"Extraction strategy: 'auto' (default) or 'ocr' to force optical recognition.","type":"string","enum":["auto","ocr"]}}},
  getFields: {"type":"object"},
  goTo: {"type":"object","properties":{"page":{"type":"integer","description":"1-based page to navigate to."}},"required":["page"]},
  movePage: {"type":"object","properties":{"fromPage":{"type":"integer","description":"1-based current position of the page to move."},"toPage":{"type":"integer","description":"1-based destination position for the page."}},"required":["fromPage","toPage"]},
  rotatePage: {"type":"object","properties":{"page":{"type":"integer","description":"1-based page to rotate 90 degrees clockwise."}},"required":["page"]},
  selectTool: {"type":"object","properties":{"tool":{"anyOf":[{"type":"string","enum":["TEXT","SIGNATURE","PICTURE","CHECKBOX","COMB_TEXT"]},{"type":"null"}],"description":"Tool to activate, or null to deselect."}},"required":["tool"]},
  setFieldValue: {"type":"object","properties":{"fieldId":{"type":"string","description":"ID of the field to update."},"value":{"anyOf":[{"type":"string"},{"type":"null"}],"description":"New value for the field, or null to clear it. If the field has options (see get_fields), it must be one of them; otherwise a string (text/checkbox) or a data URL (signature/picture)."}},"required":["fieldId","value"]},
  submit: {"type":"object","properties":{"downloadCopy":{"type":"boolean","description":"When true, the signer also receives a downloaded copy on submit."}},"required":["downloadCopy"]},
} as const satisfies Record<AgenticToolName, ToolInputSchema>
