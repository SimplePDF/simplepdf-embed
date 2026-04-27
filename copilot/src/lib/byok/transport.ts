import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { buildSystemPrompt } from '../../server/tools'
import {
  FINALISATION_ACTION,
  LLM_STATIC_TOOLS,
  withFinalisationTool,
} from '../embed-bridge-adapters/client-tools'
import { formatStreamError } from '../error-classifier'
import { monitoring, normalizeError } from '../monitoring'
import { buildBrowserModel } from './model'
import type { ByokConfig } from './providers'

const DEFAULT_SYSTEM_PROMPT = buildSystemPrompt({ action: FINALISATION_ACTION })

const MAX_OUTPUT_TOKENS = 500

const buildLanguageInstruction = (languageLabel: string): string =>
  `Language: reply in ${languageLabel}. If the form itself is in a different language, you may quote its original text verbatim but always explain and converse in ${languageLabel}.`

type BrowserChatBody = {
  messages: UIMessage[]
  language_label?: string
}

type RunByokStreamArgs = {
  config: ByokConfig
  init: RequestInit | undefined
}

export const runByokStream = async ({ config, init }: RunByokStreamArgs): Promise<Response> => {
  const rawBody = typeof init?.body === 'string' ? init.body : ''
  const parsed = ((): BrowserChatBody | null => {
    try {
      return JSON.parse(rawBody)
    } catch {
      return null
    }
  })()
  if (parsed === null || !Array.isArray(parsed.messages)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  const languageLabel =
    typeof parsed.language_label === 'string' && parsed.language_label.trim() !== ''
      ? parsed.language_label.trim()
      : 'English'

  const modelMessages = await convertToModelMessages(parsed.messages)
  // Default cached for the demo / no-customisation path; a custom prompt
  // changes per BYOK user so caching it would just churn the breakpoint.
  const systemContent =
    config.customInstructions === null
      ? DEFAULT_SYSTEM_PROMPT
      : buildSystemPrompt({
          action: FINALISATION_ACTION,
          customInstructions: config.customInstructions,
        })
  const cacheControl =
    config.customInstructions === null
      ? { anthropic: { cacheControl: { type: 'ephemeral' as const } } }
      : undefined
  monitoring.info('byok.system_prompt_built', {
    provider: config.provider,
    model: config.model,
    instructions_mode: config.customInstructions?.mode ?? null,
    instructions_length: config.customInstructions?.text.length ?? 0,
    system_prompt_length: systemContent.length,
  })
  const result = streamText({
    model: buildBrowserModel(config),
    messages: [
      { role: 'system', content: systemContent, providerOptions: cacheControl },
      { role: 'system', content: buildLanguageInstruction(languageLabel) },
      ...modelMessages,
    ],
    // useChat.stop() aborts the signal on `init`. forwarding it to
    // streamText is what makes the Stop button actually kill the inflight
    // provider request on the BYOK path. `RequestInit.signal` is typed as
    // `AbortSignal | null`; streamText wants `AbortSignal | undefined`, so
    // coalesce the null to undefined.
    abortSignal: init?.signal ?? undefined,
    maxRetries: 0,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    tools: withFinalisationTool(LLM_STATIC_TOOLS),
    onError: ({ error }) => {
      monitoring.error('byok.stream_error', { detail: normalizeError(error) })
    },
  })
  return result.toUIMessageStreamResponse({
    onError: formatStreamError,
  })
}
