import { createFileRoute } from '@tanstack/react-router'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { SummarizeRequestSchema, type SummarizePage } from '../../server/tools'
import { getClientIp, hashIp, isOriginAllowed, rateLimiter } from '../../server/rate_limit'
import { getShareParam, resolveApiKey } from '../../server/shared_keys'

const MODEL_ID = 'claude-haiku-4-5-20251001'
const MAX_INPUT_CHARS = 20_000
const MAX_OUTPUT_TOKENS = 350
const MAX_BODY_BYTES = 128 * 1024

type ParsedBody =
  | { success: true; name: string | null; pages: SummarizePage[]; languageLabel: string }
  | { success: false; status: number; error: string; message: string }

const SYSTEM_PROMPT = `You compress a PDF form's extracted text into a dense summary for another LLM that will help a user fill the form.

Rules:
- Output at most ~250 words total.
- Keep information the filling assistant needs: form purpose, sections, what each section asks for, any notable constraints or instructions (language, deadlines, units).
- Omit legal boilerplate, page numbers, headers, footers, URLs.
- Preserve section titles verbatim when the form uses them.
- Plain text; bullet points per section are fine.`

const readBodyText = async (request: Request): Promise<{ success: true; text: string } | { success: false; status: number; error: string; message: string }> => {
  const declaredLength = Number.parseInt(request.headers.get('content-length') ?? '', 10)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { success: false, status: 413, error: 'payload_too_large', message: `Request body exceeds ${MAX_BODY_BYTES} bytes` }
  }
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) {
    return { success: false, status: 413, error: 'payload_too_large', message: `Request body exceeds ${MAX_BODY_BYTES} bytes` }
  }
  return { success: true, text }
}

const parseBody = async (request: Request): Promise<ParsedBody> => {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.startsWith('application/json')) {
    return { success: false, status: 415, error: 'unsupported_media_type', message: 'Expected application/json' }
  }
  const bodyRead = await readBodyText(request)
  if (!bodyRead.success) {
    return bodyRead
  }
  if (bodyRead.text === '') {
    return { success: false, status: 400, error: 'bad_request', message: 'Empty request body' }
  }
  const jsonParsed = ((): unknown => {
    try {
      return JSON.parse(bodyRead.text)
    } catch {
      return null
    }
  })()
  if (jsonParsed === null) {
    return { success: false, status: 400, error: 'bad_request', message: 'Invalid JSON body' }
  }
  const schemaParsed = SummarizeRequestSchema.safeParse(jsonParsed)
  if (!schemaParsed.success) {
    return { success: false, status: 400, error: 'bad_request', message: 'Body does not match { name?, pages: [{ page, content }], language_label? }' }
  }
  const name = schemaParsed.data.name ?? null
  const languageLabel = schemaParsed.data.language_label ?? 'English'
  return { success: true, name, pages: schemaParsed.data.pages, languageLabel }
}

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
        if (!isOriginAllowed(request)) {
          return Response.json({ error: 'forbidden_origin' }, { status: 403 })
        }
        const shareId = getShareParam(request)
        const resolution = resolveApiKey(shareId)
        switch (resolution.kind) {
          case 'shared':
          case 'default':
            break
          case 'share_required':
            return Response.json(
              { error: 'share_required', message: 'Invite link required' },
              { status: 401 },
            )
          case 'server_misconfigured':
            return Response.json(
              {
                error: 'server_misconfigured',
                message: 'Neither ANTHROPIC_API_KEY nor SHARED_API_KEYS is set',
              },
              { status: 500 },
            )
          default:
            resolution satisfies never
            return Response.json({ error: 'server_misconfigured' }, { status: 500 })
        }
        const apiKey = resolution.apiKey

        const body = await parseBody(request)
        if (!body.success) {
          return Response.json({ error: body.error, message: body.message }, { status: body.status })
        }

        const ip = getClientIp(request)
        const ipHash = await hashIp(ip)
        const decision = rateLimiter.check(ipHash)
        if (!decision.allowed) {
          return Response.json({ error: 'rate_limited', reason: decision.reason }, { status: 429 })
        }

        const anthropic = createAnthropic({ apiKey })
        const delimiter = generateDelimiter()
        const userPrompt = `Document name: ${body.name ?? 'unknown'}\nResponse language: ${body.languageLabel}\nPage delimiter: ${delimiter}\n\n${renderPages({ pages: body.pages, delimiter })}`

        const result = await generateText({
          model: anthropic(MODEL_ID),
          system: SYSTEM_PROMPT,
          prompt: userPrompt,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          maxRetries: 1,
        })

        console.info('[copilot] summarize.done', {
          ip_hash: ipHash,
          input_chars: userPrompt.length,
          output_chars: result.text.length,
          language: body.languageLabel,
        })

        return Response.json({ summary: result.text })
      },
    },
  },
})
