import { redirect } from "next/navigation";
import { getSession } from "./session";
import { ensureAccessToken } from "./spotify";

/**
 * For server components: returns the logged-in user's id and a valid
 * Spotify token. Pages can't write cookies, so an expired token is
 * refreshed by bouncing through /api/auth/refresh and back to `path`.
 */
export async function requirePageAuth(path: string) {
  const session = await getSession();
  if (!session.userId || !session.accessToken) {
    redirect(`/api/auth/login?next=${encodeURIComponent(path)}`);
  }
  if (!session.expiresAt || Date.now() >= session.expiresAt) {
    redirect(`/api/auth/refresh?next=${encodeURIComponent(path)}`);
  }
  return { userId: session.userId, token: session.accessToken };
}

/** For route handlers: refreshes (and saves) the token if needed. */
export async function getRouteAuth() {
  const session = await getSession();
  if (!session.userId) return null;
  try {
    const result = await ensureAccessToken(session);
    if (!result) return null;
    if (result.refreshed) await session.save();
    return { userId: session.userId, token: result.token };
  } catch (e) {
    console.error(e);
    return null;
  }
}

/** Only allow same-site relative paths as post-login destinations. */
export function safeNext(raw: string | null | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}
