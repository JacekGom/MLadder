import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { authorizeUrl } from "@/lib/spotify";

export async function GET() {
  const session = await getSession();
  const state = randomBytes(16).toString("hex");
  session.oauthState = state;
  await session.save();
  return NextResponse.redirect(authorizeUrl(state));
}
