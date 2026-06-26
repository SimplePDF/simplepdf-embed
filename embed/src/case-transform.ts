// camelCase (the SDK surface) <-> snake_case (the editor wire). The bridge applies
// these at the postMessage boundary so the public API reads idiomatically (JS/TS)
// while the wire stays snake_case.
//
// KEYS ONLY: string / number / boolean values pass through untouched, so a field
// value that happens to contain underscores is never mangled. A generic deep
// key-map is safe here because NO operation payload carries an object with
// arbitrary (data-controlled) keys — the only such value, the editor `context`,
// is baked into the iframe URL at mount and never travels as an op payload.

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

// SDK (camelCase) -> wire (snake_case), applied to every outbound request payload.
export const toWireData = (input: unknown): unknown => transformKeysDeep(input, camelToSnakeKey)

// wire (snake_case) -> SDK (camelCase), applied to every inbound operation RESULT
// payload. Editor EVENTS are NOT transformed — they are forwarded verbatim (snake) to
// keep the 1.x EmbedEvent contract.
export const fromWireData = (data: unknown): unknown => transformKeysDeep(data, snakeToCamelKey)
