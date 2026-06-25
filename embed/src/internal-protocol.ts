// Internal protocol message types (editor-owned, hand-authored). These drive the
// bridge lifecycle and request correlation; they are intentionally excluded from
// the public operation/event vocabulary and from embed-api.json. Kept in their
// own zero-dependency module so the bridge (and therefore the root entry) does
// not pull the generated OPERATIONS table that /protocol re-exports.

export const INTERNAL_PROTOCOL = {
  EDITOR_READY: 'EDITOR_READY',
  DOCUMENT_LOADED: 'DOCUMENT_LOADED',
  REQUEST_RESULT: 'REQUEST_RESULT',
} as const

export type InternalProtocolType = (typeof INTERNAL_PROTOCOL)[keyof typeof INTERNAL_PROTOCOL]
