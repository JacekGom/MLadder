import type { NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";
import { getSession } from "@/lib/session";
import { applyTokens, exchangeCode, getMe } from "@/lib/spotify";
import { supabaseAdmin } from "@/lib/supabase";
import { readState } from "@/lib/oauthState";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const session = await getSession();

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // Same browser: the state must match the cookie. Another browser (phone
  // login finished via the Spotify app): the signed state is enough.
  const signed = state ? readState(state) : null;
  const stateOk =
    !!signed && (!session.oauthState || state === session.oauthState);
  const next = safeNext(signed?.next ?? session.loginNext);
  session.oauthState = undefined;
  session.loginNext = undefined;

  if (error || !code || !stateOk) {
    await session.save();
    const reason = error === "access_denied" ? error : "login_failed";
    return redirectTo(`/?error=${reason}`);
  }

  try {
    applyTokens(session, await exchangeCode(code));
    const me = await getMe(session.accessToken!);
    session.userId = me.id;

    const db = supabaseAdmin();
    if (db) {
      const { error: dbError } = await db.from("users").upsert({
        id: me.id,
        display_name: me.display_name,
        avatar_url: me.images?.[0]?.url ?? null,
        last_login_at: new Date().toISOString(),
      });
      if (dbError) console.error("users upsert failed", dbError);
    }

    await session.save();
    return redirectTo(next);
  } catch (e) {
    console.error(e);
    session.destroy();
    return redirectTo("/?error=login_failed");
  }
}
