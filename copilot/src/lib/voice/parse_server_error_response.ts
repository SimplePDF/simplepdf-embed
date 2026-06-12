import { ServerErrorBody } from '../api_envelope'
import { isUpstreamHtmlError } from '../error-classifier'

// Safe parser for a non-2xx /api/transcribe response body. A direct fetch can
// receive non-JSON from the platform / a proxy (e.g. the HTML 503 pages the
// chat classifier already handles), so this never surfaces raw HTML: HTML 5xx,
// empty bodies, and invalid JSON all collapse to a sanitized
// `service_unavailable`. A well-formed body parses through unchanged.
export const parseServerErrorResponse = async (response: Response): Promise<ServerErrorBody> => {
  const text = await response.text()
  if (isUpstreamHtmlError(text)) {
    return { error: 'service_unavailable', reason: 'upstream_html' }
  }
  const json = ((): unknown => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  })()
  const parsed = ServerErrorBody.safeParse(json)
  if (!parsed.success) {
    return { error: 'service_unavailable', reason: 'invalid_error_body' }
  }
  return parsed.data
}
