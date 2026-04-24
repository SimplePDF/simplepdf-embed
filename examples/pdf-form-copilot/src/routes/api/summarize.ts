import { createFileRoute } from '@tanstack/react-router'
import { generateText } from 'ai'
import { monitoring, normalizeError } from '../../lib/monitoring'
import { parseJsonBody } from '../../server/http'
import { buildLanguageModel } from '../../server/language_model'
import { getClientIp, hashIp, isSameOrigin, rateLimiter } from '../../server/rate_limit'
import { readShareIdFromUrl } from '../../server/share_query'
import { resolveApiKey } from '../../server/shared_keys'
import { type SummarizePage, SummarizeRequestSchema } from '../../server/tools'

const MAX_INPUT_CHARS = 20_000
const MAX_OUTPUT_TOKENS = 350
const MAX_BODY_BYTES = 128 * 1024

const SYSTEM_PROMPT = `You compress a PDF form's extracted text into a dense summary for another LLM that will help a user fill the form.

Rules:
- Output at most ~250 words total.
- Keep information the filling assistant needs: form purpose, sections, what each section asks for, any notable constraints or instructions (language, deadlines, units).
- Omit legal boilerplate, page numbers, headers, footers, URLs.
- Preserve section titles verbatim when the form uses them.
- Plain text; bullet points per section are fine.`

const generateDelimiter = (): string => {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `PAGE_${hex}`
}

const renderPages = ({ pages, delimiter }: { pages: SummarizePage[]; delimiter: string }): string => {
  const joined = pages.map((page) => `--- ${delimiter} ${page.page} ---\n${page.content.trim()}`).join('\n\n')
  if (joined.length <= MAX_INPUT_CHARS) {
    return joined
  }
  return `${joined.slice(0, MAX_INPUT_CHARS)}\n\n[truncated]`
}

export const Route = createFileRoute('/api/summarize')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) {
          return Response.json({ error: 'forbidden_origin' }, { status: 403 })
        }
        const shareId = readShareIdFromUrl(request)
        const resolution = resolveApiKey(shareId)
        if (resolution.kind === 'share_required') {
          return Response.json({ error: 'share_required' }, { status: 401 })
        }

        const body = await parseJsonBody({
          request,
          maxBytes: MAX_BODY_BYTES,
          schema: SummarizeRequestSchema,
          schemaErrorMessage: 'Body does not match { name?, pages: [{ page, content }], language_label? }',
        })
        if (!body.success) {
          return Response.json({ error: body.error, message: body.message }, { status: body.status })
        }

        if (!rateLimiter.isReady()) {
          monitoring.error('summarize.blocked_system_failure', {
            ip_hash: null,
            detail: rateLimiter.statusDetail(),
          })
          return Response.json(
            { error: 'service_unavailable', reason: 'rate_limit_unavailable' },
            { status: 503 },
          )
        }
        const ip = getClientIp(request)
        const ipHash = await hashIp(ip)
        const decision = ((): ReturnType<typeof rateLimiter.check> => {
          try {
            return rateLimiter.check({
              bucket: resolution.bucket,
              ipHash,
              lifetime: resolution.lifetime,
            })
          } catch (error) {
            const detail = normalizeError(error)
            monitoring.error('summarize.rate_limit_threw', { ip_hash: ipHash, detail })
            return { allowed: false, reason: 'system_failure', detail: `threw:${detail}` }
          }
        })()
        if (!decision.allowed) {
          if (decision.reason === 'system_failure') {
            monitoring.error('summarize.blocked_system_failure', {
              ip_hash: ipHash,
              detail: decision.detail,
            })
            return Response.json(
              { error: 'service_unavailable', reason: 'rate_limit_unavailable' },
              { status: 503 },
            )
          }
          return Response.json({ error: 'rate_limited', reason: decision.reason }, { status: 429 })
        }

        const delimiter = generateDelimiter()
        const docName = body.data.name ?? 'unknown'
        const languageLabel = body.data.language_label ?? 'English'
        const userPrompt = `Document name: ${docName}\nResponse language: ${languageLabel}\nPage delimiter: ${delimiter}\n\n${renderPages({ pages: body.data.pages, delimiter })}`

        const result = await generateText({
          model: buildLanguageModel({ model: resolution.model, apiKey: resolution.apiKey }),
          system: SYSTEM_PROMPT,
          prompt: userPrompt,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          maxRetries: 1,
        })

        monitoring.info('summarize.done', {
          ip_hash: ipHash,
          input_chars: userPrompt.length,
          output_chars: result.text.length,
          language: languageLabel,
        })

        return Response.json({ summary: result.text })
      },
    },
  },
})
