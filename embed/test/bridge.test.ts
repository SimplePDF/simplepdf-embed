import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachEmbed } from '../src/bridge'
import type { BridgeState, Embed } from '../src/types'

const EDITOR_ORIGIN = 'https://tenant.simplepdf.com'

type Posted = { type: string; request_id: string; data: unknown }
type Harness = {
  embed: Embed
  posted: Posted[]
  reply: (message: unknown) => void
  lastRequestId: () => string
  contentWindow: Window
  // The lifecycle state machine is internal (no public getState); tests observe it
  // through onStateChange, the same hook createEmbed's load-when-ready gate uses.
  getState: () => BridgeState
}

const harnesses: Harness[] = []

const makeHarness = (): Harness => {
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
  const states: BridgeState[] = [{ kind: 'booting' }]
  const embed = attachEmbed({
    getIframe: () => iframe,
    editorOrigin: EDITOR_ORIGIN,
    onStateChange: (state) => states.push(state),
  })
  const reply = (message: unknown): void => {
    window.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(message), origin: EDITOR_ORIGIN, source: contentWindow }),
    )
  }
  const lastRequestId = (): string => {
    const last = posted[posted.length - 1]
    if (last === undefined) {
      throw new Error('no message posted')
    }
    return last.request_id
  }
  const getState = (): BridgeState => {
    const latest = states[states.length - 1]
    if (latest === undefined) {
      throw new Error('no state captured')
    }
    return latest
  }
  const harness: Harness = { embed, posted, reply, lastRequestId, contentWindow, getState }
  harnesses.push(harness)
  return harness
}

const replyResult = (harness: Harness, requestId: string, result: unknown): void =>
  harness.reply({ type: 'REQUEST_RESULT', data: { request_id: requestId, result } })

describe(attachEmbed.name, () => {
  afterEach(() => {
    for (const harness of harnesses) {
      harness.embed.lifecycle.dispose()
    }
    harnesses.length = 0
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('posts the SCREAMING_SNAKE wire type and correlates the reply by request_id', async () => {
    const harness = makeHarness()
    const promise = harness.embed.actions.getFields()
    const request = harness.posted[harness.posted.length - 1]
    expect(request?.type).toBe('GET_FIELDS')
    replyResult(harness, harness.lastRequestId(), { success: true, data: { fields: [] } })
    await expect(promise).resolves.toEqual({ success: true, data: { fields: [] } })
  })

  it('normalizes a void success ({ success: true }) to { success: true, data: null }', async () => {
    const harness = makeHarness()
    const promise = harness.embed.actions.goTo({ page: 2 })
    replyResult(harness, harness.lastRequestId(), { success: true })
    await expect(promise).resolves.toEqual({ success: true, data: null })
  })

  it('forwards a typed editor error and camelCases its details payload', async () => {
    const harness = makeHarness()
    const promise = harness.embed.actions.submit({ downloadCopy: false })
    // The wire sends snake_case details; the SDK surfaces them camelCased.
    replyResult(harness, harness.lastRequestId(), {
      success: false,
      error: {
        code: 'bad_request:missing_required_fields',
        message: '2 required fields are unfilled',
        details: { unfilled_required_fields_count: 2 },
      },
    })
    const result = await promise
    expect(result.success).toBe(false)
    if (!result.success && result.error.code === 'bad_request:missing_required_fields') {
      expect(result.error.details).toEqual({ unfilledRequiredFieldsCount: 2 })
    }
  })

  it('transforms the camelCase request payload to snake_case on the wire', async () => {
    const harness = makeHarness()
    const promise = harness.embed.actions.setFieldValue({ fieldId: 'f1', value: 'hello_world' })
    const request = harness.posted[harness.posted.length - 1]
    expect(request?.type).toBe('SET_FIELD_VALUE')
    // KEY fieldId -> field_id; the opaque value (with underscores) is untouched.
    expect(request?.data).toEqual({ field_id: 'f1', value: 'hello_world' })
    replyResult(harness, harness.lastRequestId(), { success: true })
    await expect(promise).resolves.toEqual({ success: true, data: null })
  })

  it('returns unexpected:iframe_not_mounted when the iframe is gone', async () => {
    const embed = attachEmbed({ getIframe: () => null, editorOrigin: EDITOR_ORIGIN })
    const result = await embed.actions.getFields()
    expect(result).toEqual({
      success: false,
      error: { code: 'unexpected:iframe_not_mounted', message: 'Editor iframe is not mounted' },
    })
    embed.lifecycle.dispose()
  })

  it('times out with unexpected:timeout after the generous dead-iframe budget', async () => {
    vi.useFakeTimers()
    const harness = makeHarness()
    const promise = harness.embed.actions.getFields()
    await vi.advanceTimersByTimeAsync(60_001)
    const result = await promise
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('unexpected:timeout')
    }
  })

  it('does not starve a request queued behind a slow one (resolves when replied within budget)', async () => {
    vi.useFakeTimers()
    const harness = makeHarness()
    const slow = harness.embed.actions.detectFields()
    const slowId = harness.lastRequestId()
    const fast = harness.embed.actions.getFields()
    const fastId = harness.lastRequestId()
    // 30s elapses (well under the 60s budget); the slow op is still in flight.
    await vi.advanceTimersByTimeAsync(30_000)
    replyResult(harness, fastId, { success: true, data: { fields: [] } })
    await expect(fast).resolves.toEqual({ success: true, data: { fields: [] } })
    replyResult(harness, slowId, { success: true, data: { detected_count: 1 } })
    await expect(slow).resolves.toEqual({ success: true, data: { detectedCount: 1 } })
  })

  it('rejects pending requests with unexpected:bridge_disposed on dispose', async () => {
    const harness = makeHarness()
    const promise = harness.embed.actions.getFields()
    harness.embed.lifecycle.dispose()
    await expect(promise).resolves.toEqual({
      success: false,
      error: { code: 'unexpected:bridge_disposed', message: 'Editor bridge was disposed' },
    })
  })

  it('returns unexpected:bridge_disposed for a call made after dispose (without posting)', async () => {
    const harness = makeHarness()
    harness.embed.lifecycle.dispose()
    const postedBefore = harness.posted.length
    const result = await harness.embed.actions.getFields()
    expect(result).toEqual({
      success: false,
      error: { code: 'unexpected:bridge_disposed', message: 'Editor bridge was disposed' },
    })
    expect(harness.posted.length).toBe(postedBefore)
  })

  it('returns unexpected:unknown when posting throws (dead contentWindow)', async () => {
    const harness = makeHarness()
    vi.spyOn(harness.contentWindow, 'postMessage').mockImplementation(() => {
      throw new Error('dead window')
    })
    const result = await harness.embed.actions.getFields()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('unexpected:unknown')
    }
  })

  it('returns unexpected:malformed_result when the editor reply has no valid result', async () => {
    const harness = makeHarness()
    const promise = harness.embed.actions.getFields()
    replyResult(harness, harness.lastRequestId(), { nonsense: true })
    const result = await promise
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('unexpected:malformed_result')
    }
  })

  it('delivers SUBMISSION_SENT to on(type) with the verbatim snake_case payload', () => {
    const harness = makeHarness()
    const listener = vi.fn()
    harness.embed.events.on('SUBMISSION_SENT', listener)
    harness.reply({ type: 'SUBMISSION_SENT', data: { document_id: 'doc_1', submission_id: 'sub_1' } })
    expect(listener).toHaveBeenCalledWith({ document_id: 'doc_1', submission_id: 'sub_1' })
  })

  it('delivers the EDITOR_READY and DOCUMENT_LOADED lifecycle events to on(type)', () => {
    const harness = makeHarness()
    const onReady = vi.fn()
    const onLoaded = vi.fn()
    harness.embed.events.on('EDITOR_READY', onReady)
    harness.embed.events.on('DOCUMENT_LOADED', onLoaded)
    harness.reply({ type: 'EDITOR_READY', data: {} })
    expect(onReady).toHaveBeenCalledWith({})
    harness.reply({ type: 'DOCUMENT_LOADED', data: { document_id: 'doc_9' } })
    expect(onLoaded).toHaveBeenCalledWith({ document_id: 'doc_9' })
  })

  it('keeps notifying handlers of the same event when one throws', () => {
    const harness = makeHarness()
    const second = vi.fn()
    harness.embed.events.on('SUBMISSION_SENT', () => {
      throw new Error('listener boom')
    })
    harness.embed.events.on('SUBMISSION_SENT', second)
    harness.reply({ type: 'SUBMISSION_SENT', data: { document_id: 'doc_1', submission_id: 'sub_1' } })
    expect(second).toHaveBeenCalledWith({ document_id: 'doc_1', submission_id: 'sub_1' })
  })

  it('drops a malformed SUBMISSION_SENT payload', () => {
    const harness = makeHarness()
    const listener = vi.fn()
    harness.embed.events.on('SUBMISSION_SENT', listener)
    harness.reply({ type: 'SUBMISSION_SENT', data: { document_id: 'doc_1' } })
    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribes when the returned disposer is called', () => {
    const harness = makeHarness()
    const listener = vi.fn()
    const off = harness.embed.events.on('SUBMISSION_SENT', listener)
    off()
    harness.reply({ type: 'SUBMISSION_SENT', data: { document_id: 'doc_1', submission_id: 'sub_1' } })
    expect(listener).not.toHaveBeenCalled()
  })

  it('delivers PAGE_FOCUSED to on(type) verbatim (null previous_page allowed)', () => {
    const harness = makeHarness()
    const listener = vi.fn()
    harness.embed.events.on('PAGE_FOCUSED', listener)
    harness.reply({ type: 'PAGE_FOCUSED', data: { previous_page: null, current_page: 1, total_pages: 3 } })
    expect(listener).toHaveBeenCalledWith({ previous_page: null, current_page: 1, total_pages: 3 })
  })

  it('flips to editorReady then documentLoaded from probe responses', () => {
    const harness = makeHarness()
    expect(harness.getState().kind).toBe('booting')
    const probe = harness.posted.find((message) => message.type === 'GET_FIELDS')
    expect(probe).toBeDefined()
    if (probe !== undefined) {
      replyResult(harness, probe.request_id, { success: true, data: { fields: [] } })
    }
    expect(harness.getState().kind).toBe('documentLoaded')
  })

  it('reports readiness via onStateChange when reached only through the probe (no editor event)', () => {
    // This is what drives createEmbed's "load the document once ready" gate: readiness
    // reached via the probe emits NO editor event, so onStateChange must still fire.
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
    const states: string[] = []
    const embed = attachEmbed({
      getIframe: () => iframe,
      editorOrigin: EDITOR_ORIGIN,
      onStateChange: (state) => states.push(state.kind),
    })
    const probe = posted.find((message) => message.type === 'GET_FIELDS')
    if (probe !== undefined) {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'REQUEST_RESULT',
            data: { request_id: probe.request_id, result: { success: true, data: { fields: [] } } },
          }),
          origin: EDITOR_ORIGIN,
          source: contentWindow,
        }),
      )
    }
    expect(states).toContain('documentLoaded')
    embed.lifecycle.dispose()
  })

  it('clears the readiness fallback once a document is loaded (no late warning or corruption)', () => {
    vi.useFakeTimers()
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
    const warn = vi.fn()
    const states: string[] = []
    const embed = attachEmbed({
      getIframe: () => iframe,
      editorOrigin: EDITOR_ORIGIN,
      logger: { debug: () => {}, info: () => {}, warn, error: () => {} },
      onStateChange: (state) => states.push(state.kind),
    })
    const probe = posted.find((message) => message.type === 'GET_FIELDS')
    if (probe !== undefined) {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'REQUEST_RESULT',
            data: { request_id: probe.request_id, result: { success: true, data: { fields: [] } } },
          }),
          origin: EDITOR_ORIGIN,
          source: contentWindow,
        }),
      )
    }
    expect(states.at(-1)).toBe('documentLoaded')
    // The fallback timer was cleared on load: advancing past it neither warns nor
    // drops the loaded document back to editorReady.
    vi.advanceTimersByTime(31_000)
    expect(states.at(-1)).toBe('documentLoaded')
    expect(warn).not.toHaveBeenCalled()
    embed.lifecycle.dispose()
  })

  it('stops the readiness probe loop after the fallback window (bounded probing)', () => {
    vi.useFakeTimers()
    const harness = makeHarness()
    // The editor never confirms readiness; probes fire every 500ms until the
    // 30s fallback, then stop.
    vi.advanceTimersByTime(30_000)
    const countAtFallback = harness.posted.filter((message) => message.type === 'GET_FIELDS').length
    expect(countAtFallback).toBeGreaterThan(1)
    vi.advanceTimersByTime(30_000)
    const countLater = harness.posted.filter((message) => message.type === 'GET_FIELDS').length
    expect(countLater).toBe(countAtFallback)
    expect(harness.getState().kind).toBe('editorReady')
  })

  it('a throwing logger never affects bridge behavior', async () => {
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
    const boom = () => {
      throw new Error('log boom')
    }
    const throwingLogger = { debug: boom, info: boom, warn: boom, error: boom }
    const embed = attachEmbed({ getIframe: () => iframe, editorOrigin: EDITOR_ORIGIN, logger: throwingLogger })
    const promise = embed.actions.getFields()
    const requestId = posted[posted.length - 1]?.request_id ?? ''
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'REQUEST_RESULT',
          data: { request_id: requestId, result: { success: true, data: { fields: [] } } },
        }),
        origin: EDITOR_ORIGIN,
        source: contentWindow,
      }),
    )
    await expect(promise).resolves.toEqual({ success: true, data: { fields: [] } })
    // Disposal must not throw either.
    expect(() => embed.lifecycle.dispose()).not.toThrow()
  })

  it('an async-rejecting logger never surfaces as an unhandled rejection', async () => {
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
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const rejecting = () => Promise.reject(new Error('async log boom'))
    const embed = attachEmbed({
      getIframe: () => iframe,
      editorOrigin: EDITOR_ORIGIN,
      logger: { debug: rejecting, info: rejecting, warn: rejecting, error: rejecting },
    })
    const promise = embed.actions.getFields()
    const requestId = posted[posted.length - 1]?.request_id ?? ''
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'REQUEST_RESULT',
          data: { request_id: requestId, result: { success: true, data: { fields: [] } } },
        }),
        origin: EDITOR_ORIGIN,
        source: contentWindow,
      }),
    )
    await expect(promise).resolves.toEqual({ success: true, data: { fields: [] } })
    // Let any microtask-queued rejections flush.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(unhandled).not.toHaveBeenCalled()
    process.off('unhandledRejection', unhandled)
    embed.lifecycle.dispose()
  })

  it('ignores messages from a foreign origin', async () => {
    const harness = makeHarness()
    const promise = harness.embed.actions.getFields()
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'REQUEST_RESULT',
          data: { request_id: harness.lastRequestId(), result: { success: true, data: { fields: [] } } },
        }),
        origin: 'https://evil.example.com',
        source: harness.contentWindow,
      }),
    )
    // The foreign-origin reply is ignored; the request stays pending until disposed.
    harness.embed.lifecycle.dispose()
    const result = await promise
    expect(result.success).toBe(false)
  })

  it('disposes idempotently, invoking onDispose exactly once', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const onDispose = vi.fn()
    const embed = attachEmbed({ getIframe: () => iframe, editorOrigin: EDITOR_ORIGIN, onDispose })
    embed.lifecycle.dispose()
    embed.lifecycle.dispose()
    expect(onDispose).toHaveBeenCalledTimes(1)
  })
})
