import { NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/auth";

/** Gives the browser the user's own token for the Web Playback SDK. */
export async function GET() {
  const auth = await getRouteAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(
    { token: auth.token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
