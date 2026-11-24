// camelCase (the SDK surface) <-> snake_case (the editor wire). The bridge applies
// these at the postMessage boundary so the public API reads idiomatically (JS/TS)
// while the wire stays snake_case.
//
// KEYS ONLY: string / number / boolean values pass through untouched, so a field
// value that happens to contain underscores is never mangled. Payload keys are the
// contract's (SDK callers) or an agent's (legacy WebMCP calls also normalize keys);
// `__proto__` is dropped below and the editor validates every payload, so a
// data-controlled key can neither pollute a prototype nor reach an operation unchecked.
// The editor `context` is baked into the iframe URL at mount and never travels as an op payload.

const camelToSnakeKey = (key: string): string => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)

const snakeToCamelKey = (key: string): string =>
  key.replace(/_([a-z])/g, (_match: string, char: string) => char.toUpperCase())

// Only PLAIN objects are descended into; class instances (Date, Map, Set, …) pass
// through untouched, so a non-plain value is never silently flattened to `{}`. (Op
// payloads are JSON, so this is belt-and-braces, but it keeps the transform total.)
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const transformKeysDeep = (value: unknown, mapKey: (key: string) => string): unknown => {
  if (Array.isArray(value)) {
    const items: unknown[] = value
    return items.map((item) => transformKeysDeep(item, mapKey))
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      const mapped = mapKey(key)
      // Defensive: never let a `__proto__` key become an assignment target (prototype
      // pollution). It is never a legitimate operation key, so dropping it is safe.
      if (mapped === '__proto__') {
        continue
      }
      out[mapped] = transformKeysDeep(val, mapKey)
    }
    return out
  }
  return value
}

// Distinguish rejected SDK input from browser transport failures at the bridge boundary.
export class InvalidSdkInputError extends Error {}

// SDK (camelCase) -> wire (snake_case). Strict WebMCP inputs bypass conversion so unknown keys reach validation.
export const toWireData = (input: unknown, strict = false): unknown => transformKeysDeep(input, (key) => {
  // Strict SDK inputs are camelCase: reject wire aliases before conversion can collapse two keys.
  if (strict && key.includes('_')) throw new InvalidSdkInputError('Use camelCase keys for SDK actions.')
  return camelToSnakeKey(key)
})

// wire (snake_case) -> SDK (camelCase), applied to SDK operation results. WebMCP results remain wire-shaped.
// Editor EVENTS are NOT transformed — they are forwarded verbatim (snake) to
// keep the established EmbedEvent contract.
export const fromWireData = (data: unknown): unknown => transformKeysDeep(data, snakeToCamelKey)
