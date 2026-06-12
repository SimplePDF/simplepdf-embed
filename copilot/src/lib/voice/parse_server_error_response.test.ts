import { describe, expect, it } from 'vitest'
import { parseServerErrorResponse } from './parse_server_error_response'

describe('parseServerErrorResponse', () => {
  it('maps an HTML 5xx page to service_unavailable (never surfaces raw HTML)', async () => {
    const result = await parseServerErrorResponse(
      new Response('<!DOCTYPE html><html>503</html>', { status: 503 }),
    )
    expect(result).toEqual({ error: 'service_unavailable', reason: 'upstream_html' })
  })

  it('maps an empty body to service_unavailable', async () => {
    const result = await parseServerErrorResponse(new Response('', { status: 503 }))
    expect(result).toEqual({ error: 'service_unavailable', reason: 'invalid_error_body' })
  })

  it('maps invalid JSON to service_unavailable', async () => {
    const result = await parseServerErrorResponse(new Response('not json at all', { status: 400 }))
    expect(result).toEqual({ error: 'service_unavailable', reason: 'invalid_error_body' })
  })

  it('passes a well-formed ServerErrorBody through unchanged', async () => {
    const body = JSON.stringify({ error: 'rate_limited', reason: 'lifetime' })
    const result = await parseServerErrorResponse(new Response(body, { status: 429 }))
    expect(result).toEqual({ error: 'rate_limited', reason: 'lifetime' })
  })
})
