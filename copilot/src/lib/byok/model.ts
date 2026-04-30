import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import type { ByokConfig } from './providers'

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
