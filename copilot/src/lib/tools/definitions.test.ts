import { describe, expect, it } from 'vitest'
import { buildCopilotToolDefinitions, isCopilotToolName } from './definitions'

describe('copilot tool catalogue', () => {
  const names = Object.keys(buildCopilotToolDefinitions())

  it('never exposes create_field or load_document', () => {
    expect(names).not.toContain('create_field')
    expect(names).not.toContain('load_document')
  })

  it('exposes exactly one finalisation tool (submit XOR download)', () => {
    const finalisation = names.filter((name) => name === 'submit' || name === 'download')
    expect(finalisation).toHaveLength(1)
  })

  it('exposes the core read/write tools the prompt drives', () => {
    expect(names).toEqual(
      expect.arrayContaining([
        'get_fields',
        'get_document_content',
        'detect_fields',
        'select_tool',
        'set_field_value',
        'focus_field',
        'go_to',
      ]),
    )
  })

  it('every definition carries a description + input schema', () => {
    for (const definition of Object.values(buildCopilotToolDefinitions())) {
      expect(typeof definition.description).toBe('string')
      expect(definition.inputSchema).toBeDefined()
    }
  })

  it('isCopilotToolName allows the catalogue and rejects everything else', () => {
    for (const name of names) {
      expect(isCopilotToolName(name)).toBe(true)
    }
    expect(isCopilotToolName('create_field')).toBe(false)
    expect(isCopilotToolName('load_document')).toBe(false)
    expect(isCopilotToolName('not_a_tool')).toBe(false)
    expect(isCopilotToolName(42)).toBe(false)
  })
})
