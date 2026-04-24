import { type RefObject, useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { type BridgeLogger, type BridgeState, createBridge, type IframeBridge } from '../../lib/embed-bridge'

type UseIframeBridgeArgs = {
  iframeRef: RefObject<HTMLIFrameElement | null>
  editorOrigin: string
  // When this key changes, the bridge is disposed and re-created. Use it to
  // force a full reset of all iframe state (state machine + pending
  // requests) whenever the iframe is about to remount — e.g. on a form or
  // locale switch.
  resetKey: string
  logger?: BridgeLogger
}

const BOOTING_STATE: BridgeState = { kind: 'booting' }

export const useIframeBridge = ({
  iframeRef,
  editorOrigin,
  resetKey,
  logger,
}: UseIframeBridgeArgs): {
  bridge: IframeBridge | null
  bridgeState: BridgeState
} => {
  const bridgeRef = useRef<IframeBridge | null>(null)
  const listenersRef = useRef<Set<() => void>>(new Set())
  const stateRef = useRef<BridgeState>(BOOTING_STATE)

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is a remount sentinel; the effect body doesn't read it, but changing it must tear down the bridge + start fresh (state-machine + probe + pending-request reset) on form or locale switches, so it has to be a dep.
  useEffect(() => {
    const notifyReact = (): void => {
      for (const listener of listenersRef.current) {
        listener()
      }
    }
    const instance = createBridge({
      getIframe: () => iframeRef.current,
      editorOrigin,
      logger,
      onStateChange: (next) => {
        stateRef.current = next
        notifyReact()
      },
    })
    bridgeRef.current = instance.bridge
    stateRef.current = instance.bridge.getState()
    notifyReact()
    return () => {
      instance.dispose()
      bridgeRef.current = null
      stateRef.current = BOOTING_STATE
      notifyReact()
    }
  }, [iframeRef, editorOrigin, resetKey, logger])

  const subscribe = useCallback((listener: () => void): (() => void) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const getStateSnapshot = useCallback((): BridgeState => stateRef.current, [])
  const getServerSnapshot = useCallback((): BridgeState => BOOTING_STATE, [])

  const bridgeState = useSyncExternalStore(subscribe, getStateSnapshot, getServerSnapshot)

  return { bridge: bridgeRef.current, bridgeState }
}
