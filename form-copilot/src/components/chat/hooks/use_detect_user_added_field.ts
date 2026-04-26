import { type MutableRefObject, useCallback, useEffect, useRef } from 'react'
import type { IframeBridge, SupportedFieldType } from '../../../lib/embed-bridge'

// WORKAROUND: the SimplePDF editor does not currently emit an outbound
// FIELD_ADDED event when the user drops a field via the toolbar. Until it
// does, the chat's "new field added by the user" hint has to detect the
// drop by polling GET_FIELDS. This hook encapsulates that polling logic
// so the chat_pane call site stays readable, and so the workaround can be
// deleted in one place the day the editor ships a real outbound event.
//
// The poll is gated aggressively to minimise iframe round-trips:
//   - bridge ready AND isReady AND toolbarTool is a placement tool AND the
//     user's cursor is over the editor iframe.
// When any of those flip off, the effect tears down and polling stops.
//
// Stream safety: if the assistant is mid-response, the poll skips the
// iframe call entirely and `onFieldAdded` is not called. The first tick
// after streaming ends catches whatever was dropped mid-stream.
//
// One-shot: after firing `onFieldAdded` once, the loop cancels; a fresh
// cycle arms when any of the gates re-enters the "all true" state (e.g.
// user moves their cursor off the iframe and back on, or flips placement
// tools).
//
// Refs-not-props for the streaming flag and the fire callback let the
// hook be called BEFORE useChat in the consumer (useChat produces the
// status + sendMessage used downstream). The consumer syncs the refs
// after useChat runs.

const POLL_INTERVAL_MS = 200

export type FieldAddedEvent = { tool: SupportedFieldType; delta: number }

type UseDetectUserAddedFieldArgs = {
  bridge: IframeBridge | null
  isReady: boolean
  toolbarTool: SupportedFieldType | null
  isCursorOverEditor: boolean
  isStreamingRef: MutableRefObject<boolean>
  onFieldAddedRef: MutableRefObject<(event: FieldAddedEvent) => void>
}

type UseDetectUserAddedFieldReturn = {
  // Consumers call this when they know a field was added by something
  // other than the user (e.g. the LLM's `create_field` tool). It advances
  // the baseline so the next poll tick does NOT attribute that field to
  // the user.
  advanceBaseline: (delta: number) => void
}

export const useDetectUserAddedField = ({
  bridge,
  isReady,
  toolbarTool,
  isCursorOverEditor,
  isStreamingRef,
  onFieldAddedRef,
}: UseDetectUserAddedFieldArgs): UseDetectUserAddedFieldReturn => {
  const baselineRef = useRef<number | null>(null)

  const advanceBaseline = useCallback((delta: number): void => {
    if (baselineRef.current !== null) {
      baselineRef.current += delta
    }
  }, [])

  useEffect(() => {
    const gatesOpen = bridge !== null && isReady && toolbarTool !== null && isCursorOverEditor
    if (!gatesOpen) {
      baselineRef.current = null
      return
    }
    // Reset on every re-entry (tool change, cursor re-entry, bridge swap).
    // Prevents a stale baseline from a previous session from mis-attributing
    // a held delta to the current tool.
    baselineRef.current = null
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const poll = async (): Promise<void> => {
      if (isStreamingRef.current) {
        // No iframe traffic during a stream; the first post-stream tick
        // will see whatever count is current and re-baseline / fire.
        return
      }
      const result = await bridge.getFields()
      if (cancelled || !result.success) {
        return
      }
      const count = result.data.fields.length
      if (baselineRef.current === null) {
        baselineRef.current = count
        return
      }
      if (count <= baselineRef.current) {
        return
      }
      if (isStreamingRef.current) {
        // Race-safety: if the stream started between the top of poll and
        // the getFields resolve, hold the baseline for the next tick.
        return
      }
      const delta = count - baselineRef.current
      baselineRef.current = count
      // One-shot: the loop cancels after firing. A new cycle arms when a
      // gate flips (cursor out / in, tool switch, etc.).
      cancelled = true
      onFieldAddedRef.current({ tool: toolbarTool, delta })
    }
    const pollLoop = async (): Promise<void> => {
      await poll()
      if (cancelled) {
        return
      }
      timeoutId = setTimeout(() => {
        void pollLoop()
      }, POLL_INTERVAL_MS)
    }
    void pollLoop()
    return () => {
      cancelled = true
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }, [bridge, isReady, toolbarTool, isCursorOverEditor, isStreamingRef, onFieldAddedRef])

  return { advanceBaseline }
}
