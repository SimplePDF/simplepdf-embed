import type { BridgeError } from '@simplepdf/embed'
import { describe, expect, it } from 'vitest'
import { toToolErrorText, wrapToolData } from './tool_output'

describe(toToolErrorText.name, () => {
  it('reads as code and message when the error carries no details', () => {
    const error: BridgeError = { code: 'bad_request:field_not_found', message: 'Field f_9 not found' }
    expect(toToolErrorText(error)).toBe('bad_request:field_not_found: Field f_9 not found')
  })

  // Without the failures the model only learns "1 of 2 updates were rejected" and cannot
  // correct the batch, so nothing the user gave lands.
  it("hands the model a rejected batch's failures, inside the untrusted envelope", () => {
    const error: BridgeError = {
      code: 'bad_request:batch_validation_failed',
      message: '1 of 2 updates were rejected, so no field changed',
      details: {
        failures: [
          { fieldId: 'country', code: 'bad_request:invalid_value', message: 'Invalid dropdown option: "FR"' },
        ],
      },
    }
    const [summary, envelope] = toToolErrorText(error).split('\n')
    expect(summary).toBe(
      'bad_request:batch_validation_failed: 1 of 2 updates were rejected, so no field changed',
    )
    expect(JSON.parse(envelope ?? '')).toMatchObject({ __untrusted_data: true, data: error.details })
  })
})

describe(wrapToolData.name, () => {
  it('wraps iframe data in the untrusted envelope', () => {
    expect(wrapToolData({ fields: [] })).toMatchObject({ __untrusted_data: true, data: { fields: [] } })
  })
})
