import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { authorizeUrl } from "@/lib/spotify";
import { makeState } from "@/lib/oauthState";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const state = makeState(next);
  session.oauthState = state;
  session.loginNext = next;
  await session.save();
  return NextResponse.redirect(authorizeUrl(state));
}
