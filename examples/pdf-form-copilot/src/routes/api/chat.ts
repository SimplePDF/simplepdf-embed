import { createFileRoute } from '@tanstack/react-router'
import { createAnthropic } from '@ai-sdk/anthropic'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import {
  ChatRequestSchema,
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
import { getShareParam, resolveApiKey } from '../../server/shared_keys'

const MODEL_ID = 'claude-haiku-4-5-20251001'
const MAX_DURATION_MS = 60_000
const MAX_BODY_BYTES = 256 * 1024
// Cap on consecutive non-user POSTs (auto-continuations) per IP hash before a
// follow-up request is treated as fresh and counted against the rate limit.
// Defeats the 'always send a tool-result as the last message' free-ride trick.
const MAX_CONSECUTIVE_NON_USER_TURNS = 10
const consecutiveNonUserTurns = new Map<string, number>()

type ParsedBody =
  | { success: true; messages: UIMessage[]; languageLabel: string }
  | { success: false; status: number; error: string; message: string }

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
  const schemaParsed = ChatRequestSchema.safeParse(jsonParsed)
  if (!schemaParsed.success) {
    return { success: false, status: 400, error: 'bad_request', message: 'Body does not match { messages: UIMessage[], language_label?: string }' }
  }
  const languageLabel = schemaParsed.data.language_label ?? 'English'
  return { success: true, messages: schemaParsed.data.messages, languageLabel }
}

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

// Abuse guard: an attacker can craft a messages array ending in a fake
// tool-result (role !== 'user') and get unlimited uncounted POSTs. Track how
// many non-user tail turns a given IP has chained; once past the cap, treat
// the next request as fresh.
const shouldChargeAgainstLimit = ({ ipHash, freshUserTurn }: { ipHash: string; freshUserTurn: boolean }): boolean => {
  if (freshUserTurn) {
    consecutiveNonUserTurns.set(ipHash, 0)
    return true
  }
  const current = consecutiveNonUserTurns.get(ipHash) ?? 0
  const next = current + 1
  if (next >= MAX_CONSECUTIVE_NON_USER_TURNS) {
    consecutiveNonUserTurns.set(ipHash, 0)
    return true
  }
  consecutiveNonUserTurns.set(ipHash, next)
  return false
}

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const shareId = getShareParam(request)
        const resolution = resolveApiKey(shareId)
        switch (resolution.kind) {
          case 'shared':
          case 'default':
            break
          case 'share_required':
            return Response.json(
              {
                error: 'share_required',
                message:
                  'This demo requires a valid invite link. Bring your own API key to keep going.',
              },
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
        const charged = shouldChargeAgainstLimit({ ipHash, freshUserTurn: isFreshUserTurn(body.messages) })
        const decision = charged ? rateLimiter.check(ipHash) : null
        if (decision !== null && !decision.allowed) {
          console.info('[copilot] chat.rate_limited', { ip_hash: ipHash, reason: decision.reason })
          return Response.json(
            {
              error: 'rate_limited',
              reason: decision.reason,
              message:
                "Thanks for trying the demo! Running it costs us real money, so access is capped. To keep going, use your own API key.",
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
          const existingProviderOptions = message.providerOptions ?? {}
          const existingAnthropic = existingProviderOptions.anthropic ?? {}
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

        const streamStartedAt = Date.now()

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
            console.info('[copilot] chat.finished', {
              ip_hash: ipHash,
              input_tokens: usage.inputTokens,
              output_tokens: usage.outputTokens,
              cached_input_tokens: usage.cachedInputTokens,
              elapsed_ms: Date.now() - streamStartedAt,
            })
          },
        })

        console.info('[copilot] chat.streaming', {
          ip_hash: ipHash,
          counted_against_limit: charged,
          remaining_lifetime: decision !== null && decision.allowed ? decision.remaining : null,
          message_count: body.messages.length,
          language: body.languageLabel,
          share_used: resolution.kind === 'shared',
        })

        return result.toUIMessageStreamResponse()
      },
    },
  },
})
