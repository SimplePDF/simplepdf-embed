import { createFileRoute } from '@tanstack/react-router'
import { createAnthropic } from '@ai-sdk/anthropic'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import {
  DetectFieldsInput,
  FocusFieldInput,
  GetDocumentContentInput,
  GetFieldsInput,
  GoToPageInput,
  SelectToolInput,
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

const isFreshUserTurn = (messages: UIMessage[]): boolean => {
  const last = messages[messages.length - 1]
  if (last === undefined || last.role !== 'user') {
    return false
  }
  const parts = last.parts
  if (!Array.isArray(parts)) {
    return false
  }
  return parts.some((part) => part.type === 'text')
}

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
        const shouldCountAgainstLimit = isFreshUserTurn(body.messages)
        const decision = shouldCountAgainstLimit ? rateLimiter.check(ipHash) : null
        if (decision !== null && !decision.allowed) {
          console.info('chat.rate_limited', { ip_hash: ipHash, reason: decision.reason })
          return Response.json(
            {
              error: 'rate_limited',
              reason: decision.reason,
              message:
                "You've reached the demo's free limit for this IP. Switch to your own API key (OpenAI or Anthropic) to keep going — the 'Switch AI model' link above does it in a couple of clicks.",
            },
            { status: 429 },
          )
        }

        const anthropic = createAnthropic({ apiKey })

        const rawModelMessages = await convertToModelMessages(body.messages)
        const modelMessages = rawModelMessages.map((message, index) => {
          if (index !== rawModelMessages.length - 1) {
            return message
          }
          const existingProviderOptions = (message.providerOptions ?? {}) as Record<string, unknown>
          const existingAnthropic =
            (existingProviderOptions.anthropic as Record<string, unknown> | undefined) ?? {}
          return {
            ...message,
            providerOptions: {
              ...existingProviderOptions,
              anthropic: {
                ...existingAnthropic,
                cacheControl: { type: 'ephemeral' },
              },
            },
          }
        })
        const languageInstruction = `Language: reply in ${body.languageLabel}. If the form itself is in a different language, you may quote its original text verbatim but always explain and converse in ${body.languageLabel}.`

        const result = streamText({
          model: anthropic(MODEL_ID),
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
              providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
            },
            { role: 'system', content: languageInstruction },
            ...modelMessages,
          ],
          maxRetries: 0,
          maxOutputTokens: 500,
          tools: {
            get_fields: {
              description: 'Lists every fillable field currently on the document.',
              inputSchema: GetFieldsInput,
            },
            get_document_content: {
              description: 'Extracts the textual content of the document page by page.',
              inputSchema: GetDocumentContentInput,
            },
            detect_fields: {
              description:
                'Asks the editor to auto-detect and create missing fields. Call this when get_fields returned 0 fields.',
              inputSchema: DetectFieldsInput,
            },
            select_tool: {
              description:
                'Switches the editor tool (TEXT, CHECKBOX, SIGNATURE, PICTURE, or null for cursor). Use TEXT to invite the user to drop fields on a scanned document that has no native fields.',
              inputSchema: SelectToolInput,
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
          onFinish: ({ usage }) => {
            console.info('chat.finished', {
              ip_hash: ipHash,
              input_tokens: usage.inputTokens,
              output_tokens: usage.outputTokens,
              cached_input_tokens: usage.cachedInputTokens,
              elapsed_ms: Date.now() - streamStartedAt,
            })
          },
        })

        const streamStartedAt = Date.now()
        console.info('chat.streaming', {
          ip_hash: ipHash,
          counted_against_limit: shouldCountAgainstLimit,
          remaining_lifetime: decision !== null && decision.allowed ? decision.remaining : null,
          message_count: body.messages.length,
          language: body.languageLabel,
        })

        return result.toUIMessageStreamResponse()
      },
    },
  },
})
