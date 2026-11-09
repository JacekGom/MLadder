import { NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { spotifyFetch } from "@/lib/spotify";

type PlayerResponse = {
  is_playing: boolean;
  progress_ms: number | null;
  device?: { volume_percent: number | null; supports_volume?: boolean };
  item?: { id: string; duration_ms: number; linked_from?: { id: string } } | null;
};

/** Playback state of the user's active device (used on phones). */
export async function GET() {
  const auth = await getRouteAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await spotifyFetch("/me/player?market=from_token", auth.token, { method: "GET" });
  if (res.status === 204) return NextResponse.json({ active: false });
  if (!res.ok) return NextResponse.json({ active: false, error: res.status });
  const p: PlayerResponse = await res.json();
  return NextResponse.json({
    active: true,
    isPlaying: p.is_playing,
    positionMs: p.progress_ms ?? 0,
    durationMs: p.item?.duration_ms ?? 0,
    trackIds: [p.item?.id, p.item?.linked_from?.id].filter(Boolean),
    volume: p.device?.volume_percent ?? null,
    supportsVolume: p.device?.supports_volume ?? p.device?.volume_percent != null,
  });
}
