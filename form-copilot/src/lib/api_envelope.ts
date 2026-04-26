// Shared shape of the JSON body the server returns for every non-2xx
// response from /api/chat, /api/summarize, and the demo preflight gate.
// The server emits values of this exact union via `Response.json(...)`,
// and the client classifier parses incoming error messages against it.
//
// Coupling both sides to a single discriminated union means:
// - a typo in an `error` token on the server fails the build
// - adding a new error kind forces both producer + classifier to update
// - the client's switch on `body.error` is exhaustively checkable
//
// Status codes are NOT part of the body type — they're carried on the
// HTTP response. The client recovers them via the `statusCode` field
// the BYOK transport injects (`formatStreamError`).
export type ServerErrorBody =
  | { error: 'forbidden_blocked' }
  | { error: 'forbidden_origin' }
  | { error: 'misconfigured_environment'; message: string }
  | { error: 'share_required' }
  | { error: 'rate_limited'; reason: string }
  | { error: 'service_unavailable'; reason: string }
