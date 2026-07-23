import { attachEmbed } from './bridge'
import { type BridgeLogger, makeSafeLogger, NOOP_LOGGER } from './logger'
import type { BridgeState, Embed } from './types'
import type { Locale } from './generated/contract'

// Construction-time configuration error. createEmbed validates its config
// synchronously and THROWS this on programmer error (bad target/companyIdentifier/document
// URL), surfaced at integration time. Runtime/op failures are BridgeResult and
// never thrown.
export class EmbedConfigError extends Error {
  readonly code: 'invalid_config' | 'invalid_document' | 'invalid_target' | 'invalid_company_identifier'
  constructor(code: 'invalid_config' | 'invalid_document' | 'invalid_target' | 'invalid_company_identifier', message: string) {
    super(message)
    this.name = 'EmbedConfigError'
    this.code = code
  }
}

// DNS-label companyIdentifier validator (lowercase letters, digits, internal
// hyphens; no leading/trailing hyphen). The shared createEmbed accepts reserved
// portal values (e.g. the 'embed' default, the Chrome integration); reserved-portal
// rejection is a WEM-customer-boundary concern, not enforced here.
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

const DEFAULT_BASE_DOMAIN = 'simplepdf.com'
const DOCUMENT_SIZE_CAP_BYTES = 50 * 1024 * 1024

// Local dev domains (a *.nil checkout host or localhost) are served over http;
// every real domain is https.
const isLocalDevDomain = (baseDomain: string): boolean =>
  baseDomain.includes('.nil') || baseDomain.includes('localhost')

export const buildEditorDomain = ({
  companyIdentifier,
  baseDomain,
}: {
  companyIdentifier: string
  baseDomain: string
}): string => {
  const protocol = isLocalDevDomain(baseDomain) ? 'http' : 'https'
  return `${protocol}://${companyIdentifier}.${baseDomain}`
}

export const encodeContext = (context: Record<string, unknown> | undefined): string | null => {
  if (context === undefined) {
    return null
  }
  // btoa throws on non-Latin1 chars (accents/emoji/CJK) and JSON.stringify throws
  // on a circular object. Context is best-effort metadata, so drop it on failure
  // rather than crash createEmbed — matching the shipped web/react encoders (and
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
  | { file: File | Blob; name?: string; page?: number }

export type CreateEmbedArgs = {
  // Where the editor goes. A container (selector or element) we create the iframe
  // inside, OR an existing <iframe> you rendered (already pointed at the editor)
  // that we bridge to instead.
  target: string | HTMLElement
  // Your companyIdentifier: the `<companyIdentifier>.simplepdf.com` subdomain
  // (`'embed'` is the no-account public editor).
  companyIdentifier: string
  baseDomain?: string
  document?: EmbedDocument
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

const resolveTarget = (target: unknown): HTMLElement => {
  if (target instanceof HTMLElement) {
    return target
  }
  if (typeof target !== 'string') {
    throw new EmbedConfigError(
      'invalid_target',
      `target must be a CSS selector or an HTMLElement (received ${describeValue(target)}).`,
    )
  }
  const element = document.querySelector(target)
  if (element === null || !(element instanceof HTMLElement)) {
    throw new EmbedConfigError('invalid_target', `createEmbed target '${target}' did not match an element`)
  }
  return element
}

const assertValidCompanyIdentifier = (companyIdentifier: unknown): void => {
  // Runtime guard, not just a type: an untyped JS caller passing `undefined`
  // would otherwise coerce to the string 'undefined', which passes DNS_LABEL.
  if (typeof companyIdentifier !== 'string' || companyIdentifier === '') {
    throw new EmbedConfigError(
      'invalid_company_identifier',
      'companyIdentifier is required: the <companyIdentifier>.simplepdf.com subdomain from your SimplePDF account.',
    )
  }
  if (!DNS_LABEL.test(companyIdentifier)) {
    throw new EmbedConfigError(
      'invalid_company_identifier',
      `companyIdentifier '${companyIdentifier}' is not a valid DNS label (lowercase letters, digits, internal hyphens)`,
    )
  }
}

// Describe a runtime value for an actionable error. The document source is the
// most common integration mistake, so every message names the value you passed
// and points to the arm you almost certainly meant.
const describeValue = (value: unknown): string => {
  if (value instanceof File) {
    return 'a File'
  }
  if (value instanceof Blob) {
    return 'a Blob'
  }
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return 'an array'
  }
  return `a ${typeof value}`
}

const assertValidUrlArm = (url: unknown): void => {
  if (typeof url !== 'string') {
    const hint = url instanceof Blob ? ' To embed a Blob or File, use document: { file } instead.' : ''
    throw new EmbedConfigError('invalid_document', `document.url must be a string (received ${describeValue(url)}).${hint}`)
  }
  const parsed = ((): URL | null => {
    try {
      return new URL(url)
    } catch {
      return null
    }
  })()
  if (parsed === null) {
    throw new EmbedConfigError('invalid_document', `document.url must be a valid absolute URL (received '${url}').`)
  }
  if (parsed.protocol === 'data:') {
    throw new EmbedConfigError('invalid_document', 'document.url is a data URL. Use document: { dataUrl } instead.')
  }
  if (parsed.protocol === 'blob:') {
    throw new EmbedConfigError('invalid_document', 'document.url is a blob: URL. Pass the Blob itself via document: { file } instead.')
  }
  // Beyond http(s) we do NOT gatekeep: credentials (`user:pass@`) are allowed
  // (the host-fetch can't use them per the Fetch spec, so the URL just routes to
  // the editor's ?open loader), and on an https page the browser's mixed-content
  // policy is the real gate on http, not us.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new EmbedConfigError('invalid_document', `document.url must be an http(s) URL (received '${url}').`)
  }
}

const assertValidDataUrlArm = (dataUrl: unknown): void => {
  if (typeof dataUrl !== 'string') {
    const hint = dataUrl instanceof Blob ? ' To embed a Blob or File, use document: { file } instead.' : ''
    throw new EmbedConfigError(
      'invalid_document',
      `document.dataUrl must be a string (received ${describeValue(dataUrl)}).${hint}`,
    )
  }
  if (/^https?:\/\//i.test(dataUrl)) {
    throw new EmbedConfigError('invalid_document', 'document.dataUrl looks like an http(s) URL. Use document: { url } instead.')
  }
  if (!dataUrl.startsWith('data:')) {
    throw new EmbedConfigError('invalid_document', "document.dataUrl must be a data URL (it should start with 'data:').")
  }
}

const assertValidFileArm = (file: unknown): void => {
  if (!(file instanceof Blob)) {
    const hint = typeof file === 'string' ? ' For a URL or a data URL, use document: { url } or document: { dataUrl }.' : ''
    throw new EmbedConfigError('invalid_document', `document.file must be a Blob or File (received ${describeValue(file)}).${hint}`)
  }
}

const assertValidDocument = (document: unknown): void => {
  if (document === undefined) {
    return
  }
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new EmbedConfigError(
      'invalid_document',
      `document must be an object with one of url / dataUrl / file (received ${describeValue(document)}).`,
    )
  }
  const present = [
    'url' in document ? 'url' : null,
    'dataUrl' in document ? 'dataUrl' : null,
    'file' in document ? 'file' : null,
  ].filter((key): key is string => key !== null)
  if (present.length !== 1) {
    const got = present.length === 0 ? 'none' : present.join(' + ')
    throw new EmbedConfigError(
      'invalid_document',
      `document needs exactly one source: { url: string }, { dataUrl: string }, or { file: Blob } (got ${got}).`,
    )
  }
  if ('url' in document) {
    assertValidUrlArm(document.url)
    return
  }
  if ('dataUrl' in document) {
    assertValidDataUrlArm(document.dataUrl)
    return
  }
  if ('file' in document) {
    assertValidFileArm(document.file)
  }
}

// A SimplePDF "documents" URL is a stored document / share route
// (e.g. https://<companyIdentifier>.simplepdf.com/documents/<id>?prefill=<id>),
// not a fetchable PDF. The path is /documents/<id>, optionally locale-prefixed.
const DOCUMENTS_PATH_PATTERN = /^\/(?:[a-z]{2}\/)?documents\/[^/]+\/?$/

// When document.url is a SimplePDF documents URL on the configured base-domain
// family, the iframe navigates straight to it (the editor loads + prefills the
// stored document itself) instead of host-fetching it as a PDF. The bridge then
// targets that URL's OWN origin — intentionally allowing a different tenant
// subdomain than the configured companyIdentifier (e.g. open demo.simplepdf.com's
// shared document from an app configured as `acme`), while still constraining it to
// a single tenant label on the base-domain family over https. Returns the parsed
// URL + origin, or null when it is not a documents URL.
const resolveDocumentsUrl = (
  embedDocument: EmbedDocument | undefined,
  baseDomain: string,
): { url: URL; origin: string } | null => {
  if (embedDocument === undefined || !('url' in embedDocument)) {
    return null
  }
  const parsed = ((): URL | null => {
    try {
      return new URL(embedDocument.url)
    } catch {
      return null
    }
  })()
  if (parsed === null) {
    return null
  }
  // https only, except in local dev (http on a real domain would be a downgrade).
  const isLocalDev = isLocalDevDomain(baseDomain)
  if (parsed.protocol !== 'https:' && !(isLocalDev && parsed.protocol === 'http:')) {
    return null
  }
  // The host must be exactly ONE DNS label above baseDomain (the tenant): not the
  // apex, and not a nested subdomain, so a crafted deeper origin can't be reached.
  const isTenantOfBaseDomain = ((): boolean => {
    if (!parsed.host.endsWith(`.${baseDomain}`)) {
      return false
    }
    const label = parsed.host.slice(0, parsed.host.length - baseDomain.length - 1)
    return label.length > 0 && !label.includes('.')
  })()
  if (!isTenantOfBaseDomain || !DOCUMENTS_PATH_PATTERN.test(parsed.pathname)) {
    return null
  }
  return { url: parsed, origin: parsed.origin }
}

export const buildEditorURL = ({
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

// --- Document loading (shared by the create + attach paths) -----------------

const resolveDataUrl = (embedDocument: EmbedDocument, signal: AbortSignal): Promise<string | null> => {
  if ('dataUrl' in embedDocument) {
    return Promise.resolve(embedDocument.dataUrl)
  }
  if ('file' in embedDocument) {
    return blobToDataUrl(embedDocument.file).catch(() => null)
  }
  return fetchDocumentAsDataUrl(embedDocument.url, signal)
}

const documentNameOf = (embedDocument: EmbedDocument): string | undefined => {
  if (embedDocument.name !== undefined) {
    return embedDocument.name
  }
  if ('url' in embedDocument) {
    return extractDocumentName(embedDocument.url)
  }
  if ('file' in embedDocument && embedDocument.file instanceof File) {
    return embedDocument.file.name
  }
  return undefined
}

// "Run once the editor leaves booting" without a public event: the bridge calls the
// gate's onStateChange on every transition — including readiness reached via the
// liveness probe, which emits no editor event — resolving a one-shot ready promise.
const makeReadinessGate = (): {
  onStateChange: (state: BridgeState) => void
  whenReady: (run: () => void) => void
} => {
  let markReady: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    markReady = resolve
  })
  return {
    onStateChange: (state) => {
      if (state.kind !== 'booting') {
        markReady()
      }
    },
    whenReady: (run) => {
      void ready.then(run)
    },
  }
}

// Loads `document` into the editor once it is ready. `onHostFetchFail` is the
// create path's ?open fallback (re-navigate the iframe we own); the attach path
// passes none, because it must never touch an iframe the consumer rendered.
const loadDocumentWhenReady = (params: {
  embed: Embed
  embedDocument: EmbedDocument
  signal: AbortSignal
  safeLogger: BridgeLogger
  onHostFetchFail: (() => void) | undefined
  whenReady: (run: () => void) => void
}): void => {
  const { embed, embedDocument, signal, safeLogger, onHostFetchFail, whenReady } = params
  const dataUrlPromise = resolveDataUrl(embedDocument, signal)
  const documentName = documentNameOf(embedDocument)
  const run = async (): Promise<void> => {
    const dataUrl = await dataUrlPromise
    if (signal.aborted) {
      return
    }
    if (dataUrl === null) {
      if (onHostFetchFail !== undefined) {
        onHostFetchFail()
        return
      }
      safeLogger.error('load_document_failed', {
        code: 'unexpected:unknown',
        message: 'could not resolve the document to a data URL; ?open fallback is unavailable on an attached iframe',
      })
      return
    }
    const result = await embed.actions.loadDocument({ dataUrl, name: documentName, page: embedDocument.page })
    if (!result.success) {
      safeLogger.error('load_document_failed', { code: result.error.code, message: result.error.message })
    }
  }
  whenReady(() => void run())
}

// --- Attach to an existing iframe -------------------------------------------

const attachToIframe = (
  iframe: HTMLIFrameElement,
  editorOrigin: string,
  { document: embedDocument, logger = NOOP_LOGGER }: CreateEmbedArgs,
  documentsUrl: { url: URL; origin: string } | null,
): Embed => {
  // A documents URL loads by NAVIGATING the iframe, which we only do for an iframe
  // we create. We must not touch a consumer-owned iframe's src, so reject it here
  // rather than silently no-op (the consumer should point their iframe at it, or
  // pass a container target instead).
  if (documentsUrl !== null) {
    throw new EmbedConfigError(
      'invalid_document',
      'a SimplePDF documents URL loads by navigating the iframe, which createEmbed only does when it creates one (a container target). For an existing <iframe>, point it at the documents URL yourself.',
    )
  }
  // The consumer set this iframe's src. If it points at a different origin than
  // the one we derived from companyIdentifier, the bridge would post into the void and
  // time out 60s later; catch the mismatch up front instead.
  // Read the raw attribute, not iframe.src: the property resolves an empty/relative
  // src against the page URL, which would false-positive on an iframe with no src.
  const srcAttr = iframe.getAttribute('src')
  const iframeOrigin = ((): string | null => {
    if (srcAttr === null || srcAttr.trim() === '') {
      return null
    }
    try {
      const url = new URL(srcAttr)
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
    } catch {
      return null
    }
  })()
  if (iframeOrigin !== null && iframeOrigin !== editorOrigin) {
    throw new EmbedConfigError(
      'invalid_target',
      `the iframe at this target points at ${iframeOrigin}, but the editor origin derived from companyIdentifier is ${editorOrigin}. Point the iframe at ${editorOrigin}, or fix the companyIdentifier.`,
    )
  }
  const documentFetchController = new AbortController()
  const safeLogger = makeSafeLogger(logger)
  // The consumer owns this iframe, so dispose() does NOT remove it; it only
  // aborts an in-flight document host-fetch.
  const gate = makeReadinessGate()
  const embed = attachEmbed({
    getIframe: () => iframe,
    editorOrigin,
    logger: safeLogger,
    onDispose: () => documentFetchController.abort(),
    onStateChange: gate.onStateChange,
  })
  if (embedDocument !== undefined) {
    loadDocumentWhenReady({
      embed,
      embedDocument,
      signal: documentFetchController.signal,
      safeLogger,
      onHostFetchFail: undefined,
      whenReady: gate.whenReady,
    })
  }
  return embed
}

// --- Create the iframe inside a container -----------------------------------

const mountIntoContainer = (
  container: HTMLElement,
  editorOrigin: string,
  { document: mountDocument, locale, context, iframeAttrs, logger = NOOP_LOGGER }: CreateEmbedArgs,
  documentsUrl: { url: URL; origin: string } | null,
): Embed => {
  const hasDocumentUrl = mountDocument !== undefined && 'url' in mountDocument
  const encodedContext = encodeContext(context)

  const iframe = document.createElement('iframe')
  iframe.title = iframeAttrs?.title ?? 'SimplePDF'
  iframe.setAttribute('referrerPolicy', 'no-referrer-when-downgrade')
  // The editor needs clipboard access for copy/paste, and web-share so the editor's
  // share-sheet download path works on iOS — navigator.share is permissions-policy
  // gated in cross-origin iframes and rejects without the delegation. Default both
  // on (overridable).
  iframe.setAttribute('allow', iframeAttrs?.allow ?? 'clipboard-read; clipboard-write; web-share')
  if (iframeAttrs?.sandbox !== undefined) {
    iframe.setAttribute('sandbox', iframeAttrs.sandbox)
    // Chromium silently no-ops the editor's Download click inside a sandboxed frame
    // missing this token — no error, no event, nothing happens. console (not the
    // logger, which defaults to noop) so the misconfiguration is visible to the
    // integrator during development.
    if (!iframeAttrs.sandbox.split(/\s+/).some((token) => token.toLowerCase() === 'allow-downloads')) {
      console.warn(
        '[SimplePDF] The iframe "sandbox" attribute is missing "allow-downloads": the editor\'s Download button will be silently blocked by the browser. Add "allow-downloads" to your sandbox tokens.',
      )
    }
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
  iframe.src =
    documentsUrl !== null
      ? ((): string => {
          // Navigate straight to the stored document; carry the context through
          // (the editor decodes ?context= on the documents route too) while
          // preserving the URL's own query, e.g. ?prefill=.
          const src = new URL(documentsUrl.url.href)
          if (encodedContext !== null) {
            src.searchParams.set('context', encodedContext)
          }
          return src.href
        })()
      : buildEditorURL({
          editorOrigin,
          locale,
          encodedContext,
          hasDocumentUrl,
          openFallbackUrl: null,
        })
  container.appendChild(iframe)

  // Tracks teardown so the async document load below doesn't post / re-navigate
  // after the consumer has disposed the embed; the controller aborts an in-flight
  // host-fetch so a disposed mount stops downloading. The controller's signal also
  // doubles as the disposal indicator the async load checks before it posts.
  const documentFetchController = new AbortController()
  // createEmbed's own logging must be just as throw-isolated as the bridge's.
  const safeLogger = makeSafeLogger(logger)
  const gate = makeReadinessGate()
  const embed = attachEmbed({
    getIframe: () => iframe,
    editorOrigin,
    logger: safeLogger,
    onStateChange: gate.onStateChange,
    onDispose: () => {
      documentFetchController.abort()
      iframe.remove()
    },
  })

  // A documents URL is loaded by the navigation above; only the PDF / data-URL /
  // file arms need the async host-fetch + LOAD_DOCUMENT (with the ?open fallback).
  if (mountDocument !== undefined && documentsUrl === null) {
    loadDocumentWhenReady({
      embed,
      embedDocument: mountDocument,
      signal: documentFetchController.signal,
      safeLogger,
      whenReady: gate.whenReady,
      // Host-fetch failed (CORS/size/network): re-navigate the iframe we own
      // through the editor's ?open loader, which fetches the URL inside the editor.
      onHostFetchFail: () => {
        if ('url' in mountDocument) {
          iframe.src = buildEditorURL({
            editorOrigin,
            locale,
            encodedContext,
            hasDocumentUrl: false,
            openFallbackUrl: mountDocument.url,
          })
        }
      },
    })
  }

  return embed
}

// The single way to embed the SimplePDF editor. Point `target` at a container and
// we create the iframe inside it; point it at an existing <iframe> you rendered
// (already showing the editor) and we bridge to it instead. Either way you get the
// same typed `Embed` handle. Throws `EmbedConfigError` synchronously on bad config.
export const createEmbed = (args: CreateEmbedArgs): Embed => {
  // Runtime guard for untyped JS callers passing a non-object (null / undefined /
  // a primitive) where TS would require the config object.
  if (typeof args !== 'object' || !args) {
    throw new EmbedConfigError(
      'invalid_config',
      `createEmbed expects a config object { target, companyIdentifier, ... } (received ${describeValue(args)}).`,
    )
  }
  assertValidCompanyIdentifier(args.companyIdentifier)
  if (args.baseDomain !== undefined && typeof args.baseDomain !== 'string') {
    throw new EmbedConfigError('invalid_config', `baseDomain must be a string (received ${describeValue(args.baseDomain)}).`)
  }
  assertValidDocument(args.document)
  const baseDomain = args.baseDomain ?? DEFAULT_BASE_DOMAIN
  // A SimplePDF documents URL carries its own origin (a possibly-different
  // companyIdentifier subdomain); the bridge then targets that origin instead of
  // the configured one.
  const documentsUrl = resolveDocumentsUrl(args.document, baseDomain)
  const editorOrigin = documentsUrl?.origin ?? buildEditorDomain({ companyIdentifier: args.companyIdentifier, baseDomain })
  const element = resolveTarget(args.target)
  if (element instanceof HTMLIFrameElement) {
    return attachToIframe(element, editorOrigin, args, documentsUrl)
  }
  return mountIntoContainer(element, editorOrigin, args, documentsUrl)
}
