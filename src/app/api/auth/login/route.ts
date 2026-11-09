import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { authorizeUrl } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const state = randomBytes(16).toString("hex");
  session.oauthState = state;
  session.loginNext = safeNext(req.nextUrl.searchParams.get("next"));
  await session.save();
  return NextResponse.redirect(authorizeUrl(state));
}
