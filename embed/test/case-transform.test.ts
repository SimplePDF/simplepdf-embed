import { describe, expect, it } from 'vitest'
import { fromWireData, toWireData } from '../src/case-transform'

describe('case-transform', () => {
  it('camelCases wire keys deeply (nested objects + arrays)', () => {
    expect(fromWireData({ fields: [{ field_id: 'f1', total_pages: 3 }] })).toEqual({
      fields: [{ fieldId: 'f1', totalPages: 3 }],
    })
  })

  it('snake_cases SDK keys for the wire', () => {
    expect(toWireData({ fieldId: 'f1', downloadCopy: true, dataUrl: 'd' })).toEqual({
      field_id: 'f1',
      download_copy: true,
      data_url: 'd',
    })
  })

  it('round-trips SDK -> wire -> SDK', () => {
    const sdk = { fieldIds: ['a', 'b'], extractionMode: 'plain', page: 2, value: null }
    expect(fromWireData(toWireData(sdk))).toEqual(sdk)
  })

  it('transforms KEYS only — opaque values (even underscored) are untouched', () => {
    expect(toWireData({ fieldId: 'f', value: 'a_snake_looking_value' })).toEqual({
      field_id: 'f',
      value: 'a_snake_looking_value',
    })
    expect(fromWireData({ field_id: 'f', value: 'leave_me_be' })).toEqual({ fieldId: 'f', value: 'leave_me_be' })
  })

  it('passes primitives, null, and undefined through', () => {
    expect(toWireData(null)).toBe(null)
    expect(toWireData(undefined)).toBe(undefined)
    expect(toWireData('x')).toBe('x')
    expect(fromWireData(42)).toBe(42)
  })

  it('passes arrays of primitives through unchanged', () => {
    expect(toWireData([1, 'a', true, null])).toEqual([1, 'a', true, null])
  })

  it('does not flatten non-plain objects (Date) — passes the instance through', () => {
    const when = new Date(0)
    // A flattened Date would become {}, which would not deep-equal the Date.
    expect(toWireData({ createdAt: when })).toEqual({ created_at: when })
  })

  it('does not allow prototype pollution through a __proto__ key', () => {
    const malicious: unknown = JSON.parse('{"__proto__": {"polluted": true}, "fieldId": "f1"}')
    const out = toWireData(malicious)
    const polluted: unknown = Object.getOwnPropertyDescriptor(Object.prototype, 'polluted')
    expect(polluted).toBeUndefined()
    expect(out).toEqual({ field_id: 'f1' })
  })
})
