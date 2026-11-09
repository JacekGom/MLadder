import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * OAuth "state" that verifies itself. On phones the Spotify login often
 * hands off to the Spotify app, which sends the user back to the default
 * browser, not the one (e.g. an in-app browser) where they started. That
 * browser has no session cookie with the expected state, so a cookie-only
 * check rejected the login. The state is signed with SESSION_SECRET, carries
 * the post-login path and expires after 10 minutes.
 */

const MAX_AGE_MS = 10 * 60 * 1000;

function sign(payload: string) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(payload)
    .digest("base64url");
}

export function makeState(next: string): string {
  const payload = Buffer.from(
    JSON.stringify({ n: next, t: Date.now(), r: randomBytes(8).toString("hex") }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the post-login path if the state is genuine and fresh. */
export function readState(state: string): { next: string } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { n, t } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof t !== "number" || Date.now() - t > MAX_AGE_MS) return null;
    return { next: typeof n === "string" ? n : "/" };
  } catch {
    return null;
  }
}
