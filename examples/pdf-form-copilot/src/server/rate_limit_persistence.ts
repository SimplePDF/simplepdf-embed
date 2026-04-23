import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { z } from 'zod'

const PersistedEntrySchema = z.object({
  // Rate-limit namespace: either a share id from SHARED_API_KEYS, or the
  // reserved sentinel '__default__' for the ANTHROPIC_API_KEY path. Optional
  // on load for backward compat with pre-3.15 persisted blobs that had no
  // bucket field; falls back to '__default__'.
  bucket: z.string().optional().transform((value) => value ?? '__default__'),
  ipHash: z.string(),
  hits: z.number().int().nonnegative(),
})

const PersistedStateSchema = z.object({
  version: z.literal(1),
  updatedAt: z.number(),
  entries: z.array(PersistedEntrySchema),
})

export type PersistedState = z.infer<typeof PersistedStateSchema>

type PersistenceConfig = {
  client: S3Client
  bucket: string
  key: string
}

const readConfig = (): PersistenceConfig | null => {
  const endpoint = process.env.S3_ENDPOINT
  const region = process.env.S3_REGION ?? 'us-east-1'
  const bucket = process.env.S3_BUCKET
  const key = process.env.S3_RATE_LIMIT_KEY
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !key || !accessKeyId || !secretAccessKey) {
    return null
  }
  // IP_HASH_SALT becomes mandatory the moment the rate-limit state leaves
  // the process. Without a salt, a leak of the persisted blob lets anyone
  // brute-force the 2^32 IPv4 space in minutes and unmask every tracked IP.
  const salt = process.env.IP_HASH_SALT
  if (salt === undefined || salt.trim() === '') {
    throw new Error(
      'IP_HASH_SALT is required when S3 rate-limit persistence is enabled',
    )
  }
  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  })
  return { client, bucket, key }
}

export type Persistence = {
  enabled: boolean
  load: () => Promise<PersistedState | null>
  scheduleWrite: (state: PersistedState) => void
  flush: () => Promise<void>
}

const WRITE_DEBOUNCE_MS = 30_000
// Safety net: the persisted JSON can grow unbounded as unique IPs churn in.
// Drop zero-hit entries before writing and cap the total to the top N by hits
// (oldest by insertion order break ties).
const MAX_PERSISTED_ENTRIES = 10_000

const compactForPersistence = (state: PersistedState): PersistedState => {
  const nonZero = state.entries.filter((entry) => entry.hits > 0)
  if (nonZero.length <= MAX_PERSISTED_ENTRIES) {
    return { ...state, entries: nonZero }
  }
  const topN = [...nonZero].sort((a, b) => b.hits - a.hits).slice(0, MAX_PERSISTED_ENTRIES)
  return { ...state, entries: topN }
}

export const createPersistence = (): Persistence => {
  const config = readConfig()
  if (config === null) {
    return {
      enabled: false,
      load: async () => null,
      scheduleWrite: () => {},
      flush: async () => {},
    }
  }

  const { client, bucket, key } = config
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let pendingState: PersistedState | null = null

  const writeNow = async (state: PersistedState): Promise<void> => {
    const compact = compactForPersistence(state)
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: JSON.stringify(compact),
          ContentType: 'application/json',
          ACL: 'private',
        }),
      )
      console.info('[copilot] rate_limit.flushed', { entries: compact.entries.length })
    } catch (error) {
      console.error('[copilot] rate_limit.flush_failed', error)
    }
  }

  const scheduleWrite = (state: PersistedState): void => {
    pendingState = state
    if (pendingTimer !== null) {
      return
    }
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      const snapshot = pendingState
      pendingState = null
      if (snapshot !== null) {
        void writeNow(snapshot)
      }
    }, WRITE_DEBOUNCE_MS)
  }

  const flush = async (): Promise<void> => {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    if (pendingState !== null) {
      const snapshot = pendingState
      pendingState = null
      await writeNow(snapshot)
    }
  }

  const load = async (): Promise<PersistedState | null> => {
    try {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      const body = await response.Body?.transformToString()
      if (body === undefined || body === '') {
        return null
      }
      const raw = ((): unknown => {
        try {
          return JSON.parse(body)
        } catch {
          return null
        }
      })()
      if (raw === null) {
        return null
      }
      const parsed = PersistedStateSchema.safeParse(raw)
      if (!parsed.success) {
        console.warn('[copilot] rate_limit.load_invalid_shape')
        return null
      }
      return parsed.data
    } catch (error) {
      // NoSuchKey is the common case on first boot.
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return null
      }
      console.warn('[copilot] rate_limit.load_failed', error)
      return null
    }
  }

  return { enabled: true, load, scheduleWrite, flush }
}

export const persistence = createPersistence()
