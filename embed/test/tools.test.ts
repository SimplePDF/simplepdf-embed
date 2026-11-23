import { describe, expect, it } from 'vitest'
import { isSimplePDFToolName, routeToolCall, SIMPLEPDF_TOOLS } from '../src/tools'
import { makeActionsStub } from './helpers'

describe(isSimplePDFToolName.name, () => {
  it('accepts agentic tool names', () => {
    expect(isSimplePDFToolName('getFields')).toBe(true)
    expect(isSimplePDFToolName('buildPdf')).toBe(true)
    expect(isSimplePDFToolName('getDocumentation')).toBe(true)
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
  it('exposes the 18 agentic operations with descriptions + input schemas (loadDocument excluded)', () => {
    const names = Object.keys(SIMPLEPDF_TOOLS)
    expect(names).toHaveLength(18)
    expect(names).not.toContain('loadDocument')
    for (const definition of Object.values(SIMPLEPDF_TOOLS)) {
      expect(typeof definition.description).toBe('string')
      expect(definition.inputSchema).toBeDefined()
    }
  })

  it('carries each description on the tool only, so the model never receives it twice', () => {
    for (const definition of Object.values(SIMPLEPDF_TOOLS)) {
      expect(definition.inputSchema.description).toBeUndefined()
    }
  })
})

describe(routeToolCall.name, () => {
  it('validates input against the tool schema, then dispatches to the matching action', async () => {
    const actions = makeActionsStub()
    await routeToolCall(actions, 'goTo', { page: 2 })
    expect(actions.goTo).toHaveBeenCalledWith({ page: 2 })
  })

  it('routes build actions and the documentation index with camelCase inputs', async () => {
    const actions = makeActionsStub()
    await routeToolCall(actions, 'buildPdf', {
      action: 'build',
      code: 'Hello',
      idempotencyKey: 'first',
    })
    expect(actions.buildPdf).toHaveBeenCalledWith({
      action: 'build',
      code: 'Hello',
      idempotencyKey: 'first',
    })
    await routeToolCall(actions, 'buildPdf', { action: 'status', jobId: 'job' })
    expect(actions.buildPdf).toHaveBeenCalledWith({ action: 'status', jobId: 'job' })
    await routeToolCall(actions, 'getDocumentation', undefined)
    expect(actions.getDocumentation).toHaveBeenCalledWith({})
  })

  // Reject unrecognized keys on each action and in nested assets before dispatch.
  it.each([
    { action: 'build', code: 'Hello', idempotencyKey: 'key', jobId: 'job' },
    { action: 'build', code: 'Hello', idempotencyKey: 'key', inspect: {} },
    { action: 'build', code: 'Hello', idempotencyKey: 'key', assets: [{ path: 'a.png', dataUrl: 'data', extra: true }] },
    { action: 'cancel', jobId: 'job', code: 'Hello' },
    { action: 'build', code: 'Hello' },
  ])('rejects invalid build input without losing fields: %j', async (input) => {
    const actions = makeActionsStub()
    expect(await routeToolCall(actions, 'buildPdf', input)).toMatchObject({
      success: false,
      error: { code: 'bad_request:invalid_input' },
    })
    expect(actions.buildPdf).not.toHaveBeenCalled()
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

  it('rejects a misspelled expected job ID before dispatch', async () => {
    const actions = makeActionsStub()
    const result = await routeToolCall(actions, 'getAnnotatedPage', { page: 1, expectedJobID: 'job' })
    expect(result).toMatchObject({ success: false, error: { code: 'bad_request:invalid_input' } })
    expect(actions.getAnnotatedPage).not.toHaveBeenCalled()
  })

  it.each([{ page: 1 }, { page: 2, expectedJobId: 'job' }])('routes getAnnotatedPage with %j', async (input) => {
    const actions = makeActionsStub()
    await routeToolCall(actions, 'getAnnotatedPage', input)
    expect(actions.getAnnotatedPage).toHaveBeenCalledWith(input)
  })

  it('dispatches no-input tools without requiring input', async () => {
    const actions = makeActionsStub()
    await routeToolCall(actions, 'getFields', undefined)
    expect(actions.getFields).toHaveBeenCalledTimes(1)
  })
})
