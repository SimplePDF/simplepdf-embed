import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachEmbed, type AttachEmbedArgs } from '../src/bridge'
import type { BridgeLogger } from '../src/logger'
import type { Embed } from '../src/types'

const EDITOR_ORIGIN = 'https://tenant.simplepdf.com'

// The slice of a WebMCP tool descriptor these tests read back.
type RegisteredTool = {
  name: string
  description: string
  inputSchema: { type: string; properties?: Record<string, unknown>; required?: readonly string[] }
  annotations: { readOnlyHint?: boolean; untrustedContentHint?: boolean; destructiveHint?: boolean }
  execute: (input: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
}
type FakeModelContext = {
  registerTool: (tool: RegisteredTool, options: { signal: AbortSignal }) => void
  registered: RegisteredTool[]
  liveToolNames: () => string[]
}

const originalDocumentModelContext = Object.getOwnPropertyDescriptor(document, 'modelContext')
const originalNavigatorModelContext = Object.getOwnPropertyDescriptor(navigator, 'modelContext')

const restoreModelContext = (target: object, descriptor: PropertyDescriptor | undefined): void => {
  if (descriptor === undefined) {
    Reflect.deleteProperty(target, 'modelContext')
    return
  }
  Object.defineProperty(target, 'modelContext', descriptor)
}

// A minimal native-like model context: it records registrations and drops a tool from
// the live set when its registration signal aborts (the spec's unregister mechanism).
const installModelContext = (
  host: Document | Navigator,
  { rejectTool }: { rejectTool?: string } = {},
): FakeModelContext => {
  const registered: RegisteredTool[] = []
  const liveTools = new Set<string>()
  const modelContext: FakeModelContext = {
    registerTool: (tool, { signal }) => {
      if (tool.name === rejectTool) {
        throw new Error(`runtime rejected ${tool.name}`)
      }
      registered.push(tool)
      liveTools.add(tool.name)
      signal.addEventListener('abort', () => liveTools.delete(tool.name), { once: true })
    },
    registered,
    liveToolNames: () => [...liveTools],
  }
  Object.defineProperty(host, 'modelContext', { configurable: true, value: modelContext })
  return modelContext
}

const makeLogger = (): BridgeLogger => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })

type Posted = { type: string; request_id: string; data: unknown }
type Harness = {
  embed: Embed
  posted: Posted[]
  reply: (request: Posted, result: unknown) => void
  // Registration waits for the editor to be alive; these are the editor's lifecycle announcements.
  markEditorReady: () => void
  markDocumentLoaded: () => void
}

const harnesses: Harness[] = []

const makeHarness = (args: Pick<AttachEmbedArgs, 'enableWebMCP' | 'logger'>): Harness => {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  const contentWindow = iframe.contentWindow
  if (contentWindow === null) {
    throw new Error('jsdom iframe has no contentWindow')
  }
  const posted: Posted[] = []
  vi.spyOn(contentWindow, 'postMessage').mockImplementation((message: unknown) => {
    if (typeof message === 'string') {
      posted.push(JSON.parse(message))
    }
  })
  const embed = attachEmbed({ getIframe: () => iframe, editorOrigin: EDITOR_ORIGIN, ...args })
  const receive = (message: unknown): void => {
    window.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(message), origin: EDITOR_ORIGIN, source: contentWindow }),
    )
  }
  const harness: Harness = {
    embed,
    posted,
    reply: (request, result) => receive({ type: 'REQUEST_RESULT', data: { request_id: request.request_id, result } }),
    markEditorReady: () => receive({ type: 'EDITOR_READY', data: {} }),
    markDocumentLoaded: () => receive({ type: 'DOCUMENT_LOADED', data: { document_id: 'doc1' } }),
  }
  harnesses.push(harness)
  return harness
}

// A ready embed with the option on: registration is asynchronous (the WebMCP module
// is lazy-loaded), so callers wait for the expected tool count rather than reading it
// synchronously.
const mountReady = (args: Pick<AttachEmbedArgs, 'enableWebMCP' | 'logger'>): Harness => {
  const harness = makeHarness(args)
  harness.markEditorReady()
  return harness
}

const waitForTools = (modelContext: FakeModelContext, count: number): Promise<void> =>
  vi.waitFor(() => expect(modelContext.registered).toHaveLength(count))

const AGENTIC_TOOL_NAMES = [
  'createField',
  'deleteFields',
  'deletePages',
  'detectFields',
  'download',
  'focusField',
  'getDocumentContent',
  'getFields',
  'goTo',
  'movePage',
  'rotatePage',
  'selectTool',
  'setFieldValue',
  'submit',
]

// The bridge's readiness probe posts its own GET_FIELDS requests while the editor is
// booting, so a tool call's request is located by type rather than by position.
const waitForRequest = async (harness: Harness, type: string): Promise<Posted> => {
  await vi.waitFor(() => expect(harness.posted.some((message) => message.type === type)).toBe(true))
  const request = harness.posted.find((message) => message.type === type)
  if (request === undefined) {
    throw new Error(`no ${type} request posted`)
  }
  return request
}

const findTool = (modelContext: FakeModelContext, name: string): RegisteredTool => {
  const tool = modelContext.registered.find((candidate) => candidate.name === name)
  if (tool === undefined) {
    throw new Error(`tool ${name} was not registered`)
  }
  return tool
}

describe('attachEmbed({ enableWebMCP })', () => {
  afterEach(() => {
    for (const harness of harnesses) {
      harness.embed.lifecycle.dispose()
    }
    harnesses.length = 0
    document.body.innerHTML = ''
    restoreModelContext(document, originalDocumentModelContext)
    restoreModelContext(navigator, originalNavigatorModelContext)
    vi.restoreAllMocks()
  })

  it('registers every agentic operation on document.modelContext with the SDK name, description, camelCase input schema and an explicit behavior hint', async () => {
    const modelContext = installModelContext(document)
    mountReady({ enableWebMCP: true })
    await waitForTools(modelContext, 14)

    expect(modelContext.registered.map((tool) => tool.name).sort()).toEqual(AGENTIC_TOOL_NAMES)
    expect(modelContext.liveToolNames()).toHaveLength(14)
    const setFieldValue = findTool(modelContext, 'setFieldValue')
    expect(setFieldValue.description).toMatch(/^Set the value of an existing field/)
    expect(setFieldValue.inputSchema.type).toBe('object')
    expect(Object.keys(setFieldValue.inputSchema.properties ?? {})).toEqual(['fieldId', 'value'])
    expect(setFieldValue.inputSchema.required).toEqual(['fieldId', 'value'])
    for (const tool of modelContext.registered) {
      const hasExplicitHint = tool.annotations.readOnlyHint === true || typeof tool.annotations.destructiveHint === 'boolean'
      expect(hasExplicitHint, `${tool.name} declares no behavior hint`).toBe(true)
    }
    // The readers hand document-derived content to the agent: read-only AND untrusted.
    expect(findTool(modelContext, 'getFields').annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true })
    expect(findTool(modelContext, 'getDocumentContent').annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    })
    expect(findTool(modelContext, 'submit').annotations).toEqual({ destructiveHint: true })
  })

  it('waits for the editor to be ready before registering, so an early tool call cannot post into a listener-less iframe', async () => {
    const modelContext = installModelContext(document)
    const registerTool = vi.spyOn(modelContext, 'registerTool')
    const booting = makeHarness({ enableWebMCP: true })
    // Control: a second, ready embed proves the lazy path had time to run while the
    // booting one still registered nothing.
    const control = installModelContext(navigator)
    mountReady({ enableWebMCP: true })
    await waitForTools(control, 0)
    expect(registerTool).not.toHaveBeenCalled()

    booting.markEditorReady()
    await waitForTools(modelContext, 14)
  })

  it('withholds the excluded operations and registers the rest', async () => {
    const modelContext = installModelContext(document)
    const logger = makeLogger()
    mountReady({ enableWebMCP: { exclude: ['submit', 'deletePages', 'movePage', 'rotatePage'] }, logger })
    await waitForTools(modelContext, 10)

    const names = modelContext.registered.map((tool) => tool.name)
    expect(names).toContain('setFieldValue')
    expect(names).toContain('getFields')
    expect(names).not.toContain('submit')
    expect(names).not.toContain('deletePages')
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('executes a tool call as the operation request on the wire and returns the editor Result as a JSON-text tool result', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ enableWebMCP: true })
    await waitForTools(modelContext, 14)

    const pendingResult = findTool(modelContext, 'setFieldValue').execute({ fieldId: 'f1', value: 'Jane' })
    const request = await waitForRequest(harness, 'SET_FIELD_VALUE')
    expect(request.data).toEqual({ field_id: 'f1', value: 'Jane' })
    harness.reply(request, { success: true })
    const toolResult = await pendingResult
    expect(toolResult.isError).toBeUndefined()
    expect(JSON.parse(toolResult.content[0]?.text ?? '')).toEqual({ success: true, data: null })
  })

  it('flags a failed editor Result as an error tool result that still carries the error code', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ enableWebMCP: true })
    await waitForTools(modelContext, 14)

    const pendingResult = findTool(modelContext, 'goTo').execute({ page: 99 })
    const request = await waitForRequest(harness, 'GO_TO')
    harness.reply(request, { success: false, error: { code: 'bad_request:page_out_of_range', message: 'no page 99' } })
    const toolResult = await pendingResult
    expect(toolResult.isError).toBe(true)
    expect(JSON.parse(toolResult.content[0]?.text ?? '')).toEqual({
      success: false,
      error: { code: 'bad_request:page_out_of_range', message: 'no page 99' },
    })
  })

  it('sends an empty payload when a no-input tool is called without arguments', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ enableWebMCP: true })
    await waitForTools(modelContext, 14)

    void findTool(modelContext, 'detectFields').execute(undefined)
    const request = await waitForRequest(harness, 'DETECT_FIELDS')
    expect(request.data).toEqual({})
  })

  it('unregisters every tool when the embed is disposed', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ enableWebMCP: true })
    await waitForTools(modelContext, 14)
    expect(modelContext.liveToolNames()).toHaveLength(14)

    harness.embed.lifecycle.dispose()
    expect(modelContext.liveToolNames()).toEqual([])
  })

  it('registers nothing when the embed is disposed before the lazy module resolves', async () => {
    const modelContext = installModelContext(document)
    const disposedEarly = mountReady({ enableWebMCP: true })
    disposedEarly.embed.lifecycle.dispose()
    // Control: a later embed on the same context registers its full set, proving the
    // early one's lazy load had every chance to run and registered nothing.
    mountReady({ enableWebMCP: true })
    await waitForTools(modelContext, 14)
    expect(modelContext.liveToolNames()).toHaveLength(14)
  })

  it('registers nothing when the option is off, even with a model context present', async () => {
    const modelContext = installModelContext(document)
    const registerTool = vi.spyOn(modelContext, 'registerTool')
    mountReady({})
    mountReady({ enableWebMCP: false })
    // Control: a ready embed with the option on registers, proving the off ones had
    // the same chance and took none of it.
    mountReady({ enableWebMCP: true })
    await waitForTools(modelContext, 14)
    expect(registerTool).toHaveBeenCalledTimes(14)
  })

  it('lets the first embed on a page own each tool name and reports the collision for a second one', async () => {
    const modelContext = installModelContext(document)
    const logger = makeLogger()
    const first = mountReady({ enableWebMCP: true })
    await waitForTools(modelContext, 14)

    mountReady({ enableWebMCP: true, logger })
    await vi.waitFor(() =>
      expect(logger.warn).toHaveBeenCalledWith('webmcp.tool_already_registered', { tool: 'submit' }),
    )
    expect(logger.warn).toHaveBeenCalledTimes(14)
    expect(modelContext.registered).toHaveLength(14)

    // Disposing the owner frees the names for the next embed.
    first.embed.lifecycle.dispose()
    mountReady({ enableWebMCP: true })
    await waitForTools(modelContext, 28)
  })

  it('falls back to navigator.modelContext when the document exposes none', async () => {
    const modelContext = installModelContext(navigator)
    mountReady({ enableWebMCP: true })
    await waitForTools(modelContext, 14)
    expect(modelContext.liveToolNames()).toHaveLength(14)
  })

  it('reports an absent model context instead of loading the module, never throws, and registers once a context appears', async () => {
    const logger = makeLogger()
    const harness = makeHarness({ enableWebMCP: true, logger })
    harness.markEditorReady()
    await vi.waitFor(() => expect(logger.info).toHaveBeenCalledWith('webmcp.unavailable', { reason: 'no_model_context' }))
    expect(logger.error).not.toHaveBeenCalled()

    // A context installed after a fast EDITOR_READY (an extension injected late) is
    // picked up on the next lifecycle transition.
    const modelContext = installModelContext(document)
    harness.markDocumentLoaded()
    await waitForTools(modelContext, 14)
  })

  it('reports a model context without registerTool as invalid', async () => {
    Object.defineProperty(document, 'modelContext', { configurable: true, value: {} })
    const logger = makeLogger()
    mountReady({ enableWebMCP: true, logger })
    await vi.waitFor(() =>
      expect(logger.warn).toHaveBeenCalledWith('webmcp.unavailable', { reason: 'invalid_model_context' }),
    )
  })

  it('keeps registering the other tools when the runtime rejects one, logs the failure, and frees that name', async () => {
    const modelContext = installModelContext(document, { rejectTool: 'download' })
    const logger = makeLogger()
    mountReady({ enableWebMCP: true, logger })
    await waitForTools(modelContext, 13)

    expect(modelContext.registered.map((tool) => tool.name)).not.toContain('download')
    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith('webmcp.register_tool_failed', {
        tool: 'download',
        message: 'runtime rejected download',
      }),
    )
  })
})
