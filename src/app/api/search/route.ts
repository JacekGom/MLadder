import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { spotifyGet } from "@/lib/spotify";
import { toSummary, usable, type SpotifyTrack } from "@/lib/tracks";

export async function GET(req: NextRequest) {
  const auth = await getRouteAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return NextResponse.json({ tracks: [] });

  const params = new URLSearchParams({ q, type: "track", limit: "10" });
  try {
    const data = await spotifyGet<{ tracks: { items: (SpotifyTrack | null)[] } }>(
      `/search?${params}`,
      auth.token,
    );
    return NextResponse.json({
      tracks: data.tracks.items.filter(usable).map(toSummary),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }
}
