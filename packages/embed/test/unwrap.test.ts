import { describe, expect, it } from 'vitest'
import { BridgeUnwrapError, unwrap } from '../src/unwrap'
import type { BridgeResult } from '../src/types'

describe(unwrap.name, () => {
  it('returns data for a successful result', () => {
    const result: BridgeResult<{ detected_count: number }> = { success: true, data: { detected_count: 3 } }
    expect(unwrap(result)).toEqual({ detected_count: 3 })
  })

  it('throws BridgeUnwrapError carrying the typed error for a failed result', () => {
    const result: BridgeResult<null> = {
      success: false,
      error: { code: 'forbidden:editing_not_allowed', message: 'Editing is disabled' },
    }
    try {
      unwrap(result)
      throw new Error('expected unwrap to throw')
    } catch (caught) {
      expect(caught).toBeInstanceOf(BridgeUnwrapError)
      if (caught instanceof BridgeUnwrapError) {
        expect(caught.error.code).toBe('forbidden:editing_not_allowed')
        expect(caught.message).toBe('Editing is disabled')
      }
    }
  })
})
