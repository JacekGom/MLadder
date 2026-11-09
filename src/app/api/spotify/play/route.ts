import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { spotifyFetch, spotifyGet } from "@/lib/spotify";
import { TRACK_ID_RE } from "@/lib/tracks";

type Device = {
  id: string | null;
  is_active: boolean;
  is_restricted: boolean;
  type: string;
  name: string;
};

/**
 * Picks a Spotify Connect device when the browser has no player of its own
 * (phones). Without an explicit device_id Spotify only targets a device
 * that is currently *active*; the app on a phone stops being active soon
 * after it is paused or backgrounded, even though it is still listed and
 * can be woken up by addressing it directly.
 */
async function pickDevice(token: string): Promise<Device | null> {
  const { devices } = await spotifyGet<{ devices: Device[] }>("/me/player/devices", token);
  const usable = devices.filter((d) => d.id && !d.is_restricted);
  return (
    usable.find((d) => d.is_active) ??
    usable.find((d) => d.type === "Smartphone") ??
    usable[0] ??
    null
  );
}

/**
 * Starts a track on the given device (the in-browser player on desktop)
 * or on a Spotify Connect device (e.g. the app on the user's phone).
 * Returns { error: "no_device" } when there is nothing to play on.
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
  const { trackId } = body;
  if (typeof trackId !== "string" || !TRACK_ID_RE.test(trackId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let deviceId =
    typeof body.deviceId === "string" && /^[A-Za-z0-9]{1,100}$/.test(body.deviceId)
      ? body.deviceId
      : null;
  if (!deviceId) {
    try {
      deviceId = (await pickDevice(auth.token))?.id ?? null;
    } catch (e) {
      console.error("devices failed", e);
    }
    if (!deviceId) return NextResponse.json({ error: "no_device" }, { status: 409 });
  }

  const res = await spotifyFetch(`/me/player/play?device_id=${deviceId}`, auth.token, {
    method: "PUT",
    body: { uris: [`spotify:track:${trackId}`] },
  });
  if (res.ok) return NextResponse.json({ ok: true, deviceId });

  const text = await res.text();
  console.error("play failed", res.status, text);
  if (res.status === 404) return NextResponse.json({ error: "no_device" }, { status: 409 });
  let reason = "";
  try {
    const err = JSON.parse(text).error;
    reason = err?.reason ?? err?.message ?? "";
  } catch {
    reason = text.slice(0, 200);
  }
  if (res.status === 403 && /premium/i.test(reason)) {
    return NextResponse.json({ error: "premium_required" }, { status: 403 });
  }
  return NextResponse.json(
    { error: "play_failed", detail: `${res.status} ${reason}`.trim() },
    { status: 502 },
  );
}
