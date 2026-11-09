import { NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { loadLadder, TOKEN_RE } from "@/lib/ladder";
import { supabaseAdmin } from "@/lib/supabase";

/** Plays a finished ladder again with a fresh random draw. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const auth = await getRouteAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "db_not_configured" }, { status: 500 });
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ladder = await loadLadder(db, token);
  if (!ladder) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await db.rpc("restart_ladder", {
    p_ladder: ladder.id,
    p_user: auth.userId,
  });
  if (error) {
    if (error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    console.error("restart_ladder failed", error);
    // Most likely migration 0004 hasn't been run yet.
    return NextResponse.json(
      { error: "db_error", detail: `${error.code ?? ""} ${error.message}`.trim() },
      { status: 500 },
    );
  }
  return NextResponse.json(await loadLadder(db, token));
}
