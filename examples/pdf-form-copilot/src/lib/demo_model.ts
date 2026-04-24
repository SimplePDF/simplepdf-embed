import { z } from 'zod'

// Friendly handles for the models the demo is willing to run on a shared
// invite key. Each handle maps to one provider + one specific model id so
// the SHARED_API_KEYS config stays small (an operator sets
// "model": "haiku_4_5" and never has to remember the fully-qualified
// provider-model-id). The label is the string shown above "Switch AI
// model" in the chat header.
export type DemoModel = 'haiku_4_5' | 'deepseek_flash_v4'

export const DemoModelSchema = z.enum(['haiku_4_5', 'deepseek_flash_v4'])

type DemoModelConfig = {
  provider: 'anthropic' | 'deepseek'
  modelId: string
  label: string
}

export const DEMO_MODELS: Record<DemoModel, DemoModelConfig> = {
  haiku_4_5: {
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
  },
  deepseek_flash_v4: {
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    label: 'DeepSeek V3.2',
  },
}

export const getDemoModelConfig = (model: DemoModel): DemoModelConfig => DEMO_MODELS[model]
