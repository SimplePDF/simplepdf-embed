import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBridge } from '../src/bridge'
import type { Embed } from '../src/types'

const EDITOR_ORIGIN = 'https://tenant.simplepdf.com'

type Harness = {
  embed: Embed
  posted: Array<{ type: string; request_id: string; data: unknown }>
  reply: (message: unknown) => void
  lastRequestId: () => string
  contentWindow: Window
}

const setup = (): Harness => {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  const contentWindow = iframe.contentWindow
  if (contentWindow === null) {
    throw new Error('jsdom iframe has no contentWindow')
  }
  const posted: Array<{ type: string; request_id: string; data: unknown }> = []
  vi.spyOn(contentWindow, 'postMessage').mockImplementation((message: unknown) => {
    if (typeof message === 'string') {
      posted.push(JSON.parse(message))
    }
  })
  const embed = createBridge({ getIframe: () => iframe, editorOrigin: EDITOR_ORIGIN })
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
  return { embed, posted, reply, lastRequestId, contentWindow }
}

describe(createBridge.name, () => {
  let harness: Harness | null = null

  beforeEach(() => {
    harness = setup()
  })

  afterEach(() => {
    harness?.embed.dispose()
    harness = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('posts the SCREAMING_SNAKE wire type for a method and correlates the reply by request_id', async () => {
    const { embed, posted, reply, lastRequestId } = harness!
    const promise = embed.getFields()
    const request = posted[posted.length - 1]
    expect(request?.type).toBe('GET_FIELDS')
    reply({ type: 'REQUEST_RESULT', data: { request_id: lastRequestId(), result: { success: true, data: { fields: [] } } } })
    await expect(promise).resolves.toEqual({ success: true, data: { fields: [] } })
  })

  it('normalizes a void success ({ success: true }) to { success: true, data: null }', async () => {
    const { embed, reply, lastRequestId } = harness!
    const promise = embed.goTo({ page: 2 })
    reply({ type: 'REQUEST_RESULT', data: { request_id: lastRequestId(), result: { success: true } } })
    await expect(promise).resolves.toEqual({ success: true, data: null })
  })

  it('forwards a typed editor error verbatim', async () => {
    const { embed, reply, lastRequestId } = harness!
    const promise = embed.submit({ download_copy: false })
    reply({
      type: 'REQUEST_RESULT',
      data: {
        request_id: lastRequestId(),
        result: {
          success: false,
          error: {
            code: 'bad_request:missing_required_fields',
            message: '2 required fields are unfilled',
            details: { unfilled_required_fields_count: 2 },
          },
        },
      },
    })
    const result = await promise
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('bad_request:missing_required_fields')
    }
  })

  it('returns unexpected:iframe_not_mounted when the iframe is gone', async () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const embed = createBridge({ getIframe: () => null, editorOrigin: EDITOR_ORIGIN })
    const result = await embed.getFields()
    expect(result).toEqual({
      success: false,
      error: { code: 'unexpected:iframe_not_mounted', message: 'Editor iframe is not mounted' },
    })
    embed.dispose()
  })

  it('times out with unexpected:timeout after the request budget', async () => {
    vi.useFakeTimers()
    const { embed } = harness!
    const promise = embed.getFields()
    await vi.advanceTimersByTimeAsync(6_001)
    const result = await promise
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('unexpected:timeout')
    }
  })

  it('rejects pending requests with unexpected:bridge_disposed on dispose', async () => {
    const { embed } = harness!
    const promise = embed.getFields()
    embed.dispose()
    const result = await promise
    expect(result).toEqual({
      success: false,
      error: { code: 'unexpected:bridge_disposed', message: 'Editor bridge was disposed' },
    })
    harness = null
  })

  it('returns unexpected:malformed_result when the editor reply has no valid result', async () => {
    const { embed, reply, lastRequestId } = harness!
    const promise = embed.getFields()
    reply({ type: 'REQUEST_RESULT', data: { request_id: lastRequestId(), result: { nonsense: true } } })
    const result = await promise
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('unexpected:malformed_result')
    }
  })

  it('emits submission_sent with the typed payload', () => {
    const { reply } = harness!
    const listener = vi.fn()
    harness!.embed.on('submission_sent', listener)
    reply({ type: 'SUBMISSION_SENT', data: { document_id: 'doc_1', submission_id: 'sub_1' } })
    expect(listener).toHaveBeenCalledWith({ document_id: 'doc_1', submission_id: 'sub_1' })
  })

  it('drops a malformed submission_sent payload', () => {
    const { reply } = harness!
    const listener = vi.fn()
    harness!.embed.on('submission_sent', listener)
    reply({ type: 'SUBMISSION_SENT', data: { document_id: 'doc_1' } })
    expect(listener).not.toHaveBeenCalled()
  })

  it('emits page_focused with the typed payload (null previous_page allowed)', () => {
    const { reply } = harness!
    const listener = vi.fn()
    harness!.embed.on('page_focused', listener)
    reply({ type: 'PAGE_FOCUSED', data: { previous_page: null, current_page: 1, total_pages: 3 } })
    expect(listener).toHaveBeenCalledWith({ previous_page: null, current_page: 1, total_pages: 3 })
  })

  it('flips to editor_ready then document_loaded from probe responses', () => {
    const { embed, posted, reply } = harness!
    expect(embed.getState().kind).toBe('booting')
    const probe = posted.find((message) => message.type === 'GET_FIELDS')
    expect(probe).toBeDefined()
    reply({
      type: 'REQUEST_RESULT',
      data: { request_id: probe!.request_id, result: { success: true, data: { fields: [] } } },
    })
    expect(embed.getState().kind).toBe('document_loaded')
  })

  it('ignores messages from a foreign origin', async () => {
    const { embed, contentWindow, lastRequestId } = harness!
    const promise = embed.getFields()
    window.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'REQUEST_RESULT', data: { request_id: lastRequestId(), result: { success: true, data: { fields: [] } } } }),
        origin: 'https://evil.example.com',
        source: contentWindow,
      }),
    )
    // The foreign-origin reply is ignored; the request stays pending until disposed.
    embed.dispose()
    const result = await promise
    expect(result.success).toBe(false)
  })

  it('disposes idempotently and notifies the disposed event once', () => {
    const { embed } = harness!
    const listener = vi.fn()
    embed.on('disposed', listener)
    embed.dispose()
    embed.dispose()
    expect(listener).toHaveBeenCalledTimes(1)
    harness = null
  })
})
