export type ByokProviderId = 'openai' | 'anthropic' | 'deepseek' | 'custom'
type UnsupportedProviderId = 'azure' | 'bedrock'

export type ByokModel = {
  id: string
  label: string
  description: string
  recommended: boolean
}

export type ByokConfig =
  | { provider: Exclude<ByokProviderId, 'custom'>; model: string; apiKey: string }
  | { provider: 'custom'; model: string; apiKey: string; baseUrl: string }

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
