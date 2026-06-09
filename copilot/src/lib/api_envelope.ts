import { z } from 'zod'

// Shared shape of the JSON body the server returns for every non-2xx
// response from /api/chat, /api/summarize, /api/transcribe, and the demo
// preflight gate. The server emits values of this exact union via
// `Response.json(...)`, and the client classifier parses incoming error
// messages against it.
//
// Coupling both sides to a single discriminated union means:
// - a typo in an `error` token on the server fails the build
// - adding a new error kind forces both producer + classifier to update
// - the client's switch on `body.error` is exhaustively checkable
//
// This is a Zod discriminated union (not a bare type) so the client has a
// runtime owner: a direct `fetch` response body can be `safeParse`d into a
// typed `ServerErrorBody` instead of an unchecked `response.json() as …`.
// Per the global rule, the schema and the inferred type share the same
// PascalCase name. Every variant is byte-identical to the historical type;
// adding a variant here forces a matching status entry in the classifier.
//
// Status codes are NOT part of the body type — they're carried on the
// HTTP response. The client recovers them via the `statusCode` field
// the BYOK transport injects (`formatStreamError`).
export const ServerErrorBody = z.discriminatedUnion('error', [
  z.object({ error: z.literal('forbidden_blocked') }),
  z.object({ error: z.literal('forbidden_origin') }),
  z.object({ error: z.literal('misconfigured_environment'), message: z.string() }),
  z.object({ error: z.literal('share_required') }),
  z.object({ error: z.literal('rate_limited'), reason: z.string() }),
  z.object({ error: z.literal('service_unavailable'), reason: z.string() }),
  z.object({ error: z.literal('bad_request'), message: z.string() }),
  z.object({ error: z.literal('payload_too_large'), message: z.string() }),
  z.object({ error: z.literal('unsupported_media_type'), message: z.string() }),
])

export type ServerErrorBody = z.infer<typeof ServerErrorBody>
