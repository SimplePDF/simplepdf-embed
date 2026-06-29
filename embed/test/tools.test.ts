import { describe, expect, it } from 'vitest'
import { isSimplePDFToolName, routeToolCall, SIMPLEPDF_TOOLS } from '../src/tools'
import { makeActionsStub } from './helpers'

describe(isSimplePDFToolName.name, () => {
  it('accepts agentic tool names', () => {
    expect(isSimplePDFToolName('getFields')).toBe(true)
    expect(isSimplePDFToolName('goTo')).toBe(true)
    expect(isSimplePDFToolName('createField')).toBe(true)
  })

  it('rejects loadDocument (host/setup, not an agentic tool) and unknown names', () => {
    expect(isSimplePDFToolName('loadDocument')).toBe(false)
    expect(isSimplePDFToolName('not_a_tool')).toBe(false)
    expect(isSimplePDFToolName(42)).toBe(false)
  })
})

describe('SIMPLEPDF_TOOLS', () => {
  it('exposes the 14 agentic operations with descriptions + input schemas (loadDocument excluded)', () => {
    const names = Object.keys(SIMPLEPDF_TOOLS)
    expect(names).toHaveLength(14)
    expect(names).not.toContain('loadDocument')
    for (const definition of Object.values(SIMPLEPDF_TOOLS)) {
      expect(typeof definition.description).toBe('string')
      expect(definition.inputSchema).toBeDefined()
    }
  })
})

describe(routeToolCall.name, () => {
  it('validates input against the tool schema, then dispatches to the matching action', async () => {
    const actions = makeActionsStub()
    await routeToolCall(actions, 'goTo', { page: 2 })
    expect(actions.goTo).toHaveBeenCalledWith({ page: 2 })
  })

  it('returns bad_request:invalid_input on schema-invalid input without dispatching', async () => {
    const actions = makeActionsStub()
    const result = await routeToolCall(actions, 'goTo', { page: 'not-a-number' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('bad_request:invalid_input')
    }
    expect(actions.goTo).not.toHaveBeenCalled()
  })

  it('dispatches no-input tools without requiring input', async () => {
    const actions = makeActionsStub()
    await routeToolCall(actions, 'getFields', undefined)
    expect(actions.getFields).toHaveBeenCalledTimes(1)
  })
})
