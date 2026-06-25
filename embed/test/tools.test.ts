import { describe, expect, it, vi } from 'vitest'
import { isSimplePDFToolName, routeToolCall, SIMPLEPDF_TOOLS } from '../src/tools'
import type { BridgeResult, Embed } from '../src/types'

const okResult: BridgeResult<unknown> = { success: true, data: null }

const makeEmbedStub = (): Embed => {
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
    getState: () => ({ kind: 'document_loaded', documentId: 'doc_1' }),
    on: () => () => {},
    dispose: () => {},
    state: { kind: 'document_loaded', documentId: 'doc_1' },
    iframe: null,
  }
}

describe(isSimplePDFToolName.name, () => {
  it('accepts agentic tool names', () => {
    expect(isSimplePDFToolName('get_fields')).toBe(true)
    expect(isSimplePDFToolName('go_to')).toBe(true)
    expect(isSimplePDFToolName('create_field')).toBe(true)
  })

  it('rejects load_document (host/setup, not an agentic tool) and unknown names', () => {
    expect(isSimplePDFToolName('load_document')).toBe(false)
    expect(isSimplePDFToolName('not_a_tool')).toBe(false)
    expect(isSimplePDFToolName(42)).toBe(false)
  })
})

describe('SIMPLEPDF_TOOLS', () => {
  it('exposes the 14 agentic operations with descriptions + input schemas (load_document excluded)', () => {
    const names = Object.keys(SIMPLEPDF_TOOLS)
    expect(names).toHaveLength(14)
    expect(names).not.toContain('load_document')
    for (const definition of Object.values(SIMPLEPDF_TOOLS)) {
      expect(typeof definition.description).toBe('string')
      expect(definition.inputSchema).toBeDefined()
    }
  })
})

describe(routeToolCall.name, () => {
  it('validates input against the tool schema, then dispatches to the matching bridge method', async () => {
    const embed = makeEmbedStub()
    await routeToolCall(embed, 'go_to', { page: 2 })
    expect(embed.goTo).toHaveBeenCalledWith({ page: 2 })
  })

  it('returns bad_request:invalid_input on schema-invalid input without dispatching', async () => {
    const embed = makeEmbedStub()
    const result = await routeToolCall(embed, 'go_to', { page: 'not-a-number' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('bad_request:invalid_input')
    }
    expect(embed.goTo).not.toHaveBeenCalled()
  })

  it('dispatches no-input tools without requiring input', async () => {
    const embed = makeEmbedStub()
    await routeToolCall(embed, 'get_fields', undefined)
    expect(embed.getFields).toHaveBeenCalledTimes(1)
  })
})
