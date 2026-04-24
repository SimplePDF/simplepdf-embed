import { z } from 'zod'
import { type DemoModel, DemoModelSchema } from '../lib/demo_model'
import { monitoring } from '../lib/monitoring'

// Invite-link BYOK is the only server-paid path. SHARED_API_KEYS is a
// stringified JSON map of share-id -> { api_key, rate_limit_turns_lifetime,
// model }. Each share carries its own lifetime cap so different invites
// have independent budgets, and its own model handle so one invite can run
// Haiku while another runs DeepSeek (or future additions). Share-id values
// are never logged.
//
// There is NO default / open / hybrid mode. Requests without a valid ?share=
// return 401. Anyone who wants to run the demo without an invite link brings
// their own key via the Model Picker; BYOK is browser-direct and never hits
// this server.

const ShareConfigSchema = z.object({
  api_key: z.string().min(1),
  rate_limit_turns_lifetime: z.number().int().positive(),
  model: DemoModelSchema,
})

const SharedKeysSchema = z.record(z.string(), ShareConfigSchema)

type ShareConfig = z.infer<typeof ShareConfigSchema>

// Reserved sentinel for the default-key bucket in the rate-limit state.
// Share ids equal to this string are rejected at parse time to prevent
// accidental collisions with legacy persisted blobs.
const DEFAULT_BUCKET = '__default__'

export type SharedKeyResolution =
  | { kind: 'shared'; apiKey: string; lifetime: number; bucket: string; model: DemoModel }
  | { kind: 'share_required' }
  | { kind: 'misconfigured' }

type Config = {
  sharedKeys: ReadonlyMap<string, ShareConfig>
}

type ParseEnvResult =
  | { ok: true; data: unknown; source: 'json' | 'base64' }
  | { ok: false; detail: string }

// Strip one pair of wrapping quotes (single or double) if present. Operators
// often paste `'{"dev":...}'` or `"{...}"` from shell history into the env
// UI, which round-trips through base64 as a quoted blob. JSON.parse rejects
// both, so we peel one layer before retrying.
const unquote = (input: string): string => {
  if (input.length < 2) {
    return input
  }
  const first = input.at(0)
  const last = input.at(-1)
  if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
    return input.slice(1, -1)
  }
  return input
}

const tryJsonParse = (input: string): { ok: true; data: unknown } | { ok: false; error: Error } => {
  try {
    return { ok: true, data: JSON.parse(input) }
  } catch (e) {
    return { ok: false, error: e as Error }
  }
}

// Accept either plain JSON or base64-encoded JSON. Plain is the default;
// base64 exists because DigitalOcean App Platform (and other hosts with
// quote-sensitive env-var UIs / YAML app specs) sometimes mangle the
// embedded `"` or surrounding quotes, breaking JSON.parse. Base64 is
// ASCII-only with no quote characters, so it survives any input path.
//
// Operator encodes with e.g. `base64 -w0 <<< '{"dev":{...}}'` and pastes.
// The parser tries plain JSON first, falls back to base64-then-JSON. On
// either path we also try an un-quoted variant to absorb accidental
// shell-style wrapping. On full failure we surface every attempted error
// so an operator can tell at a glance which path was expected and why.
const parseShareEnv = (raw: string): ParseEnvResult => {
  const trimmed = raw.trim()
  const plainResult = tryJsonParse(trimmed)
  if (plainResult.ok) {
    return { ok: true, data: plainResult.data, source: 'json' }
  }
  const plainUnquoted = unquote(trimmed)
  if (plainUnquoted !== trimmed) {
    const retried = tryJsonParse(plainUnquoted)
    if (retried.ok) {
      return { ok: true, data: retried.data, source: 'json' }
    }
  }
  const decoded = Buffer.from(trimmed, 'base64').toString('utf-8').trim()
  const base64Result = tryJsonParse(decoded)
  if (base64Result.ok) {
    return { ok: true, data: base64Result.data, source: 'base64' }
  }
  const base64Unquoted = unquote(decoded)
  if (base64Unquoted !== decoded) {
    const retried = tryJsonParse(base64Unquoted)
    if (retried.ok) {
      return { ok: true, data: retried.data, source: 'base64' }
    }
  }
  return {
    ok: false,
    detail: `plain_json: ${plainResult.error.message}; base64_json: ${base64Result.error.message}`,
  }
}

const parseSharedKeys = (): ReadonlyMap<string, ShareConfig> | null => {
  const raw = process.env.SHARED_API_KEYS
  if (raw === undefined || raw.trim() === '') {
    monitoring.error('shared_keys.parse_failed', {
      reason: 'empty_env',
      detail: 'SHARED_API_KEYS is not set',
    })
    return null
  }
  const envResult = parseShareEnv(raw)
  if (!envResult.ok) {
    monitoring.error('shared_keys.parse_failed', {
      reason: 'invalid_json',
      detail: envResult.detail,
    })
    return null
  }
  const schemaParsed = SharedKeysSchema.safeParse(envResult.data)
  if (!schemaParsed.success) {
    monitoring.error('shared_keys.parse_failed', {
      reason: 'schema_mismatch',
      detail: `parsed_via=${envResult.source}\n${z.prettifyError(schemaParsed.error)}`,
    })
    return null
  }
  const entries: Array<[string, ShareConfig]> = []
  for (const [shareId, config] of Object.entries(schemaParsed.data)) {
    if (shareId === DEFAULT_BUCKET) {
      monitoring.warn('shared_keys.reserved_id_rejected', { share_id: DEFAULT_BUCKET })
      continue
    }
    entries.push([shareId, config])
  }
  return new Map(entries)
}

// Memoised config. Parsed + validated on first call; subsequent calls are
// free. Misconfiguration is cached too so repeat hits don't re-spam the log.
type CacheState =
  | { status: 'uninitialized' }
  | { status: 'ok'; config: Config }
  | { status: 'misconfigured' }

let cache: CacheState = { status: 'uninitialized' }

const getConfig = (): Config | null => {
  if (cache.status === 'ok') {
    return cache.config
  }
  if (cache.status === 'misconfigured') {
    return null
  }
  const sharedKeys = parseSharedKeys()
  if (sharedKeys === null) {
    cache = { status: 'misconfigured' }
    return null
  }
  if (sharedKeys.size === 0) {
    monitoring.error('shared_keys.parse_failed', {
      reason: 'empty_map',
      detail: 'no valid invites after parse + validation + reserved-id filtering',
    })
    cache = { status: 'misconfigured' }
    return null
  }
  cache = { status: 'ok', config: { sharedKeys } }
  return cache.config
}

export const resolveApiKey = (shareId: string | null): SharedKeyResolution => {
  // Null shareId: user arrived without an invite link. Return share_required
  // regardless of server config so the BYOK-first UX still works when the
  // hosted demo is misconfigured.
  if (shareId === null) {
    return { kind: 'share_required' }
  }
  const config = getConfig()
  if (config === null) {
    return { kind: 'misconfigured' }
  }
  const mapped = config.sharedKeys.get(shareId)
  if (mapped === undefined) {
    return { kind: 'share_required' }
  }
  return {
    kind: 'shared',
    apiKey: mapped.api_key,
    lifetime: mapped.rate_limit_turns_lifetime,
    bucket: shareId,
    model: mapped.model,
  }
}

export const resolveShareModel = (shareId: string | null): DemoModel | null => {
  if (shareId === null) {
    return null
  }
  const config = getConfig()
  if (config === null) {
    return null
  }
  return config.sharedKeys.get(shareId)?.model ?? null
}
