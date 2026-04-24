export type ByokProviderId = 'anthropic' | 'openai'

export type ByokModel = {
  id: string
  label: string
  description: string
  recommended: boolean
}

export type ByokConfig = {
  provider: ByokProviderId
  model: string
  apiKey: string
}

type ProviderSpec = {
  id: ByokProviderId
  labelKey: string
  supported: true
  models: ByokModel[]
}

type UnsupportedProviderSpec = {
  id: 'azure' | 'bedrock' | 'vertex' | 'databricks'
  labelKey: string
  supported: false
}

export type ProviderEntry = ProviderSpec | UnsupportedProviderSpec

export const PROVIDER_ENTRIES: ProviderEntry[] = [
  {
    id: 'openai',
    labelKey: 'chat.modelPicker.providerOpenai',
    supported: true,
    models: [
      {
        id: 'gpt-5-mini',
        label: 'GPT-5 mini',
        description: 'Fast and inexpensive — fine for most form-filling',
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
    labelKey: 'chat.modelPicker.providerAnthropic',
    supported: true,
    models: [
      {
        id: 'claude-haiku-4-5-20251001',
        label: 'Claude Haiku 4.5',
        description: 'Fast and inexpensive — same model running the demo',
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
  { id: 'azure', labelKey: 'chat.modelPicker.providerAzure', supported: false },
  { id: 'bedrock', labelKey: 'chat.modelPicker.providerBedrock', supported: false },
  { id: 'vertex', labelKey: 'chat.modelPicker.providerVertex', supported: false },
  { id: 'databricks', labelKey: 'chat.modelPicker.providerDatabricks', supported: false },
]

export const findProvider = (id: ByokProviderId): ProviderSpec => {
  const entry = PROVIDER_ENTRIES.find((candidate) => candidate.id === id && candidate.supported === true)
  if (entry === undefined || entry.supported !== true) {
    throw new Error(`Unknown BYOK provider: ${id}`)
  }
  return entry
}

export const defaultModelFor = (providerId: ByokProviderId): ByokModel => {
  const provider = findProvider(providerId)
  return provider.models.find((model) => model.recommended) ?? provider.models[0]
}
