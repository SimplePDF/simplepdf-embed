import { createFileRoute } from '@tanstack/react-router'
import { createAnthropic } from '@ai-sdk/anthropic'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import {
  FocusFieldInput,
  GetDocumentContentInput,
  GetFieldsInput,
  GoToPageInput,
  SetFieldValueInput,
  SubmitDownloadInput,
  SYSTEM_PROMPT,
} from '../../server/tools'
import { getClientIp, hashIp, rateLimiter } from '../../server/rate_limit'

const MODEL_ID = 'claude-haiku-4-5-20251001'
const MAX_DURATION_MS = 60_000

type ChatRequestBody = { messages: UIMessage[]; language_label?: string }

type ParsedBody =
  | { success: true; messages: UIMessage[]; languageLabel: string }
  | { success: false; status: number; message: string }

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
  if (parsed === null || typeof parsed !== 'object' || !Array.isArray((parsed as ChatRequestBody).messages)) {
    return { success: false, status: 400, message: 'Expected { messages: UIMessage[] }' }
  }
  const rawLabel = (parsed as ChatRequestBody).language_label
  const languageLabel = typeof rawLabel === 'string' && rawLabel.trim() !== '' ? rawLabel.trim() : 'English'
  return { success: true, messages: (parsed as ChatRequestBody).messages, languageLabel }
}

export const Route = createFileRoute('/api/chat')({
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
          console.info('chat.rate_limited', { ip_hash: ipHash, reason: decision.reason })
          return Response.json(
            {
              error: 'rate_limited',
              reason: decision.reason,
              retry_after_seconds: decision.retryAfterSeconds,
              message:
                decision.reason === 'hour'
                  ? `Rate limit reached. Try again in about ${Math.ceil(decision.retryAfterSeconds / 60)} minutes.`
                  : `Daily limit reached. Try again tomorrow (in ${Math.ceil(decision.retryAfterSeconds / 3600)} hours).`,
            },
            { status: 429, headers: { 'retry-after': decision.retryAfterSeconds.toString() } },
          )
        }

        const anthropic = createAnthropic({ apiKey })

        const systemPrompt = `${SYSTEM_PROMPT}\n\nLanguage: reply in ${body.languageLabel}. If the form itself is in a different language, you may quote its original text verbatim but always explain and converse in ${body.languageLabel}.`

        const result = streamText({
          model: anthropic(MODEL_ID),
          system: systemPrompt,
          messages: await convertToModelMessages(body.messages),
          maxRetries: 1,
          tools: {
            get_fields: {
              description: 'Lists every fillable field currently on the document.',
              inputSchema: GetFieldsInput,
            },
            get_document_content: {
              description: 'Extracts the textual content of the document page by page.',
              inputSchema: GetDocumentContentInput,
            },
            set_field_value: {
              description: 'Writes a value into a single field. Always focus_field first.',
              inputSchema: SetFieldValueInput,
            },
            focus_field: {
              description: 'Scrolls to and visually highlights a field.',
              inputSchema: FocusFieldInput,
            },
            go_to_page: {
              description: 'Scrolls the editor to a given 1-based page.',
              inputSchema: GoToPageInput,
            },
            submit_download: {
              description: 'Finalizes the filled PDF and triggers a download. Use only when the user asks to submit.',
              inputSchema: SubmitDownloadInput,
            },
          },
          abortSignal: AbortSignal.timeout(MAX_DURATION_MS),
        })

        console.info('chat.streaming', {
          ip_hash: ipHash,
          remaining_hour: decision.remaining.hour,
          remaining_day: decision.remaining.day,
          message_count: body.messages.length,
          language: body.languageLabel,
        })

        return result.toUIMessageStreamResponse()
      },
    },
  },
})
