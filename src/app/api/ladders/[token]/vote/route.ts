import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { loadLadder, TOKEN_RE } from "@/lib/ladder";
import { supabaseAdmin } from "@/lib/supabase";
import { TRACK_ID_RE } from "@/lib/tracks";

const KNOWN = new Set(["forbidden", "not_in_progress", "bad_match", "bad_winner"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const auth = await getRouteAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "db_not_configured" }, { status: 500 });
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: { round?: unknown; slot?: unknown; winner?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const { round, slot, winner } = body;
  if (
    !Number.isInteger(round) ||
    !Number.isInteger(slot) ||
    typeof winner !== "string" ||
    !TRACK_ID_RE.test(winner)
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const ladder = await loadLadder(db, token);
  if (!ladder) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await db.rpc("vote_ladder", {
    p_ladder: ladder.id,
    p_user: auth.userId,
    p_round: round,
    p_slot: slot,
    p_winner: winner,
  });
  if (error) {
    // Already decided etc.: return the current state so the client resyncs.
    if (KNOWN.has(error.message)) {
      return NextResponse.json(
        { error: error.message, state: await loadLadder(db, token) },
        { status: 409 },
      );
    }
    console.error("vote_ladder failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json(await loadLadder(db, token));
}
