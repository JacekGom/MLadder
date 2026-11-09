import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { spotifyFetch } from "@/lib/spotify";
import { TRACK_ID_RE } from "@/lib/tracks";

/**
 * Starts a track on the given device (the in-browser player on desktop)
 * or, without one, on the user's active Spotify device (e.g. the app on
 * their phone). Returns { error: "no_device" } when nothing is active.
 */
export async function POST(req: NextRequest) {
  const auth = await getRouteAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { trackId?: unknown; deviceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const { trackId, deviceId } = body;
  if (typeof trackId !== "string" || !TRACK_ID_RE.test(trackId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const qs =
    typeof deviceId === "string" && /^[A-Za-z0-9]{1,100}$/.test(deviceId)
      ? `?device_id=${deviceId}`
      : "";

  const res = await spotifyFetch(`/me/player/play${qs}`, auth.token, {
    method: "PUT",
    body: { uris: [`spotify:track:${trackId}`] },
  });
  if (res.ok) return NextResponse.json({ ok: true });
  if (res.status === 404) return NextResponse.json({ error: "no_device" }, { status: 409 });
  if (res.status === 403) return NextResponse.json({ error: "premium_required" }, { status: 403 });
  console.error("play failed", res.status, await res.text());
  return NextResponse.json({ error: "play_failed" }, { status: 502 });
}
