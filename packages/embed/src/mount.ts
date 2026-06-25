import { createEmbed } from './bridge'
import { type BridgeLogger, makeSafeLogger, NOOP_LOGGER } from './logger'
import type { Embed } from './types'
import type { Locale } from './generated/contract'

// Construction-time configuration error. mountEmbed validates its config
// synchronously and THROWS this on programmer error (bad target/tenant/document
// URL), surfaced at integration time. Runtime/op failures are BridgeResult and
// never thrown.
export class EmbedConfigError extends Error {
  readonly code: 'invalid_target' | 'invalid_tenant' | 'invalid_document_url'
  constructor(code: 'invalid_target' | 'invalid_tenant' | 'invalid_document_url', message: string) {
    super(message)
    this.name = 'EmbedConfigError'
    this.code = code
  }
}

// DNS-label tenant validator (lowercase letters, digits, internal hyphens; no
// leading/trailing hyphen). The shared mountEmbed accepts reserved portal values
// (e.g. the 'embed' default, the Chrome integration); reserved-portal rejection
// is a WEM-customer-boundary concern, not enforced here.
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

const DEFAULT_TENANT = 'embed'
const DEFAULT_BASE_DOMAIN = 'simplepdf.com'
const DOCUMENT_SIZE_CAP_BYTES = 50 * 1024 * 1024

export const buildEditorDomain = ({ tenant, baseDomain }: { tenant: string; baseDomain: string }): string => {
  const isLocalDev = baseDomain.includes('.nil') || baseDomain.includes('localhost')
  const protocol = isLocalDev ? 'http' : 'https'
  return `${protocol}://${tenant}.${baseDomain}`
}

export const encodeContext = (context: Record<string, unknown> | undefined): string | null => {
  if (context === undefined) {
    return null
  }
  // btoa throws on non-Latin1 chars (accents/emoji/CJK) and JSON.stringify throws
  // on a circular object. Context is best-effort metadata, so drop it on failure
  // rather than crash mountEmbed — matching the shipped web/react encoders (and
  // the editor decodes this exact `btoa(JSON.stringify(...))` shape).
  try {
    return encodeURIComponent(btoa(JSON.stringify(context)))
  } catch {
    return null
  }
}

const extractDocumentName = (url: string): string => {
  const [name] = url.substring(url.lastIndexOf('/') + 1).split('?')
  return name ?? ''
}

export type EmbedDocument =
  | { url: string; name?: string; page?: number }
  | { dataUrl: string; name?: string; page?: number }

type MountDocument = EmbedDocument

export type MountEmbedArgs = {
  target: string | HTMLElement
  tenant?: string
  baseDomain?: string
  document?: MountDocument
  locale?: Locale
  context?: Record<string, unknown>
  iframeAttrs?: {
    title?: string
    allow?: string
    sandbox?: string
    className?: string
    style?: Partial<CSSStyleDeclaration>
  }
  logger?: BridgeLogger
}

const resolveTarget = (target: string | HTMLElement): HTMLElement => {
  if (typeof target !== 'string') {
    return target
  }
  const element = document.querySelector(target)
  if (element === null || !(element instanceof HTMLElement)) {
    throw new EmbedConfigError('invalid_target', `mountEmbed target '${target}' did not match an element`)
  }
  return element
}

const assertValidTenant = (tenant: string): void => {
  if (!DNS_LABEL.test(tenant)) {
    throw new EmbedConfigError(
      'invalid_tenant',
      `tenant '${tenant}' is not a valid DNS label (lowercase letters, digits, internal hyphens)`,
    )
  }
}

const assertValidDocumentUrl = (document: MountDocument | undefined): void => {
  if (document === undefined || !('url' in document)) {
    return
  }
  const parsed = ((): URL | null => {
    try {
      return new URL(document.url)
    } catch {
      return null
    }
  })()
  if (parsed === null || parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') {
    throw new EmbedConfigError(
      'invalid_document_url',
      `document.url must be an https URL without credentials (received '${document.url}')`,
    )
  }
}

const buildEditorURL = ({
  editorOrigin,
  locale,
  encodedContext,
  hasDocumentUrl,
  openFallbackUrl,
}: {
  editorOrigin: string
  locale: Locale | undefined
  encodedContext: string | null
  hasDocumentUrl: boolean
  openFallbackUrl: string | null
}): string => {
  const url = new URL(`/${locale ?? 'en'}/editor`, editorOrigin)
  if (encodedContext !== null) {
    url.searchParams.set('context', encodedContext)
  }
  if (hasDocumentUrl) {
    url.searchParams.set('loadingPlaceholder', 'true')
  }
  if (openFallbackUrl !== null) {
    url.searchParams.set('open', openFallbackUrl)
  }
  return url.href
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read document'))
    reader.readAsDataURL(blob)
  })

// Read the body stream with a running byte cap so an over-sized (or
// Content-Length-less) response is aborted mid-stream instead of buffered whole.
const readStreamCapped = async (
  body: ReadableStream<Uint8Array>,
  capBytes: number,
): Promise<BlobPart[] | null> => {
  const reader = body.getReader()
  const chunks: BlobPart[] = []
  // Streaming accumulation: the running counter must mutate as chunks arrive.
  let receivedBytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      return chunks
    }
    receivedBytes += value.byteLength
    if (receivedBytes > capBytes) {
      await reader.cancel()
      return null
    }
    // Copy into a fresh ArrayBuffer-backed view so it is a valid BlobPart
    // (the reader yields ArrayBufferLike-backed chunks).
    chunks.push(new Uint8Array(value))
  }
}

const fetchDocumentAsDataUrl = async (url: string, signal: AbortSignal): Promise<string | null> => {
  try {
    const response = await fetch(url, { method: 'GET', credentials: 'same-origin', signal })
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      return null
    }
    const contentLength = response.headers.get('content-length')
    if (contentLength !== null && Number(contentLength) > DOCUMENT_SIZE_CAP_BYTES) {
      await response.body?.cancel().catch(() => {})
      return null
    }
    const body = response.body
    if (body === null) {
      // No readable stream (e.g. an opaque response): we can't enforce the cap
      // without buffering the whole body, so decline and let the editor's ?open
      // loader fetch it instead.
      return null
    }
    // readStreamCapped cancels the reader (stopping the download) if the cap is hit.
    const chunks = await readStreamCapped(body, DOCUMENT_SIZE_CAP_BYTES)
    if (chunks === null) {
      return null
    }
    const contentType = response.headers.get('content-type') ?? 'application/pdf'
    return await blobToDataUrl(new Blob(chunks, { type: contentType }))
  } catch {
    return null
  }
}

// Library-owned mount path: builds the iframe + URL, mounts it under `target`,
// drives the standard document load (host-fetch -> LOAD_DOCUMENT, ?open fallback),
// and returns the Embed handle. dispose() additionally removes the iframe.
export const mountEmbed = ({
  target,
  tenant = DEFAULT_TENANT,
  baseDomain = DEFAULT_BASE_DOMAIN,
  document: mountDocument,
  locale,
  context,
  iframeAttrs,
  logger = NOOP_LOGGER,
}: MountEmbedArgs): Embed => {
  assertValidTenant(tenant)
  assertValidDocumentUrl(mountDocument)
  const container = resolveTarget(target)
  const editorOrigin = buildEditorDomain({ tenant, baseDomain })
  const hasDocumentUrl = mountDocument !== undefined && 'url' in mountDocument

  const iframe = document.createElement('iframe')
  iframe.title = iframeAttrs?.title ?? 'SimplePDF'
  iframe.setAttribute('referrerPolicy', 'no-referrer-when-downgrade')
  if (iframeAttrs?.allow !== undefined) {
    iframe.setAttribute('allow', iframeAttrs.allow)
  }
  if (iframeAttrs?.sandbox !== undefined) {
    iframe.setAttribute('sandbox', iframeAttrs.sandbox)
  }
  if (iframeAttrs?.className !== undefined) {
    iframe.className = iframeAttrs.className
  }
  iframe.style.border = '0'
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  if (iframeAttrs?.style !== undefined) {
    Object.assign(iframe.style, iframeAttrs.style)
  }
  iframe.src = buildEditorURL({
    editorOrigin,
    locale,
    encodedContext: encodeContext(context),
    hasDocumentUrl,
    openFallbackUrl: null,
  })
  container.appendChild(iframe)

  // Tracks teardown so the async document load below doesn't post / re-navigate
  // after the consumer has disposed the embed; the controller aborts an in-flight
  // host-fetch so a disposed mount stops downloading. The controller's signal also
  // doubles as the disposal indicator the async load checks before it posts.
  const documentFetchController = new AbortController()
  // mountEmbed's own logging must be just as throw-isolated as the bridge's.
  const safeLogger = makeSafeLogger(logger)
  const embed = createEmbed({
    getIframe: () => iframe,
    editorOrigin,
    logger: safeLogger,
    onDispose: () => {
      documentFetchController.abort()
      iframe.remove()
    },
  })

  // Post LOAD_DOCUMENT once the editor is ready (it queues nothing before then).
  // For url documents we host-fetch eagerly and fall back to ?open on failure.
  if (mountDocument !== undefined) {
    const dataUrlPromise =
      'dataUrl' in mountDocument
        ? Promise.resolve(mountDocument.dataUrl)
        : fetchDocumentAsDataUrl(mountDocument.url, documentFetchController.signal)
    const documentName =
      mountDocument.name ?? ('url' in mountDocument ? extractDocumentName(mountDocument.url) : undefined)

    const loadWhenReady = async (): Promise<void> => {
      const dataUrl = await dataUrlPromise
      if (documentFetchController.signal.aborted) {
        return
      }
      if (dataUrl === null) {
        // Host-fetch failed (CORS/size/network): re-navigate the iframe through
        // the editor's ?open loader, which fetches the URL inside the editor.
        if ('url' in mountDocument) {
          iframe.src = buildEditorURL({
            editorOrigin,
            locale,
            encodedContext: encodeContext(context),
            hasDocumentUrl: false,
            openFallbackUrl: mountDocument.url,
          })
        }
        return
      }
      const result = await embed.loadDocument({ data_url: dataUrl, name: documentName, page: mountDocument.page })
      if (!result.success) {
        // Surface the load failure (it would otherwise be silently dropped).
        safeLogger.error('mount.load_document_failed', { code: result.error.code, message: result.error.message })
      }
    }

    if (embed.getState().kind === 'booting') {
      const unsubscribe = embed.on('state_change', (next) => {
        if (next.kind !== 'booting') {
          unsubscribe()
          void loadWhenReady()
        }
      })
    } else {
      void loadWhenReady()
    }
  }

  return embed
}
