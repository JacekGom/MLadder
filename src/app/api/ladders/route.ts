import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { LADDER_SIZES, TRACK_ID_RE, type TrackSummary } from "@/lib/tracks";

type Body = { tracks?: unknown; message?: unknown };

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
}

/** Validates client-sent track metadata (it's only shown, never trusted). */
function parseTracks(raw: unknown): TrackSummary[] | null {
  if (!Array.isArray(raw)) return null;
  const out: TrackSummary[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (!t || typeof t !== "object") return null;
    const r = t as Record<string, unknown>;
    const id = str(r.id, 22);
    const name = str(r.name, 500);
    const artists = typeof r.artists === "string" ? r.artists.slice(0, 500) : "";
    if (!id || !TRACK_ID_RE.test(id) || !name || seen.has(id)) return null;
    const image =
      typeof r.image === "string" && r.image.startsWith("https://")
        ? r.image.slice(0, 500)
        : null;
    const durationMs =
      typeof r.durationMs === "number" && Number.isFinite(r.durationMs)
        ? Math.round(r.durationMs)
        : null;
    seen.add(id);
    out.push({ id, name, artists, image, durationMs });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const auth = await getRouteAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "db_not_configured" }, { status: 500 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const tracks = parseTracks(body.tracks);
  if (!tracks || !(LADDER_SIZES as readonly number[]).includes(tracks.length)) {
    return NextResponse.json({ error: "bad_tracks" }, { status: 400 });
  }
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 280) || null : null;

  const { data: ladder, error } = await db
    .from("ladders")
    .insert({ sender_id: auth.userId, size: tracks.length, message })
    .select("id, share_token")
    .single();
  if (error || !ladder) {
    console.error("ladder insert failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const { error: tracksError } = await db.from("ladder_tracks").insert(
    tracks.map((t) => ({
      ladder_id: ladder.id,
      spotify_track_id: t.id,
      name: t.name,
      artists: t.artists,
      album_image_url: t.image,
      duration_ms: t.durationMs,
    })),
  );
  if (tracksError) {
    console.error("ladder_tracks insert failed", tracksError);
    await db.from("ladders").delete().eq("id", ladder.id);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ token: ladder.share_token }, { status: 201 });
}
