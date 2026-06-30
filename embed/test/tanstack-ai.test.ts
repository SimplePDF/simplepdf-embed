import { describe, expect, it } from 'vitest'
import { createSimplePDFTools, simplePDFToolDefinitions } from '../src/tanstack-ai'
import type { BridgeResult } from '../src/types'
import { makeEmbedStub } from './helpers'

describe('simplePDFToolDefinitions', () => {
  it('returns the 14 agentic operations as execute-less definitions (loadDocument excluded)', () => {
    const definitions = simplePDFToolDefinitions()
    expect(definitions).toHaveLength(14)
    expect(definitions.map((definition) => definition.name)).not.toContain('loadDocument')
    for (const definition of definitions) {
      expect(typeof definition.description).toBe('string')
      expect(definition.inputSchema).toBeDefined()
    }
  })
})

describe('createSimplePDFTools', () => {
  it('produces a client tool for each of the 14 agentic operations', () => {
    const tools = createSimplePDFTools({ embed: makeEmbedStub() })
    expect(tools).toHaveLength(14)
    expect(tools.every((tool) => typeof tool.execute === 'function')).toBe(true)
  })

  it('binds each tool to the editor: a client call validates input + dispatches to the matching action', async () => {
    const embed = makeEmbedStub()
    const goTo = createSimplePDFTools({ embed }).find((tool) => tool.name === 'goTo')
    if (goTo === undefined || goTo.execute === undefined) {
      throw new Error('expected a goTo client tool with an execute')
    }
    await goTo.execute({ page: 2 })
    expect(embed.actions.goTo).toHaveBeenCalledWith({ page: 2 })
  })

  it('returns bad_request:invalid_input on schema-invalid input without dispatching', async () => {
    const embed = makeEmbedStub()
    const goTo = createSimplePDFTools({ embed }).find((tool) => tool.name === 'goTo')
    if (goTo === undefined || goTo.execute === undefined) {
      throw new Error('expected a goTo client tool with an execute')
    }
    const result: BridgeResult<unknown> = await goTo.execute({ page: 'not-a-number' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('bad_request:invalid_input')
    }
    expect(embed.actions.goTo).not.toHaveBeenCalled()
  })
})
