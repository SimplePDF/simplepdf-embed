import { describe, expect, it, vi } from 'vitest'
import { isSimplePDFToolName, routeToolCall, SIMPLEPDF_TOOLS } from '../src/tools'
import type { BridgeResult, IframeActions } from '../src/types'

const okResult: BridgeResult<unknown> = { success: true, data: null }

const makeActionsStub = (): IframeActions => {
  const method = (): Promise<BridgeResult<unknown>> => Promise.resolve(okResult)
  return {
    createField: vi.fn(method),
    deleteFields: vi.fn(method),
    deletePages: vi.fn(method),
    detectFields: vi.fn(method),
    download: vi.fn(method),
    focusField: vi.fn(method),
    getDocumentContent: vi.fn(method),
    getFields: vi.fn(method),
    goTo: vi.fn(method),
    loadDocument: vi.fn(method),
    movePage: vi.fn(method),
    rotatePage: vi.fn(method),
    selectTool: vi.fn(method),
    setFieldValue: vi.fn(method),
    submit: vi.fn(method),
  }
}

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
