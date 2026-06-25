// React adapter. `react`/`react-dom` are peer dependencies.
//   - useIframeBridge: the host renders its own <iframe>; the hook drives the bridge.
//   - EmbedPDF: the library renders the iframe (via createEmbed) and forwards the Embed.
//   - useEmbed: a typed ref to attach to <EmbedPDF ref={...} /> for imperative calls.
// useEffect is used deliberately here: mounting/driving the editor iframe is exactly
// the "synchronize with an external system" case effects exist for.

import * as React from 'react'
import { attachEmbed } from './bridge'
import { createEmbed, type EmbedDocument } from './mount'
import type { BridgeLogger, LogPayload } from './logger'
import type { Locale } from './generated/contract'
import type { BridgeResult, BridgeState, Embed, IframeBridge, PageFocusedPayload, SubmissionSentPayload } from './types'

const BOOTING_STATE: BridgeState = { kind: 'booting' }

type UseIframeBridgeArgs = {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  editorOrigin: string
  // When this key changes, the bridge is disposed and re-created. Use it to force
  // a full reset (state machine + pending requests) when the iframe remounts.
  resetKey?: string
  logger?: BridgeLogger
}

export const useIframeBridge = ({
  iframeRef,
  editorOrigin,
  resetKey,
  logger,
}: UseIframeBridgeArgs): { bridge: Embed | null; bridgeState: BridgeState } => {
  const bridgeRef = React.useRef<Embed | null>(null)
  const listenersRef = React.useRef<Set<() => void>>(new Set())
  const stateRef = React.useRef<BridgeState>(BOOTING_STATE)

  React.useEffect(() => {
    const notifyReact = (): void => {
      for (const listener of listenersRef.current) {
        listener()
      }
    }
    const embed = attachEmbed({ getIframe: () => iframeRef.current, editorOrigin, logger })
    const unsubscribe = embed.on('state_change', (next) => {
      stateRef.current = next
      notifyReact()
    })
    bridgeRef.current = embed
    stateRef.current = embed.getState()
    notifyReact()
    return () => {
      unsubscribe()
      embed.dispose()
      bridgeRef.current = null
      stateRef.current = BOOTING_STATE
      notifyReact()
    }
    // resetKey is a remount sentinel: changing it must tear down + recreate.
  }, [iframeRef, editorOrigin, resetKey, logger])

  const subscribe = React.useCallback((listener: () => void): (() => void) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])
  const getStateSnapshot = React.useCallback((): BridgeState => stateRef.current, [])
  const getServerSnapshot = React.useCallback((): BridgeState => BOOTING_STATE, [])
  const bridgeState = React.useSyncExternalStore(subscribe, getStateSnapshot, getServerSnapshot)

  return { bridge: bridgeRef.current, bridgeState }
}

type EmbedPDFProps = {
  tenant: string
  baseDomain?: string
  document?: EmbedDocument
  locale?: Locale
  context?: Record<string, unknown>
  className?: string
  style?: React.CSSProperties
  logger?: BridgeLogger
  onSubmissionSent?: (payload: SubmissionSentPayload) => void
  onPageFocused?: (payload: PageFocusedPayload) => void
  onStateChange?: (state: BridgeState) => void
}

const assignRef = (ref: React.ForwardedRef<Embed | null>, value: Embed | null): void => {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref !== null) {
    ref.current = value
  }
}

export const EmbedPDF = React.forwardRef<Embed | null, EmbedPDFProps>((props, ref) => {
  const { tenant, baseDomain, document: embedDocument, locale, context, className, style, logger } = props
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Keep callbacks in a ref so changing them does not remount the iframe.
  const callbacksRef = React.useRef({
    onSubmissionSent: props.onSubmissionSent,
    onPageFocused: props.onPageFocused,
    onStateChange: props.onStateChange,
    logger,
  })
  callbacksRef.current = {
    onSubmissionSent: props.onSubmissionSent,
    onPageFocused: props.onPageFocused,
    onStateChange: props.onStateChange,
    logger,
  }

  // A stable logger that always delegates to the latest `logger` prop, so a
  // changed logger reaches the already-mounted bridge without a remount.
  const stableLogger = React.useMemo<BridgeLogger>(() => {
    const delegate =
      (level: 'debug' | 'info' | 'warn' | 'error') =>
      (event: string, payload: LogPayload): void => {
        callbacksRef.current.logger?.[level](event, payload)
      }
    return { debug: delegate('debug'), info: delegate('info'), warn: delegate('warn'), error: delegate('error') }
  }, [])

  // Remount the iframe only when the editor config actually changes. Key on the
  // document's identifying PRIMITIVES (the url, or the data-URL string itself —
  // not a sample, so two distinct same-size data URLs never collide, and no
  // re-serialization since these are read, not stringified, each render). A Blob
  // has no stable string identity, so it is keyed on its descriptors (distinct
  // blobs sharing size+type+name will not remount, an acceptable edge).
  const documentSource = ((): string | null => {
    if (embedDocument === undefined) {
      return null
    }
    if ('url' in embedDocument) {
      return embedDocument.url
    }
    if ('dataUrl' in embedDocument) {
      return embedDocument.dataUrl
    }
    const fileName = embedDocument.file instanceof File ? embedDocument.file.name : ''
    return `file:${embedDocument.file.size}:${embedDocument.file.type}:${fileName}`
  })()
  const documentName = embedDocument?.name ?? null
  const documentPage = embedDocument?.page ?? null
  const contextKey = React.useMemo((): string => {
    if (context === undefined) {
      return 'null'
    }
    try {
      return JSON.stringify(context)
    } catch {
      // Circular / non-serializable context (a programmer error; encodeContext
      // drops it too). Key on the top-level shape so render never throws.
      return `unserializable:${Object.keys(context).sort().join(',')}`
    }
  }, [context])

  React.useEffect(() => {
    const container = containerRef.current
    if (container === null) {
      return
    }
    const embed = createEmbed({
      target: container,
      tenant,
      baseDomain,
      document: embedDocument,
      locale,
      context,
      logger: stableLogger,
    })
    assignRef(ref, embed)
    const unsubscribers = [
      embed.on('submission_sent', (payload) => callbacksRef.current.onSubmissionSent?.(payload)),
      embed.on('page_focused', (payload) => callbacksRef.current.onPageFocused?.(payload)),
      embed.on('state_change', (state) => callbacksRef.current.onStateChange?.(state)),
    ]
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
      embed.dispose()
      assignRef(ref, null)
    }
    // embedDocument/context are read here but fully determined by the document
    // primitives + contextKey deps below; ref + stableLogger are stable.
  }, [tenant, baseDomain, locale, documentSource, documentName, documentPage, contextKey, ref, stableLogger])

  return <div ref={containerRef} className={className} style={style} />
})
EmbedPDF.displayName = 'EmbedPDF'

// The async-action subset of the handle (everything except the sync getState).
// Derived from IframeBridge, so a new editor operation fails the build here until
// it is added to `actions` below.
export type EmbedActions = Omit<IframeBridge, 'getState'>

// Calls made before <EmbedPDF> has mounted resolve to a real Result (not undefined),
// keeping the "every method returns a BridgeResult" contract uniform at every call
// site. Reuses the bridge's own not-mounted code rather than minting a new one.
const notMounted = (): Promise<BridgeResult<never>> =>
  Promise.resolve({
    success: false,
    error: {
      code: 'unexpected:iframe_not_mounted',
      message: 'the editor is not mounted yet: attach embedRef to <EmbedPDF ref={embedRef} /> and call after it renders',
    },
  })

// Returns a ref to attach to <EmbedPDF ref={embedRef} /> plus a stable `actions`
// object: every method is the same typed `Embed` method, but a call before mount
// returns the not-mounted Result instead of dereferencing a null ref.
export const useEmbed = (): { embedRef: React.RefObject<Embed | null>; actions: EmbedActions } => {
  const embedRef = React.useRef<Embed | null>(null)
  const actions = React.useMemo<EmbedActions>(
    () => ({
      createField: (input) => embedRef.current?.createField(input) ?? notMounted(),
      deleteFields: (input) => embedRef.current?.deleteFields(input) ?? notMounted(),
      deletePages: (input) => embedRef.current?.deletePages(input) ?? notMounted(),
      detectFields: () => embedRef.current?.detectFields() ?? notMounted(),
      download: () => embedRef.current?.download() ?? notMounted(),
      focusField: (input) => embedRef.current?.focusField(input) ?? notMounted(),
      getDocumentContent: (input) => embedRef.current?.getDocumentContent(input) ?? notMounted(),
      getFields: () => embedRef.current?.getFields() ?? notMounted(),
      goTo: (input) => embedRef.current?.goTo(input) ?? notMounted(),
      loadDocument: (input) => embedRef.current?.loadDocument(input) ?? notMounted(),
      movePage: (input) => embedRef.current?.movePage(input) ?? notMounted(),
      rotatePage: (input) => embedRef.current?.rotatePage(input) ?? notMounted(),
      selectTool: (input) => embedRef.current?.selectTool(input) ?? notMounted(),
      setFieldValue: (input) => embedRef.current?.setFieldValue(input) ?? notMounted(),
      submit: (input) => embedRef.current?.submit(input) ?? notMounted(),
    }),
    [],
  )
  return { embedRef, actions }
}
