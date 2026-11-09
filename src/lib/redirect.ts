/**
 * Redirect with a relative Location header. Next.js rewrites 127.0.0.1 to
 * "localhost" in req.nextUrl, which would drop the session cookie locally,
 * so we never build absolute URLs from the request.
 */
export function redirectTo(
  path: string,
  init?: { status?: number; headers?: HeadersInit },
): Response {
  const headers = new Headers(init?.headers);
  headers.set("Location", path);
  return new Response(null, { status: init?.status ?? 307, headers });
}
