import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export type PersistedEntry = { ipHash: string; hits: number }

export type PersistedState = {
  version: 1
  updatedAt: number
  entries: PersistedEntry[]
}

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
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: JSON.stringify(state),
          ContentType: 'application/json',
          ACL: 'private',
        }),
      )
      console.info('[copilot] rate-limit state flushed to s3', { entries: state.entries.length })
    } catch (error) {
      console.error('[copilot] rate-limit state flush failed', error)
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
      const parsed = JSON.parse(body) as unknown
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'version' in parsed &&
        (parsed as { version: unknown }).version === 1 &&
        Array.isArray((parsed as PersistedState).entries)
      ) {
        return parsed as PersistedState
      }
      return null
    } catch (error) {
      // NoSuchKey is the common case on first boot — do not log as error.
      if ((error as { name?: string }).name === 'NoSuchKey') {
        return null
      }
      console.warn('[copilot] rate-limit state load failed', error)
      return null
    }
  }

  return { enabled: true, load, scheduleWrite, flush }
}

export const persistence = createPersistence()
