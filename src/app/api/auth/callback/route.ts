import type { NextRequest } from "next/server";
import { redirectTo } from "@/lib/redirect";
import { getSession } from "@/lib/session";
import { applyTokens, exchangeCode, getMe } from "@/lib/spotify";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const session = await getSession();

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = session.oauthState;
  session.oauthState = undefined;

  if (error || !code || !state || state !== expectedState) {
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
    return redirectTo("/");
  } catch (e) {
    console.error(e);
    session.destroy();
    return redirectTo("/?error=login_failed");
  }
}
