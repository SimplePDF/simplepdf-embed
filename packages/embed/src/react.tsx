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
  resetKey: string
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

  // Serialize the editor-config inputs so the effect only remounts the iframe when
  // the actual configuration changes (not on every render / callback identity).
  const documentKey = React.useMemo(() => JSON.stringify(embedDocument ?? null), [embedDocument])
  const contextKey = React.useMemo(() => JSON.stringify(context ?? null), [context])

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
