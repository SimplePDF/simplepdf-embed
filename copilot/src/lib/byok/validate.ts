import { generateText } from 'ai'
import { buildBrowserModel } from './model'
import type { ByokConfig } from './providers'

export type ValidateFailureKind = 'auth' | 'model_not_found' | 'reach'
export type ValidateResult = { ok: true } | { ok: false; kind: ValidateFailureKind }

type ValidateArgs = {
  config: ByokConfig
  signal?: AbortSignal
}

const PROBE_TIMEOUT_MS = 10_000

// Sends a tiny completion against the same endpoint the chat uses. CORS
// surface is inherited from the real chat path, so a green probe means
// the conversation will work. Cost is ~20 tokens (~$1e-5) which is cheaper
// than surfacing a bad key after the first real chat turn. The cap is 16
// because the GPT-5 Responses API rejects max_output_tokens below that.
const PROBE_MAX_OUTPUT_TOKENS = 16

export const validateApiKey = async ({ config, signal }: ValidateArgs): Promise<ValidateResult> => {
  const timeoutSignal = AbortSignal.timeout(PROBE_TIMEOUT_MS)
  const abortSignal = signal !== undefined ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  try {
    await generateText({
      model: buildBrowserModel(config),
      prompt: 'ping',
      maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      abortSignal,
    })
    return { ok: true }
  } catch (error) {
    if (abortSignal.aborted && signal?.aborted === true) {
      throw error
    }
    return { ok: false, kind: classifyFailure(error) }
  }
}

const classifyFailure = (error: unknown): ValidateFailureKind => {
  const status = getStatusCode(error)
  if (status === 401 || status === 403) {
    return 'auth'
  }
  if (status === 404) {
    return 'model_not_found'
  }
  return 'reach'
}

const getStatusCode = (value: unknown): number | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  if ('statusCode' in value && typeof value.statusCode === 'number') {
    return value.statusCode
  }
  if ('status' in value && typeof value.status === 'number') {
    return value.status
  }
  if ('cause' in value) {
    return getStatusCode(value.cause)
  }
  return null
}
