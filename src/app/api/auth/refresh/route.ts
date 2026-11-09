import type { NextRequest } from "next/server";
import { redirectTo } from "@/lib/redirect";
import { getSession } from "@/lib/session";
import { ensureAccessToken } from "@/lib/spotify";

/** Refreshes the Spotify token (pages can't write cookies) and goes back. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const session = await getSession();
  try {
    const result = await ensureAccessToken(session);
    if (!result) session.destroy();
    else await session.save();
  } catch (e) {
    console.error(e);
    session.destroy();
  }
  return redirectTo(next);
}
