// React adapter. `react`/`react-dom` are peer dependencies.
//   - useIframeBridge: the host renders its own <iframe>; the hook drives the bridge.
//   - EmbedPDF: the library renders the iframe (via mountEmbed) and forwards the Embed.
//   - useEmbed: a typed ref to attach to <EmbedPDF ref={...} /> for imperative calls.
// useEffect is used deliberately here: mounting/driving the editor iframe is exactly
// the "synchronize with an external system" case effects exist for.

import * as React from 'react'
import { createBridge } from './bridge'
import { type EmbedDocument, mountEmbed } from './mount'
import type { BridgeLogger } from './logger'
import type { Locale } from './generated/contract'
import type { BridgeState, Embed, PageFocusedPayload, SubmissionSentPayload } from './types'

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
    const embed = createBridge({ getIframe: () => iframeRef.current, editorOrigin, logger })
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
  tenant?: string
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

  // Derive cheap keys so the effect only remounts the iframe when the editor
  // config actually changes (not on every render / inline-prop identity). The
  // document key keys a data URL on its length (never re-serializing a multi-MB
  // string each render); context is bounded (<= 8 KiB) so stringifying is cheap.
  const documentKey = React.useMemo((): string => {
    if (embedDocument === undefined) {
      return ''
    }
    const suffix = `:${embedDocument.name ?? ''}:${embedDocument.page ?? ''}`
    if ('url' in embedDocument) {
      return `url:${embedDocument.url}${suffix}`
    }
    // A data URL is identified by length + a head/tail sample (cheap; avoids
    // re-serializing a multi-MB string each render, while length-alone collisions
    // between two distinct same-size documents would otherwise skip a remount).
    const { dataUrl } = embedDocument
    return `data:${dataUrl.length}:${dataUrl.slice(0, 64)}:${dataUrl.slice(-64)}${suffix}`
  }, [embedDocument])
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
    const embed = mountEmbed({
      target: container,
      tenant,
      baseDomain,
      document: embedDocument,
      locale,
      context,
      logger: callbacksRef.current.logger,
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
    // ref is stable for the component's lifetime; config keys drive remounts.
  }, [tenant, baseDomain, locale, documentKey, contextKey, ref])

  return <div ref={containerRef} className={className} style={style} />
})
EmbedPDF.displayName = 'EmbedPDF'

// A typed ref to attach to <EmbedPDF ref={embed} /> for imperative method calls
// (embed.current?.getFields(), etc.).
export const useEmbed = (): React.RefObject<Embed | null> => React.useRef<Embed | null>(null)
