import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import type { LanguageModel } from 'ai'
import { DEMO_MODELS, type DemoModel } from '../lib/demo/demo_model'

// Lives in src/server/ (not src/lib/) so the provider SDK imports stay out
// of the client bundle. Both /api/chat and /api/summarize dispatch through
// this helper; adding a third provider only requires an entry in
// DEMO_MODELS + a new case here (the `satisfies never` guard below fails
// the build if the new provider is forgotten).
export const buildLanguageModel = ({
  model,
  apiKey,
}: {
  model: DemoModel
  apiKey: string
}): LanguageModel => {
  const config = DEMO_MODELS[model]
  switch (config.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(config.modelId)
    case 'deepseek':
      return createDeepSeek({ apiKey })(config.modelId)
    default:
      config.provider satisfies never
      throw new Error(`Unhandled provider: ${String(config.provider)}`)
  }
}
