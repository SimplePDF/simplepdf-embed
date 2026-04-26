import { type MutableRefObject, useCallback, useEffect, useRef } from 'react'
import type { IframeBridge, SupportedFieldType } from '../../../lib/embed-bridge'

// WORKAROUND: the SimplePDF editor does not currently emit an outbound
// FIELD_ADDED event when the user drops a field via the toolbar. Until it
// does, the chat's "new field added by the user" hint has to detect the
// drop by polling GET_FIELDS. This hook encapsulates that polling logic
// so the chat_pane call site stays readable, and so the workaround can be
// deleted in one place the day the editor ships a real outbound event.
//
// The polling LOOP is gated aggressively to minimise iframe round-trips:
//   - bridge ready AND isReady AND toolbarTool is a placement tool AND the
//     user's cursor is over the editor iframe.
// When any of those flip off, the loop pauses; when they flip back on,
// it resumes. The SET OF SEEN FIELD IDS persists across gate flips —
// only a bridge change resets it. This is what gives the post-LLM-turn
// reconciliation for free: while the LLM is streaming, the user's cursor
// often moves to the chat panel and back. Without persistence, each
// cursor re-entry would re-seed the seen set with the (now-larger) field
// set and the fields the user dropped during the stream would never
// surface to the LLM. With persistence, the next post-stream poll diffs
// the current set against the seen set and fires once.
//
// Stream safety: if the assistant is mid-response, the poll skips the
// iframe call entirely and `onFieldAdded` is not called. The first tick
// after streaming ends catches whatever was dropped mid-stream.
//
// Per-type tracking: the hook diffs by field id, not by count. The fire
// payload carries the list of tool types of the newly-added fields so
// the UI can show one icon per unique type when the user mixed (e.g.
// TEXT + SIGNATURE in the same batch).
//
// LLM-created fields bypass this nudge via `markFieldAsKnown(fieldId)`,
// called from the create_field middleware once the iframe has confirmed
// the new field id. The id goes straight into the seen set; the next
// poll's diff sees no user-added fields.
//
// Refs-not-props for the streaming flag and the fire callback let the
// hook be called BEFORE useChat in the consumer (useChat produces the
// status + sendMessage used downstream). The consumer syncs the refs
// after useChat runs.

const POLL_INTERVAL_MS = 200

export type FieldAddedEvent = { tools: SupportedFieldType[]; delta: number }

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
  // other than the user (e.g. the LLM's `create_field` tool returned a
  // field id). The id is added to the seen set so the next poll does
  // NOT attribute that field to the user.
  markFieldAsKnown: (fieldId: string) => void
}

export const useDetectUserAddedField = ({
  bridge,
  isReady,
  toolbarTool,
  isCursorOverEditor,
  isStreamingRef,
  onFieldAddedRef,
}: UseDetectUserAddedFieldArgs): UseDetectUserAddedFieldReturn => {
  const seenIdsRef = useRef<Set<string> | null>(null)
  const lastBridgeRef = useRef<IframeBridge | null>(null)

  const markFieldAsKnown = useCallback((fieldId: string): void => {
    if (seenIdsRef.current !== null) {
      seenIdsRef.current.add(fieldId)
    }
  }, [])

  useEffect(() => {
    // Bridge swap is the only event that invalidates the seen set; the
    // ids belong to a different document context. Tool changes, cursor
    // re-entry, and isReady transitions do NOT reset — see the file header
    // for why persistence drives the post-stream reconciliation.
    if (lastBridgeRef.current !== bridge) {
      seenIdsRef.current = null
      lastBridgeRef.current = bridge
    }

    const gatesOpen = bridge !== null && isReady && toolbarTool !== null && isCursorOverEditor
    if (!gatesOpen) {
      return
    }
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const poll = async (): Promise<void> => {
      if (isStreamingRef.current) {
        // No iframe traffic during a stream; the first post-stream tick
        // will see whatever's currently in the editor and diff against
        // the seen set.
        return
      }
      const result = await bridge.getFields()
      if (cancelled || !result.success) {
        return
      }
      const currentFields = result.data.fields
      if (seenIdsRef.current === null) {
        seenIdsRef.current = new Set(currentFields.map((field) => field.field_id))
        return
      }
      const seen = seenIdsRef.current
      const addedFields = currentFields.filter((field) => !seen.has(field.field_id))
      if (addedFields.length === 0) {
        return
      }
      if (isStreamingRef.current) {
        // Race-safety: if the stream started between the top of poll and
        // the getFields resolve, hold the seen set for the next tick.
        return
      }
      for (const field of addedFields) {
        seen.add(field.field_id)
      }
      const tools = addedFields.map((field) => field.type)
      onFieldAddedRef.current({ tools, delta: tools.length })
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

  return { markFieldAsKnown }
}
