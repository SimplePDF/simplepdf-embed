import { z } from 'zod'

export type ByokProviderId = 'openai' | 'anthropic' | 'deepseek' | 'google' | 'mistral' | 'custom'
type UnsupportedProviderId = 'azure' | 'bedrock'

export type ByokModel = {
  id: string
  label: string
  description: string
  recommended: boolean
}

export type CustomInstructions = { mode: 'append' | 'replace'; text: string }

export type ByokConfig =
  | {
      provider: Exclude<ByokProviderId, 'custom'>
      model: string
      apiKey: string
      customInstructions: CustomInstructions | null
    }
  | {
      provider: 'custom'
      model: string
      apiKey: string
      baseUrl: string
      customInstructions: CustomInstructions | null
    }

// Cap kept in sync with the textarea cap in the picker UI. Beyond ~8KB the
// Anthropic prompt-cache breakpoint thrashes and the LLM starts getting
// confused; values larger than this would also be a strong signal something
// pasted a whole document into the prompt by accident.
export const CUSTOM_INSTRUCTIONS_MAX_CHARS = 8192

const CustomInstructionsSchema: z.ZodType<CustomInstructions> = z.object({
  mode: z.enum(['append', 'replace']),
  text: z.string().max(CUSTOM_INSTRUCTIONS_MAX_CHARS),
})

// Runtime validation for vault round-trip: a disk-read config is untrusted
// (corrupt blob, tampered profile, version mismatch) until it parses through
// this schema.
export const ByokConfigSchema: z.ZodType<ByokConfig> = z.discriminatedUnion('provider', [
  z.object({
    provider: z.enum(['openai', 'anthropic', 'deepseek', 'google', 'mistral']),
    model: z.string().min(1),
    apiKey: z.string(),
    customInstructions: CustomInstructionsSchema.nullable(),
  }),
  z.object({
    provider: z.literal('custom'),
    model: z.string().min(1),
    apiKey: z.string(),
    baseUrl: z.string().min(1),
    customInstructions: CustomInstructionsSchema.nullable(),
  }),
])

type CatalogProviderSpec = {
  id: Exclude<ByokProviderId, 'custom'>
  kind: 'catalog'
  labelKey: string
  supported: true
  models: ByokModel[]
}

type CustomProviderSpec = {
  id: 'custom'
  kind: 'custom'
  labelKey: string
  supported: true
  defaults: {
    baseUrl: string
    model: string
  }
}

type UnsupportedProviderSpec = {
  id: UnsupportedProviderId
  labelKey: string
  supported: false
}

export type ProviderEntry = CatalogProviderSpec | CustomProviderSpec | UnsupportedProviderSpec
export type SupportedProviderSpec = CatalogProviderSpec | CustomProviderSpec

export const PROVIDER_ENTRIES: ProviderEntry[] = [
  {
    id: 'openai',
    kind: 'catalog',
    labelKey: 'chat.modelPicker.providerOpenai',
    supported: true,
    models: [
      {
        id: 'gpt-5-mini',
        label: 'GPT-5 mini',
        description: 'Fast and inexpensive. Fine for most form-filling.',
        recommended: true,
      },
      {
        id: 'gpt-5',
        label: 'GPT-5',
        description: 'Higher reasoning for tricky forms',
        recommended: false,
      },
    ],
  },
  {
    id: 'anthropic',
    kind: 'catalog',
    labelKey: 'chat.modelPicker.providerAnthropic',
    supported: true,
    models: [
      {
        id: 'claude-haiku-4-5-20251001',
        label: 'Claude Haiku 4.5',
        description: 'Fast and inexpensive. Same model running the demo.',
        recommended: true,
      },
      {
        id: 'claude-sonnet-4-6-20251008',
        label: 'Claude Sonnet 4.6',
        description: 'Higher reasoning for tricky forms',
        recommended: false,
      },
    ],
  },
  {
    id: 'deepseek',
    kind: 'catalog',
    labelKey: 'chat.modelPicker.providerDeepseek',
    supported: true,
    models: [
      {
        id: 'deepseek-chat',
        label: 'DeepSeek V4 Flash',
        description: 'Fast and inexpensive. Same model running the demo.',
        recommended: true,
      },
      {
        id: 'deepseek-reasoner',
        label: 'DeepSeek V4 Pro',
        description: 'Chain-of-thought mode for tricky forms',
        recommended: false,
      },
    ],
  },
  {
    id: 'google',
    kind: 'catalog',
    labelKey: 'chat.modelPicker.providerGoogle',
    supported: true,
    models: [
      {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        description: 'Fast and inexpensive. Fine for most form-filling.',
        recommended: true,
      },
      {
        id: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        description: 'Higher reasoning for tricky forms',
        recommended: false,
      },
    ],
  },
  {
    id: 'mistral',
    kind: 'catalog',
    labelKey: 'chat.modelPicker.providerMistral',
    supported: true,
    models: [
      {
        id: 'mistral-small-latest',
        label: 'Mistral Small',
        description: 'Fast and inexpensive. Fine for most form-filling.',
        recommended: true,
      },
      {
        id: 'mistral-large-latest',
        label: 'Mistral Large',
        description: 'Higher reasoning for tricky forms',
        recommended: false,
      },
    ],
  },
  {
    id: 'custom',
    kind: 'custom',
    labelKey: 'chat.modelPicker.providerCustom',
    supported: true,
    defaults: {
      // Ollama's OpenAI-compatible port + Qwen 3.6 27B as the baseline
      //. strong tool-use at ~16 GB VRAM, Apache 2.0, easy `ollama pull`.
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen3.6:27b',
    },
  },
  { id: 'azure', labelKey: 'chat.modelPicker.providerAzure', supported: false },
  { id: 'bedrock', labelKey: 'chat.modelPicker.providerBedrock', supported: false },
]

export const findProvider = (id: ByokProviderId): SupportedProviderSpec => {
  const entry = PROVIDER_ENTRIES.find((candidate) => candidate.id === id && candidate.supported === true)
  if (entry === undefined || entry.supported !== true) {
    throw new Error(`Unknown BYOK provider: ${id}`)
  }
  return entry
}

export const defaultModelFor = (providerId: Exclude<ByokProviderId, 'custom'>): ByokModel => {
  const provider = findProvider(providerId)
  if (provider.kind !== 'catalog') {
    throw new Error(`defaultModelFor called on non-catalog provider: ${providerId}`)
  }
  return provider.models.find((model) => model.recommended) ?? provider.models[0]
}
