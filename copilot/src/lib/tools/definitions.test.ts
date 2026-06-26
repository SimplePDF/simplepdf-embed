import { describe, expect, it } from 'vitest'
import { buildCopilotToolDefinitions, isCopilotToolName } from './definitions'

describe('copilot tool catalogue', () => {
  const names = Object.keys(buildCopilotToolDefinitions())

  it('never exposes createField or loadDocument', () => {
    expect(names).not.toContain('createField')
    expect(names).not.toContain('loadDocument')
  })

  it('exposes exactly one finalisation tool (submit XOR download)', () => {
    const finalisation = names.filter((name) => name === 'submit' || name === 'download')
    expect(finalisation).toHaveLength(1)
  })

  it('exposes the core read/write tools the prompt drives', () => {
    expect(names).toEqual(
      expect.arrayContaining([
        'getFields',
        'getDocumentContent',
        'detectFields',
        'selectTool',
        'setFieldValue',
        'focusField',
        'goTo',
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
    expect(isCopilotToolName('createField')).toBe(false)
    expect(isCopilotToolName('loadDocument')).toBe(false)
    expect(isCopilotToolName('not_a_tool')).toBe(false)
    expect(isCopilotToolName(42)).toBe(false)
  })
})
