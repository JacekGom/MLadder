import { NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { spotifyFetch } from "@/lib/spotify";

export async function POST() {
  const auth = await getRouteAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await spotifyFetch("/me/player/pause", auth.token, { method: "PUT" });
  // 403/404 here mostly mean "already paused" or "no device": nothing to do.
  return NextResponse.json({ ok: res.ok });
}
