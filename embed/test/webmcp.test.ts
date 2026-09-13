import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachEmbed, type AttachEmbedArgs } from '../src/bridge'
import type { BridgeLogger } from '../src/logger'
import type { Embed } from '../src/types'
import { METHOD_NAMES } from '../src/generated/method-names'
import { WEBMCP_TOOLS } from '../src/generated/webmcp-tools'

const EDITOR_ORIGIN = 'https://tenant.simplepdf.com'

// The slice of a WebMCP tool descriptor these tests read back.
type RegisteredTool = {
  name: string
  description: string
  inputSchema: { type: string; properties?: Record<string, unknown>; required?: readonly string[] }
  annotations: { readOnlyHint?: boolean; untrustedContentHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean }
  execute: (
    input: unknown,
    options?: { signal: AbortSignal },
  ) => Promise<{
    content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>
    isError?: boolean
  }>
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

const makeHarness = (args: Pick<AttachEmbedArgs, 'webMCP' | 'logger'>): Harness => {
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
const mountReady = (args: Pick<AttachEmbedArgs, 'webMCP' | 'logger'>): Harness => {
  const harness = makeHarness(args)
  harness.markEditorReady()
  return harness
}

const waitForTools = (modelContext: FakeModelContext, count: number): Promise<void> =>
  vi.waitFor(() => expect(modelContext.registered).toHaveLength(count))

const TOOL_COUNT = METHOD_NAMES.length
const toolName = (method: keyof typeof WEBMCP_TOOLS): string => WEBMCP_TOOLS[method].name

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

describe('attachEmbed({ webMCP })', () => {
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

  it('registers every operation on document.modelContext as the manifest tool record: prefixed name, description, snake_case input schema and behavior hints', async () => {
    const modelContext = installModelContext(document)
    mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)

    expect(modelContext.registered.map((tool) => tool.name).sort()).toEqual(
      Object.values(WEBMCP_TOOLS)
        .map((tool) => tool.name)
        .sort(),
    )
    expect(modelContext.liveToolNames()).toHaveLength(TOOL_COUNT)
    // loadDocument is a host-page tool like it is in the editor's own registration.
    expect(modelContext.liveToolNames()).toContain('simplepdf_embed_load_document')
    const setFieldValue = findTool(modelContext, 'simplepdf_embed_set_field_value')
    expect(setFieldValue.description).toMatch(/^Set the value of an existing field/)
    expect(setFieldValue.inputSchema.type).toBe('object')
    expect(Object.keys(setFieldValue.inputSchema.properties ?? {})).toEqual(['field_id', 'value'])
    expect(setFieldValue.inputSchema.required).toEqual(['field_id', 'value'])
    for (const tool of modelContext.registered) {
      const hasExplicitHint = tool.annotations.readOnlyHint === true || typeof tool.annotations.destructiveHint === 'boolean'
      expect(hasExplicitHint, `${tool.name} declares no behavior hint`).toBe(true)
    }
    // The readers hand document-derived content to the agent: read-only AND untrusted.
    expect(findTool(modelContext, 'simplepdf_embed_get_fields').annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    })
    expect(findTool(modelContext, 'simplepdf_embed_get_annotated_page').annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    })
    expect(findTool(modelContext, 'simplepdf_embed_submit').annotations).toEqual({ destructiveHint: true })
    // The hints are the manifest's, openWorldHint included (the editor fetches an agent-supplied URL).
    expect(findTool(modelContext, 'simplepdf_embed_set_field_value').annotations).toEqual({
      destructiveHint: false,
      openWorldHint: true,
    })
  })

  it('waits for the editor to be ready before registering, so an early tool call cannot post into a listener-less iframe', async () => {
    const modelContext = installModelContext(document)
    const booting = makeHarness({ webMCP: { enabled: true } })
    // Control: a ready embed on the same context proves the lazy path had time to run;
    // every live name is the control's, so the booting embed registered nothing.
    const control = mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)
    expect(modelContext.liveToolNames()).toHaveLength(TOOL_COUNT)
    control.embed.lifecycle.dispose()
    expect(modelContext.liveToolNames()).toEqual([])

    booting.markEditorReady()
    await waitForTools(modelContext, TOOL_COUNT * 2)
    expect(modelContext.liveToolNames()).toHaveLength(TOOL_COUNT)
  })

  it('withholds the excluded operations and registers the rest', async () => {
    const modelContext = installModelContext(document)
    const logger = makeLogger()
    mountReady({ webMCP: { enabled: true, exclude: ['submit', 'deletePages', 'movePage', 'rotatePage'] }, logger })
    await waitForTools(modelContext, TOOL_COUNT - 4)

    const names = modelContext.registered.map((tool) => tool.name)
    expect(names).toContain(toolName('setFieldValue'))
    expect(names).toContain(toolName('getFields'))
    expect(names).not.toContain(toolName('submit'))
    expect(names).not.toContain(toolName('deletePages'))
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('executes a tool call as the operation request on the wire and returns the editor Result, wire-shaped, as a JSON-text tool result', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)

    const pendingResult = findTool(modelContext, 'simplepdf_embed_set_field_value').execute({ field_id: 'f1', value: 'Jane' })
    const request = await waitForRequest(harness, 'SET_FIELD_VALUE')
    expect(request.data).toEqual({ field_id: 'f1', value: 'Jane' })
    harness.reply(request, { success: true })
    const toolResult = await pendingResult
    expect(toolResult.isError).toBeUndefined()
    expect(toolResult.content).toEqual([{ type: 'text', text: JSON.stringify({ success: true, data: null }) }])
  })

  it('hands the agent the wire-shaped result its tool description promises (snake_case, not the SDK camelCase)', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)

    const pendingResult = findTool(modelContext, 'simplepdf_embed_create_field').execute({ type: 'TEXT', x: 1, y: 2, width: 3, height: 4, page: 1 })
    const request = await waitForRequest(harness, 'CREATE_FIELD')
    harness.reply(request, { success: true, data: { field_id: 'f_new' } })
    const toolResult = await pendingResult
    expect(toolResult.content).toEqual([{ type: 'text', text: JSON.stringify({ success: true, data: { field_id: 'f_new' } }) }])
  })

  it('returns the annotated page render once, as an image block, with the badges map in the text block', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)

    const pendingResult = findTool(modelContext, 'simplepdf_embed_get_annotated_page').execute({ page: 1 })
    const request = await waitForRequest(harness, 'GET_ANNOTATED_PAGE')
    harness.reply(request, {
      success: true,
      data: { page: 1, image_data_url: 'data:image/png;base64,iVBORw0KGgo=', image_width: 10, image_height: 12, badges: { '1': 'f1' } },
    })
    const toolResult = await pendingResult
    expect(toolResult.isError).toBeUndefined()
    expect(toolResult.content).toEqual([
      { type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' },
      { type: 'text', text: JSON.stringify({ success: true, data: { page: 1, image_width: 10, image_height: 12, badges: { '1': 'f1' } } }) },
    ])
  })

  it('keeps the text envelope for a failed annotated page render', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)

    const pendingResult = findTool(modelContext, 'simplepdf_embed_get_annotated_page').execute({ page: 99 })
    const request = await waitForRequest(harness, 'GET_ANNOTATED_PAGE')
    const failure = { success: false, error: { code: 'bad_request:page_out_of_range', message: 'no page 99' } }
    harness.reply(request, failure)
    const toolResult = await pendingResult
    expect(toolResult.isError).toBe(true)
    expect(toolResult.content).toEqual([{ type: 'text', text: JSON.stringify(failure) }])
  })

  it('flags a failed editor Result as an error tool result that still carries the error code', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)

    const pendingResult = findTool(modelContext, 'simplepdf_embed_go_to').execute({ page: 99 })
    const request = await waitForRequest(harness, 'GO_TO')
    harness.reply(request, { success: false, error: { code: 'bad_request:page_out_of_range', message: 'no page 99' } })
    const toolResult = await pendingResult
    expect(toolResult.isError).toBe(true)
    expect(toolResult.content).toEqual([
      {
        type: 'text',
        text: JSON.stringify({ success: false, error: { code: 'bad_request:page_out_of_range', message: 'no page 99' } }),
      },
    ])
  })

  it('rejects a call whose signal is already aborted and posts nothing to the editor', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)

    const aborted = new AbortController()
    aborted.abort()
    const postedBefore = harness.posted.length
    await expect(
      findTool(modelContext, 'simplepdf_embed_submit').execute({ download_copy: false }, { signal: aborted.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(harness.posted).toHaveLength(postedBefore)
  })

  it('sends an empty payload when a no-input tool is called without arguments', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)

    void findTool(modelContext, 'simplepdf_embed_detect_fields').execute(undefined)
    const request = await waitForRequest(harness, 'DETECT_FIELDS')
    expect(request.data).toEqual({})
  })

  it('unregisters every tool when the embed is disposed', async () => {
    const modelContext = installModelContext(document)
    const harness = mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)
    expect(modelContext.liveToolNames()).toHaveLength(TOOL_COUNT)

    harness.embed.lifecycle.dispose()
    expect(modelContext.liveToolNames()).toEqual([])
  })

  it('registers nothing when the embed is disposed before the lazy module resolves', async () => {
    const modelContext = installModelContext(document)
    const disposedEarly = mountReady({ webMCP: { enabled: true } })
    disposedEarly.embed.lifecycle.dispose()
    // Control: a later embed on the same context registers its full set, proving the
    // early one's lazy load had every chance to run and registered nothing.
    mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)
    expect(modelContext.liveToolNames()).toHaveLength(TOOL_COUNT)
  })

  it('registers nothing when the option is off, even with a model context present', async () => {
    const modelContext = installModelContext(document)
    const registerTool = vi.spyOn(modelContext, 'registerTool')
    mountReady({})
    mountReady({ webMCP: { enabled: false } })
    // Control: a ready embed with the option on registers, proving the off ones had
    // the same chance and took none of it.
    mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)
    expect(registerTool).toHaveBeenCalledTimes(TOOL_COUNT)
  })

  it('lets the first embed on a page own each tool name and reports the collision for a second one', async () => {
    const modelContext = installModelContext(document)
    const logger = makeLogger()
    const first = mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)

    mountReady({ webMCP: { enabled: true }, logger })
    await vi.waitFor(() =>
      expect(logger.warn).toHaveBeenCalledWith('webmcp.tool_already_registered', { tool: 'simplepdf_embed_submit' }),
    )
    expect(logger.warn).toHaveBeenCalledTimes(TOOL_COUNT)
    expect(modelContext.registered).toHaveLength(TOOL_COUNT)

    // Disposing the owner frees the names for the next embed.
    first.embed.lifecycle.dispose()
    mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT * 2)
  })

  it('frees a rejected name only for its owner, so a later embed that took the name keeps it', async () => {
    // A: the runtime rejects `download`; A's abort must not later free a name it never owned.
    const modelContext = installModelContext(document, { rejectTool: 'simplepdf_embed_download' })
    const first = mountReady({ webMCP: { enabled: true }, logger: makeLogger() })
    await waitForTools(modelContext, TOOL_COUNT - 1)

    // B: on an accepting context, takes `download` (the rest are reported as A's).
    const accepting = installModelContext(document)
    const second = mountReady({ webMCP: { enabled: true }, logger: makeLogger() })
    await waitForTools(accepting, 1)
    expect(accepting.registered[0]?.name).toBe('simplepdf_embed_download')

    // A disposes: its names are freed for C, but B's `download` stays owned, so C is refused it.
    first.embed.lifecycle.dispose()
    const logger = makeLogger()
    mountReady({ webMCP: { enabled: true }, logger })
    await waitForTools(accepting, TOOL_COUNT)
    expect(logger.warn).toHaveBeenCalledWith('webmcp.tool_already_registered', { tool: 'simplepdf_embed_download' })
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(accepting.registered.filter((tool) => tool.name === 'simplepdf_embed_download')).toHaveLength(1)
    second.embed.lifecycle.dispose()
  })

  it('falls back to navigator.modelContext when the document exposes none', async () => {
    const modelContext = installModelContext(navigator)
    mountReady({ webMCP: { enabled: true } })
    await waitForTools(modelContext, TOOL_COUNT)
    expect(modelContext.liveToolNames()).toHaveLength(TOOL_COUNT)
  })

  it('reports an absent model context, never throws, and registers once a context appears', async () => {
    const logger = makeLogger()
    const harness = makeHarness({ webMCP: { enabled: true }, logger })
    harness.markEditorReady()
    await vi.waitFor(() => expect(logger.info).toHaveBeenCalledWith('webmcp.unavailable', { reason: 'no_model_context' }))
    expect(logger.error).not.toHaveBeenCalled()

    // A context installed after a fast EDITOR_READY (an extension injected late) is
    // picked up on the next lifecycle transition.
    const modelContext = installModelContext(document)
    harness.markDocumentLoaded()
    await waitForTools(modelContext, TOOL_COUNT)
  })

  it('reports a model context without registerTool as invalid and keeps probing, so a placeholder filled in later still gets the tools', async () => {
    Object.defineProperty(document, 'modelContext', { configurable: true, value: {} })
    const logger = makeLogger()
    const harness = mountReady({ webMCP: { enabled: true }, logger })
    await vi.waitFor(() =>
      expect(logger.info).toHaveBeenCalledWith('webmcp.unavailable', { reason: 'invalid_model_context' }),
    )

    const modelContext = installModelContext(document)
    harness.markDocumentLoaded()
    await waitForTools(modelContext, TOOL_COUNT)
  })

  it('keeps registering the other tools when the runtime rejects one, logs the failure, and frees that name', async () => {
    const modelContext = installModelContext(document, { rejectTool: 'simplepdf_embed_download' })
    const logger = makeLogger()
    mountReady({ webMCP: { enabled: true }, logger })
    await waitForTools(modelContext, TOOL_COUNT - 1)

    expect(modelContext.registered.map((tool) => tool.name)).not.toContain('simplepdf_embed_download')
    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith('webmcp.register_tool_failed', {
        tool: 'simplepdf_embed_download',
        message: 'runtime rejected simplepdf_embed_download',
      }),
    )
  })
})
