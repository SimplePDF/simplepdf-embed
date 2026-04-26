// Reads the share id from the incoming request URL (`?share=<id>`). The
// share id is passed in the query on every client request so it mirrors the
// browser address bar — an invite link is reusable as-is, no cookie dance.
//
// Blank / missing values collapse to `null` so callers can pass the return
// value straight into `resolveApiKey` (which handles the null case).
export const readShareIdFromUrl = (request: Request): string | null => {
  const value = new URL(request.url).searchParams.get('share')
  if (value === null || value === '') {
    return null
  }
  return value
}
