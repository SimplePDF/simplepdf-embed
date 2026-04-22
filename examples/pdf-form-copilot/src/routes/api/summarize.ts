import { createFileRoute } from '@tanstack/react-router'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { getClientIp, hashIp, rateLimiter } from '../../server/rate_limit'

const MODEL_ID = 'claude-haiku-4-5-20251001'
const MAX_INPUT_CHARS = 20_000
const MAX_OUTPUT_TOKENS = 350

type SummarizePage = { page: number; content: string }

type SummarizeRequestBody = { name?: string; pages?: SummarizePage[]; language_label?: string }

type ParsedBody =
  | { success: true; name: string | null; pages: SummarizePage[]; languageLabel: string }
  | { success: false; status: number; message: string }

const SYSTEM_PROMPT = `You compress a PDF form's extracted text into a dense summary for another LLM that will help a user fill the form.

Rules:
- Output at most ~250 words total.
- Keep information the filling assistant needs: form purpose, sections, what each section asks for, any notable constraints or instructions (language, deadlines, units).
- Omit legal boilerplate, page numbers, headers, footers, URLs.
- Preserve section titles verbatim when the form uses them.
- Plain text; bullet points per section are fine.`

const parseBody = async (request: Request): Promise<ParsedBody> => {
  if (request.headers.get('content-type')?.includes('application/json') !== true) {
    return { success: false, status: 415, message: 'Expected application/json' }
  }
  const raw = await request.text()
  if (raw === '') {
    return { success: false, status: 400, message: 'Empty request body' }
  }
  const parsed = ((): unknown => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })()
  if (parsed === null || typeof parsed !== 'object') {
    return { success: false, status: 400, message: 'Invalid JSON body' }
  }
  const body = parsed as SummarizeRequestBody
  if (!Array.isArray(body.pages)) {
    return { success: false, status: 400, message: 'Expected { pages: [{ page, content }] }' }
  }
  const pages: SummarizePage[] = []
  for (const raw of body.pages) {
    if (raw === null || typeof raw !== 'object') {
      return { success: false, status: 400, message: 'Each page must be an object' }
    }
    const page = (raw as { page?: unknown }).page
    const content = (raw as { content?: unknown }).content
    if (typeof page !== 'number' || typeof content !== 'string') {
      return { success: false, status: 400, message: 'Each page needs { page: number, content: string }' }
    }
    pages.push({ page, content })
  }
  const name = typeof body.name === 'string' ? body.name : null
  const rawLabel = body.language_label
  const languageLabel = typeof rawLabel === 'string' && rawLabel.trim() !== '' ? rawLabel.trim() : 'English'
  return { success: true, name, pages, languageLabel }
}

const renderPages = (pages: SummarizePage[]): string => {
  const joined = pages
    .map((page) => `--- Page ${page.page} ---\n${page.content.trim()}`)
    .join('\n\n')
  if (joined.length <= MAX_INPUT_CHARS) {
    return joined
  }
  return `${joined.slice(0, MAX_INPUT_CHARS)}\n\n[truncated]`
}

export const Route = createFileRoute('/api/summarize')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (apiKey === undefined || apiKey === '') {
          return Response.json(
            { error: 'server_misconfigured', message: 'ANTHROPIC_API_KEY is not set' },
            { status: 500 },
          )
        }

        const body = await parseBody(request)
        if (!body.success) {
          return Response.json({ error: 'bad_request', message: body.message }, { status: body.status })
        }

        const ip = getClientIp(request)
        const ipHash = await hashIp(ip)
        const decision = rateLimiter.check(ipHash)
        if (!decision.allowed) {
          return Response.json(
            { error: 'rate_limited', reason: decision.reason, retry_after_seconds: decision.retryAfterSeconds },
            { status: 429, headers: { 'retry-after': decision.retryAfterSeconds.toString() } },
          )
        }

        const anthropic = createAnthropic({ apiKey })
        const userPrompt = `Document name: ${body.name ?? 'unknown'}\nResponse language: ${body.languageLabel}\n\n${renderPages(body.pages)}`

        const result = await generateText({
          model: anthropic(MODEL_ID),
          system: SYSTEM_PROMPT,
          prompt: userPrompt,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          maxRetries: 1,
        })

        console.info('summarize.done', {
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
