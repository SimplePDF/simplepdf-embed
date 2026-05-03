import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import type { SharedV2ProviderOptions } from '@ai-sdk/provider'
import type { ByokConfig } from './providers'

// OpenAI reasoning models (gpt-5*, o1*, o3*, o4*) count internal reasoning
// tokens against `max_output_tokens`. Without an effort cap the API defaults
// to "medium", which eats hundreds of reasoning tokens before any tool call
// or text, easily truncating a 500-token cap mid-thought. "minimal" is too
// dumb for our flow — the model emits zero reasoning tokens per turn and
// stops evaluating the conditional in the system prompt (e.g. fires
// detect_fields even when get_fields already returned a non-empty list).
// "low" gives ~50-200 reasoning tokens per turn, enough to follow the
// playbook, while staying far cheaper than the medium default.
const isOpenAiReasoningModel = (config: ByokConfig): boolean => {
  if (config.provider !== 'openai') {
    return false
  }
  return (
    config.model.startsWith('gpt-5') ||
    config.model.startsWith('o1') ||
    config.model.startsWith('o3') ||
    config.model.startsWith('o4')
  )
}

type RequestTuning = {
  providerOptions: SharedV2ProviderOptions | undefined
  // Reasoning tokens count against max_output_tokens, so callers must lift
  // their default cap to leave room for reasoning + tool calls + text.
  maxOutputTokensFloor: number
}

export const getRequestTuning = (config: ByokConfig): RequestTuning => {
  if (isOpenAiReasoningModel(config)) {
    return {
      providerOptions: { openai: { reasoningEffort: 'low' } },
      maxOutputTokensFloor: 4096,
    }
  }
  return { providerOptions: undefined, maxOutputTokensFloor: 0 }
}

// Single source of truth for the browser-direct LanguageModel wiring shared
// by `validate.ts` (probe) and `transport.ts` (stream). Adding a fourth BYOK
// provider is now a one-switch edit in one file.
export const buildBrowserModel = (config: ByokConfig) => {
  switch (config.provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        // SimplePDF never sees this key. it lives only in tab memory. The
        // header is Anthropic's opt-in for browser-direct API calls.
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      })
      return anthropic(config.model)
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: config.apiKey })
      return openai(config.model)
    }
    case 'deepseek': {
      const deepseek = createDeepSeek({ apiKey: config.apiKey })
      return deepseek(config.model)
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: config.apiKey })
      return google(config.model)
    }
    case 'mistral': {
      const mistral = createMistral({ apiKey: config.apiKey })
      return mistral(config.model)
    }
    case 'custom':
      return buildCustomModel(config)
    default:
      config satisfies never
      throw new Error('Unsupported BYOK provider')
  }
}

type CustomConfig = Extract<ByokConfig, { provider: 'custom' }>

// Builds the language model for a Custom (OpenAI-compatible) endpoint.
// - Pins `/v1/chat/completions` via `.chat()` since the SDK default targets
//   `/v1/responses`, which LM Studio / Ollama / vLLM / OpenRouter do NOT
//   implement.
// - When the user left the API key blank, strips the `Authorization` header
//   entirely via a fetch wrapper so servers that enforce auth return a
//   truthful 401 instead of rejecting a bogus `Bearer not-required`. CORS
//   preflights still fire due to the JSON content type. that is a separate,
//   browser-enforced check the user's server must allow.
const buildCustomModel = (config: CustomConfig) => {
  const trimmedKey = config.apiKey.trim()
  const fetchImpl: typeof fetch | undefined =
    trimmedKey === ''
      ? async (input, init) => {
          const headers = new Headers(init?.headers)
          headers.delete('authorization')
          return fetch(input, { ...init, headers })
        }
      : undefined
  const openai = createOpenAI({
    apiKey: trimmedKey === '' ? 'not-required' : trimmedKey,
    baseURL: config.baseUrl,
    fetch: fetchImpl,
  })
  return openai.chat(config.model)
}
