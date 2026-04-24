import { createFileRoute } from '@tanstack/react-router'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { DEMO_MODELS } from '../../lib/demo_model'
import {
  DetectFieldsInput,
  FocusFieldInput,
  GetDocumentContentInput,
  GetFieldsInput,
  GoToPageInput,
  SelectToolInput,
  SetFieldValueInput,
  SubmitDownloadInput,
} from '../../lib/embed-bridge-adapters/client-tools'
import { monitoring, normalizeError } from '../../lib/monitoring'
import { parseJsonBody, shouldChargeAgainstLimit } from '../../server/http'
import { buildLanguageModel } from '../../server/language_model'
import { getClientIp, hashIp, isSameOrigin, rateLimiter } from '../../server/rate_limit'
import { readShareIdFromUrl } from '../../server/share_query'
import { resolveApiKey } from '../../server/shared_keys'
import { ChatRequestSchema, SYSTEM_PROMPT } from '../../server/tools'

const MAX_DURATION_MS = 60_000
const MAX_BODY_BYTES = 256 * 1024

const getUpstreamStatus = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null) {
    return null
  }
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode
  }
  if ('status' in error && typeof error.status === 'number') {
    return error.status
  }
  return null
}

// Serialises a stream-level error from the provider into a payload the client
// classifier will recognise. The shared-key path is the only one that hits
// /api/chat (BYOK bypasses the server entirely), so an upstream auth / billing
// / quota refusal here is a "demo key is spent / disabled" signal from the
// user's perspective — surface it as the demo_rate_limited banner instead of
// an auth error, so the UX reads the same whether we hit the per-share
// lifetime cap or Anthropic revoked our key.
//
// Narrow list of statuses that mean "the shared key can't serve this
// request": 401 auth, 402 payment required, 403 forbidden/quota, 429 rate
// limited. Any other 4xx (400 bad request, 404, 413, 422, ...) falls through
// so the generic panel can show the actual diagnostic instead of a misleading
// "demo is capped" banner. 5xx stays as a server error.
//
// No user-facing copy here — the client's RateLimitPanel renders the
// localised chat.errorRateLimited* strings on its own once the classifier
// tags this as demo_rate_limited.
const DEMO_KEY_REJECTED_STATUSES = new Set([401, 402, 403, 429])

const serializeStreamError = (error: unknown): string => {
  const status = getUpstreamStatus(error)
  if (status !== null && DEMO_KEY_REJECTED_STATUSES.has(status)) {
    return JSON.stringify({
      error: 'rate_limited',
      reason: 'demo_key_rejected',
    })
  }
  return error instanceof Error ? error.message : String(error)
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

const tagLastMessageForCache = (messages: Awaited<ReturnType<typeof convertToModelMessages>>) =>
  messages.map((message, index) => {
    if (index !== messages.length - 1) {
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

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) {
          return Response.json({ error: 'forbidden_origin' }, { status: 403 })
        }
        const shareId = readShareIdFromUrl(request)
        const resolution = resolveApiKey(shareId)
        if (resolution.kind === 'share_required') {
          // Message omitted on purpose — the client's ErrorBanner renders
          // localised chat.errorAuth* strings for the authentication kind.
          return Response.json({ error: 'share_required' }, { status: 401 })
        }

        const body = await parseJsonBody({
          request,
          maxBytes: MAX_BODY_BYTES,
          schema: ChatRequestSchema,
          schemaErrorMessage: 'Body does not match { messages: UIMessage[], language_label?: string }',
        })
        if (!body.success) {
          return Response.json({ error: body.error, message: body.message }, { status: body.status })
        }
        const messages = body.data.messages
        const languageLabel = body.data.language_label ?? 'English'

        // Fail-closed guard: any time the limiter itself is not operational,
        // block the stream — regardless of whether this particular turn would
        // be charged. Covers synthetic continuations + auto tool-result POSTs
        // which normally bypass the check().
        if (!rateLimiter.isReady()) {
          monitoring.error('chat.blocked_system_failure', {
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
        const charged = shouldChargeAgainstLimit({
          ipHash,
          freshUserTurn: isFreshUserTurn(messages),
        })
        // Fail-closed: any throw from rateLimiter.check surfaces as 503 so we
        // never serve the LLM when the cost control is unreliable.
        const decision = ((): ReturnType<typeof rateLimiter.check> | null => {
          if (!charged) {
            return null
          }
          try {
            return rateLimiter.check({
              bucket: resolution.bucket,
              ipHash,
              lifetime: resolution.lifetime,
            })
          } catch (error) {
            const detail = normalizeError(error)
            monitoring.error('rate_limit.check_threw', { ip_hash: ipHash, detail })
            return { allowed: false, reason: 'system_failure', detail: `threw:${detail}` }
          }
        })()
        if (decision !== null && !decision.allowed) {
          if (decision.reason === 'system_failure') {
            monitoring.error('chat.blocked_system_failure', {
              ip_hash: ipHash,
              detail: decision.detail,
            })
            return Response.json(
              { error: 'service_unavailable', reason: 'rate_limit_unavailable' },
              { status: 503 },
            )
          }
          monitoring.info('chat.rate_limited', { ip_hash: ipHash, reason: decision.reason })
          return Response.json(
            {
              error: 'rate_limited',
              reason: decision.reason,
            },
            { status: 429 },
          )
        }

        // Anthropic supports prompt caching via providerOptions; DeepSeek
        // does not. Skip the cache tags on non-Anthropic models so the
        // provider doesn't reject the request.
        const modelProvider = DEMO_MODELS[resolution.model].provider
        const useAnthropicCache = modelProvider === 'anthropic'
        const convertedMessages = await convertToModelMessages(messages)
        const modelMessages = useAnthropicCache
          ? tagLastMessageForCache(convertedMessages)
          : convertedMessages
        const languageInstruction = `Language: reply in ${languageLabel}. If the form itself is in a different language, you may quote its original text verbatim but always explain and converse in ${languageLabel}.`

        const streamStartedAt = Date.now()

        const result = streamText({
          model: buildLanguageModel({ model: resolution.model, apiKey: resolution.apiKey }),
          messages: [
            useAnthropicCache
              ? {
                  role: 'system',
                  content: SYSTEM_PROMPT,
                  providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
                }
              : { role: 'system', content: SYSTEM_PROMPT },
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
                'Switches the editor tool (TEXT, BOXED_TEXT, CHECKBOX, SIGNATURE, PICTURE, or null for cursor). Use TEXT to invite the user to drop fields on a scanned document that has no native fields.',
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
              description:
                'Finalizes the filled PDF and triggers a download. Use only when the user asks to submit.',
              inputSchema: SubmitDownloadInput,
            },
          },
          abortSignal: AbortSignal.timeout(MAX_DURATION_MS),
          onFinish: ({ usage }) => {
            monitoring.info('chat.finished', {
              ip_hash: ipHash,
              input_tokens: usage.inputTokens,
              output_tokens: usage.outputTokens,
              cached_input_tokens: usage.cachedInputTokens,
              elapsed_ms: Date.now() - streamStartedAt,
            })
          },
        })

        const remainingLifetime = ((): number | null => {
          if (decision === null || !decision.allowed) {
            return null
          }
          return decision.remaining
        })()

        monitoring.info('chat.streaming', {
          ip_hash: ipHash,
          counted_against_limit: charged,
          remaining_lifetime: remainingLifetime,
          message_count: messages.length,
          language: languageLabel,
        })

        return result.toUIMessageStreamResponse({ onError: serializeStreamError })
      },
    },
  },
})
