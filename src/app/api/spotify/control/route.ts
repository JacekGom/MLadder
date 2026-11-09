import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { spotifyFetch } from "@/lib/spotify";

/** Seek / volume / resume on the user's active device (used on phones). */
export async function POST(req: NextRequest) {
  const auth = await getRouteAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { action?: unknown; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const value = typeof body.value === "number" && Number.isFinite(body.value) ? body.value : 0;

  let path: string;
  switch (body.action) {
    case "seek":
      path = `/me/player/seek?position_ms=${Math.max(0, Math.round(value))}`;
      break;
    case "volume":
      path = `/me/player/volume?volume_percent=${Math.min(100, Math.max(0, Math.round(value)))}`;
      break;
    case "resume":
      path = "/me/player/play";
      break;
    default:
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const res = await spotifyFetch(path, auth.token, { method: "PUT" });
  // Phones often refuse remote volume changes (403 VOLUME_CONTROL_DISALLOW).
  return NextResponse.json({ ok: res.ok, status: res.status }, { status: res.ok ? 200 : 409 });
}
