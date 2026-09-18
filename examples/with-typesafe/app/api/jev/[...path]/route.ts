// Same-origin proxy to JEV. api.typesafe.ai sends no Access-Control-Allow-Origin,
// so a browser-direct call is blocked; this route forwards it server-side (no CORS)
// with the caller's BYOK Authorization header, which it never stores. The path is
// allowlisted to the endpoints the SDK uses, so it is not an open relay.
// CF: plans/P107-typesafe-jev-example.md

const JEV_UPSTREAM = "https://api.typesafe.ai"
const ALLOWED_PATHS = new Set(["v1/systemone"])
const UPSTREAM_TIMEOUT_MS = 15_000

export const POST = async (
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> => {
  const { path } = await context.params
  const joined = path.join("/")
  if (!ALLOWED_PATHS.has(joined)) {
    return Response.json({ error: "Not a permitted JEV path" }, { status: 404 })
  }

  const authorization = request.headers.get("authorization")
  const body = await request.text()

  try {
    const upstream = await fetch(`${JEV_UPSTREAM}/${joined}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorization !== null ? { authorization } : {}),
      },
      body,
      // Never follow a redirect: a 3xx could otherwise replay this POST (and the BYOK
      // Authorization header) to an arbitrary host. The upstream is a fixed API origin.
      redirect: "error",
      // Forward the caller's cancellation AND cap the round trip.
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
    })
    const responseBody = await upstream.text()
    return new Response(responseBody, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    })
  } catch {
    return Response.json({ error: "JEV upstream is unavailable" }, { status: 502 })
  }
}
