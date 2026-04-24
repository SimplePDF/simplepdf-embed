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
import { isMisbehaving, markMisbehavior } from '../../server/misbehavior'
import {
  getClientIp,
  hashIp,
  isSameOrigin,
  looksLikeBrowserFetch,
  rateLimiter,
} from '../../server/rate_limit'
import { readShareIdFromUrl } from '../../server/share_query'
import { resolveApiKey } from '../../server/shared_keys'
import { serializeStreamError } from '../../server/stream_error'
import { ChatRequestSchema, SYSTEM_PROMPT } from '../../server/tools'

const MAX_DURATION_MS = 60_000
const MAX_BODY_BYTES = 256 * 1024

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
        const ip = getClientIp(request)
        const ipHash = await hashIp(ip)
        if (isMisbehaving(ipHash)) {
          return Response.json({ error: 'forbidden_blocked' }, { status: 403 })
        }
        // Same-origin is the happy path; Sec-Fetch-* is the second-chance
        // lane for privacy-hardened browsers that strip Origin/Referer.
        // If neither passes, the caller is almost certainly not a browser
        // (curl, bot, non-browser script) — flag + 403.
        if (!isSameOrigin(request) && !looksLikeBrowserFetch(request)) {
          markMisbehavior(ipHash, 'non_browser_origin')
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
