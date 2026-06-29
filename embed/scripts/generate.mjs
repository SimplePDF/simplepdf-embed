// Codegen: derive the package's typed surface from the committed embed-api.json
// (the canonical editor-interface contract). The editor iframe lib is the single
// source of truth; this script is the only consumer that re-materializes it as
// TypeScript. Run via `npm run generate` (wired into prebuild + pretest).
//
// Two outputs, both derived from one source so they cannot hand-drift:
//   - src/generated/contract.ts : zero-runtime-dep plain TS types + const tables
//                                  (locales, error codes, operations, events).
//                                  The zero-dep root imports only from here.
//   - src/generated/schemas.ts  : zod schemas (peer dep). Each schema is compile-time
//                                  drift-guarded against the plain type in contract.ts,
//                                  so a divergence fails `tsc`.
//
// The JSON Schema vocabulary in embed-api.json is closed and small (object/string/
// integer/number/boolean/null/array/enum/const/anyOf), so the emitter below covers
// it exhaustively rather than pulling a general json-schema-to-x dependency.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = join(HERE, '..')
const GENERATED_DIR = join(PKG_ROOT, 'src', 'generated')

const contract = JSON.parse(readFileSync(join(PKG_ROOT, 'embed-api.json'), 'utf8'))

// Join lines with exactly one trailing newline (no trailing blank lines that
// `git diff --check` would flag).
const renderFile = (lines) => `${lines.join('\n').replace(/\n+$/, '')}\n`

// Operations that exist on the wire but are NOT exposed as agentic tools.
// load_document is a host/setup action (the contract description says so).
const NON_AGENTIC_OPERATIONS = new Set(['load_document'])

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

/** snake_case / SCREAMING_SNAKE -> camelCase (GO_TO -> goTo, field_id -> fieldId).
 * Used for method/tool names AND object property keys: the SDK surface is camelCase,
 * while the wire stays snake_case (the bridge transforms between them). */
const toCamel = (name) =>
  name.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())

/** snake_case request_type -> PascalCase type stem (go_to -> GoTo). */
const toPascal = (requestType) => {
  const camel = toCamel(requestType)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

// Known enum sets mapped to named types for a readable generated surface.
// Comparison is order-insensitive on the enum members.
const enumSignature = (members) => [...members].sort().join('|')
const NAMED_ENUMS = new Map()

// ---------------------------------------------------------------------------
// JSON Schema -> TypeScript type
// ---------------------------------------------------------------------------

// The closed vocabulary the emitter understands. A node carrying any other
// keyword (minLength, pattern, format, minimum, additionalProperties, oneOf,
// allOf, $ref, ...) fails loud so a new manifest constraint can never be
// silently dropped from the generated types/schemas.
const KNOWN_SCHEMA_KEYWORDS = new Set([
  'type',
  'enum',
  'const',
  'anyOf',
  'properties',
  'required',
  'items',
  'description',
])
const assertKnownKeywords = (node) => {
  for (const keyword of Object.keys(node)) {
    if (!KNOWN_SCHEMA_KEYWORDS.has(keyword)) {
      throw new Error(
        `Unsupported JSON Schema keyword '${keyword}' in ${JSON.stringify(node)} — extend the generator to honor it`,
      )
    }
  }
}

// Recursively assert every node in a schema tree carries only known keywords, so
// a new constraint anywhere in the manifest (op I/O, events, the error schema, or
// the protocol envelopes) fails the build instead of being silently ignored.
const preflightSchema = (node) => {
  if (typeof node !== 'object' || node === null) {
    return
  }
  assertKnownKeywords(node)
  if (node.properties !== undefined) {
    for (const sub of Object.values(node.properties)) {
      preflightSchema(sub)
    }
  }
  if (node.items !== undefined) {
    preflightSchema(node.items)
  }
  if (Array.isArray(node.anyOf)) {
    for (const sub of node.anyOf) {
      preflightSchema(sub)
    }
  }
}

const tsForEnum = (members) => {
  const named = NAMED_ENUMS.get(enumSignature(members))
  if (named !== undefined) {
    return named
  }
  return members.map((m) => JSON.stringify(m)).join(' | ')
}

// `camelKeys` controls property-key casing: true for OPERATION payloads (the SDK's
// camelCase method args / results — the bridge transforms them to snake on the wire),
// false for EVENT payloads (forwarded to onEmbedEvent VERBATIM, so they keep the
// editor's snake_case to stay compatible with the 1.x EmbedEvent contract).
const tsForNode = (node, camelKeys) => {
  assertKnownKeywords(node)
  if (node.const !== undefined) {
    return JSON.stringify(node.const)
  }
  if (Array.isArray(node.enum)) {
    return tsForEnum(node.enum)
  }
  if (Array.isArray(node.anyOf)) {
    return node.anyOf.map((sub) => tsForNode(sub, camelKeys)).join(' | ')
  }
  switch (node.type) {
    case 'string':
      return 'string'
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'null':
      return 'null'
    case 'array': {
      const item = tsForNode(node.items, camelKeys)
      return /[ |]/.test(item) ? `Array<${item}>` : `${item}[]`
    }
    case 'object':
      return tsForObject(node, camelKeys)
    default:
      throw new Error(`Unsupported JSON Schema node for TS: ${JSON.stringify(node)}`)
  }
}

const tsForObject = (node, camelKeys) => {
  const properties = node.properties ?? {}
  const required = new Set(node.required ?? [])
  const keys = Object.keys(properties)
  if (keys.length === 0) {
    return 'Record<string, never>'
  }
  const members = keys.map((key) => {
    const optional = required.has(key) ? '' : '?'
    return `${camelKeys ? toCamel(key) : key}${optional}: ${tsForNode(properties[key], camelKeys)}`
  })
  return `{ ${members.join('; ')} }`
}

// ---------------------------------------------------------------------------
// JSON Schema -> zod expression
// ---------------------------------------------------------------------------

const describe = (expr, node) =>
  typeof node.description === 'string' ? `${expr}.describe(${JSON.stringify(node.description)})` : expr

const zodForNode = (node, { withDescription }) => {
  assertKnownKeywords(node)
  const base = (() => {
    if (node.const !== undefined) {
      return `z.literal(${JSON.stringify(node.const)})`
    }
    if (Array.isArray(node.enum)) {
      return `z.enum([${node.enum.map((m) => JSON.stringify(m)).join(', ')}])`
    }
    if (Array.isArray(node.anyOf)) {
      // Collapse the common `{...} | { type: 'null' }` shape into `.nullable()`.
      const nonNull = node.anyOf.filter((sub) => sub.type !== 'null')
      const hasNull = node.anyOf.some((sub) => sub.type === 'null')
      if (hasNull && nonNull.length === 1) {
        return `${zodForNode(nonNull[0], { withDescription: false })}.nullable()`
      }
      return `z.union([${node.anyOf.map((sub) => zodForNode(sub, { withDescription: false })).join(', ')}])`
    }
    switch (node.type) {
      case 'string':
        return 'z.string()'
      case 'integer':
        return 'z.number().int()'
      case 'number':
        return 'z.number()'
      case 'boolean':
        return 'z.boolean()'
      case 'null':
        return 'z.null()'
      case 'array':
        return `z.array(${zodForNode(node.items, { withDescription: false })})`
      case 'object':
        return zodForObject(node)
      default:
        throw new Error(`Unsupported JSON Schema node for zod: ${JSON.stringify(node)}`)
    }
  })()
  return withDescription ? describe(base, node) : base
}

const zodForObject = (node) => {
  const properties = node.properties ?? {}
  const required = new Set(node.required ?? [])
  const keys = Object.keys(properties)
  if (keys.length === 0) {
    return 'z.object({})'
  }
  const members = keys.map((key) => {
    const inner = zodForNode(properties[key], { withDescription: true })
    const withOptional = required.has(key) ? inner : `${inner}.optional()`
    return `  ${toCamel(key)}: ${withOptional},`
  })
  return `z.object({\n${members.join('\n')}\n})`
}

// ---------------------------------------------------------------------------
// Extract the closed editor-error code set from editor_error_schema.
// The schema is `anyOf` of object variants; codes appear as `const` on the
// `code` property (either directly, or inside an inner `anyOf` of consts).
// ---------------------------------------------------------------------------

const collectErrorCodes = (schema) => {
  const codes = new Set()
  const visitCodeNode = (codeNode) => {
    if (typeof codeNode.const === 'string') {
      codes.add(codeNode.const)
    }
    if (Array.isArray(codeNode.anyOf)) {
      for (const sub of codeNode.anyOf) {
        visitCodeNode(sub)
      }
    }
  }
  for (const variant of schema.anyOf ?? []) {
    const codeNode = variant.properties?.code
    if (codeNode !== undefined) {
      visitCodeNode(codeNode)
    }
  }
  return [...codes].sort()
}

// ---------------------------------------------------------------------------
// Resolve the named enum aliases against the real contract, then build outputs.
// ---------------------------------------------------------------------------

// Fail-loud preflight over every JSON Schema root in the manifest.
for (const op of contract.operations) {
  preflightSchema(op.input_schema)
  preflightSchema(op.output_schema)
}
for (const event of contract.events) {
  preflightSchema(event.payload_schema)
}
preflightSchema(contract.editor_error_schema)
preflightSchema(contract.protocol.request_envelope_schema)
preflightSchema(contract.protocol.result_envelope_schema)

// Keyed by lowercase request_type so the hardcoded lookups below are agnostic to
// the manifest's request_type casing (snake_case or SCREAMING_SNAKE).
const operationsByType = Object.fromEntries(
  contract.operations.map((op) => [op.request_type.toLowerCase(), op]),
)

const fieldRecordSchema = operationsByType.get_fields.output_schema.properties.fields.items
const fieldTypes = fieldRecordSchema.properties.type.enum
const overlayToolTypes = operationsByType.create_field.input_schema.properties.type.enum
const extractionModes = operationsByType.get_document_content.input_schema.properties.extraction_mode.enum

NAMED_ENUMS.set(enumSignature(fieldTypes), 'FieldType')
NAMED_ENUMS.set(enumSignature(overlayToolTypes), 'OverlayToolType')
NAMED_ENUMS.set(enumSignature(extractionModes), 'ExtractionMode')
NAMED_ENUMS.set(enumSignature(contract.locales), 'Locale')

const editorErrorCodes = collectErrorCodes(contract.editor_error_schema)

const constArray = (name, values, typeName) => {
  const literals = values.map((v) => JSON.stringify(v)).join(', ')
  return (
    `export const ${name} = [${literals}] as const\n` +
    `export type ${typeName} = (typeof ${name})[number]\n`
  )
}

// --- contract.ts (zero runtime deps) ---------------------------------------

const contractLines = []
contractLines.push('// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.')
contractLines.push('// Zero runtime dependencies: the zero-dep root imports only from this module.')
contractLines.push('')
contractLines.push(constArray('LOCALES', contract.locales, 'Locale'))
contractLines.push(constArray('EDITOR_ERROR_CODES', editorErrorCodes, 'EditorErrorCode'))
contractLines.push(constArray('FIELD_TYPES', fieldTypes, 'FieldType'))
contractLines.push(constArray('OVERLAY_TOOL_TYPES', overlayToolTypes, 'OverlayToolType'))
contractLines.push(constArray('EXTRACTION_MODES', extractionModes, 'ExtractionMode'))

// Per-operation input/output types.
for (const op of contract.operations) {
  const stem = toPascal(op.request_type)
  contractLines.push(`export type ${stem}Input = ${tsForNode(op.input_schema, true)}`)
  contractLines.push(`export type ${stem}Output = ${tsForNode(op.output_schema, true)}`)
}
contractLines.push('')

// Ergonomic aliases over the get_document_content output shape.
contractLines.push('export type DocumentContentResult = GetDocumentContentOutput')
contractLines.push("export type DocumentContentPage = GetDocumentContentOutput['pages'][number]")
contractLines.push('')

// The typed `details` payload carried by the one error code that has them, derived
// from editor_error_schema so the package's BridgeError never restates it.
const missingFieldsVariant = (contract.editor_error_schema.anyOf ?? []).find(
  (variant) => variant.properties?.code?.const === 'bad_request:missing_required_fields',
)
if (missingFieldsVariant?.properties?.details === undefined) {
  throw new Error('embed-api.json: the bad_request:missing_required_fields variant lacks a details schema')
}
contractLines.push(
  `export type MissingRequiredFieldsDetails = ${tsForNode(missingFieldsVariant.properties.details, true)}`,
)
contractLines.push('')

// Outbound event payload types.
for (const event of contract.events) {
  const stem = event.event_type
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase())
  contractLines.push(`export type ${stem}Payload = ${tsForNode(event.payload_schema, false)}`)
}
contractLines.push('')

// Operation metadata table (the camelCase `method` is the SDK method + agentic tool name).
const opMeta = contract.operations.map((op) => {
  const stem = toPascal(op.request_type)
  return (
    `  {\n` +
    `    request_type: ${JSON.stringify(op.request_type)},\n` +
    `    wire_type: ${JSON.stringify(op.request_type.toUpperCase())},\n` +
    `    method: ${JSON.stringify(toCamel(op.request_type))},\n` +
    `    description: ${JSON.stringify(op.description)},\n` +
    `    error_codes: [${op.error_codes.map((c) => JSON.stringify(c)).join(', ')}] as const,\n` +
    `    is_agentic_tool: ${!NON_AGENTIC_OPERATIONS.has(op.request_type.toLowerCase())},\n` +
    `    has_output: ${op.output_schema.type !== 'null'},\n` +
    `  } /* ${stem} */`
  )
})
contractLines.push(`export const OPERATIONS = [\n${opMeta.join(',\n')},\n] as const`)
contractLines.push('')
contractLines.push('export type WireType = (typeof OPERATIONS)[number]["wire_type"]')
contractLines.push('export type RequestType = (typeof OPERATIONS)[number]["request_type"]')
// The JS method/tool name is the camelCase of the wire op (the SDK is camelCase;
// the bridge transforms to the snake_case wire). The drift guard checks IframeActions
// matches MethodName.
contractLines.push('export type MethodName = (typeof OPERATIONS)[number]["method"]')
contractLines.push(
  'export type AgenticToolName = Extract<(typeof OPERATIONS)[number], { is_agentic_tool: true }>["method"]',
)
contractLines.push('')

const eventMeta = contract.events.map(
  (event) =>
    `  { event_type: ${JSON.stringify(event.event_type)}, description: ${JSON.stringify(event.description)} }`,
)
contractLines.push(`export const OUTBOUND_EVENTS = [\n${eventMeta.join(',\n')},\n] as const`)
contractLines.push('export type OutboundEventType = (typeof OUTBOUND_EVENTS)[number]["event_type"]')
contractLines.push('')

mkdirSync(GENERATED_DIR, { recursive: true })
writeFileSync(join(GENERATED_DIR, 'contract.ts'), renderFile(contractLines))

// --- schemas.ts (zod peer dep + compile-time drift guards) -----------------

const schemaLines = []
schemaLines.push('// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.')
schemaLines.push("import { z } from 'zod'")
schemaLines.push('')

for (const op of contract.operations) {
  const stem = toPascal(op.request_type)
  schemaLines.push(`export const ${stem}Input = ${zodForNode(op.input_schema, { withDescription: true })}`)
  // Value + type share the PascalCase name (the canonical zod idiom).
  schemaLines.push(`export type ${stem}Input = z.infer<typeof ${stem}Input>`)
}
schemaLines.push('')

writeFileSync(join(GENERATED_DIR, 'schemas.ts'), renderFile(schemaLines))

// --- drift.ts (compile-time drift guards; type-checked, not bundled) --------
// One exported tuple gathers every guard so noUnusedLocals stays happy while the
// type-parameter constraints still fail the build the instant a representation
// diverges. Imported by nothing; pure type-level (no runtime).

const driftLines = []
driftLines.push('// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.')
driftLines.push("import type { EditorEvent, IframeActions } from '../types'")
driftLines.push("import type * as Schemas from './schemas'")
driftLines.push("import type * as Contract from './contract'")
driftLines.push('')
driftLines.push('type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false')
driftLines.push('type Extends<A, B> = [A] extends [B] ? true : false')
driftLines.push('type AssertTrue<T extends true> = T')
driftLines.push('')
driftLines.push('// IframeActions method set must exactly equal the generated operation methods,')
driftLines.push('// each zod schema must stay mutually assignable to its plain contract type, and')
driftLines.push('// every generated outbound event must appear in the hand-maintained EditorEvent union')
driftLines.push("// (so React's onEmbedEvent forwarders, guarded against EditorEvent, can't miss one).")
driftLines.push('export type DriftGuards = [')
driftLines.push("  AssertTrue<Exact<keyof IframeActions, Contract.MethodName>>,")
driftLines.push("  AssertTrue<Extends<Contract.OutboundEventType, EditorEvent['type']>>,")
for (const op of contract.operations) {
  const stem = toPascal(op.request_type)
  driftLines.push(`  AssertTrue<Exact<Schemas.${stem}Input, Contract.${stem}Input>>,`)
}
driftLines.push(']')
driftLines.push('')

writeFileSync(join(GENERATED_DIR, 'drift.ts'), renderFile(driftLines))

// --- tools.ts (agentic tool registry: name -> { description, inputSchema }) --

const agenticOperations = contract.operations.filter(
  (op) => !NON_AGENTIC_OPERATIONS.has(op.request_type.toLowerCase()),
)
const toolLines = []
toolLines.push('// AUTO-GENERATED from embed-api.json by scripts/generate.mjs. Do not edit by hand.')
toolLines.push("import * as Schemas from './schemas'")
toolLines.push('')
toolLines.push('// The agentic tool registry. Each tool name is the camelCase operation name;')
toolLines.push('// load_document is excluded (it is a host/setup action, not an agentic tool).')
toolLines.push('export const TOOL_DEFINITIONS = {')
for (const op of agenticOperations) {
  const stem = toPascal(op.request_type)
  toolLines.push(
    `  ${toCamel(op.request_type)}: { description: ${JSON.stringify(op.description)}, inputSchema: Schemas.${stem}Input },`,
  )
}
toolLines.push('} as const')
toolLines.push('')
toolLines.push('export type SimplePDFToolName = keyof typeof TOOL_DEFINITIONS')
toolLines.push('')

writeFileSync(join(GENERATED_DIR, 'tools.ts'), renderFile(toolLines))

console.log(
  `Generated contract.ts (${contract.operations.length} ops, ${contract.events.length} events, ` +
    `${contract.locales.length} locales, ${editorErrorCodes.length} editor error codes) + schemas.ts`,
)
