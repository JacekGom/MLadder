import { NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { loadLadder, TOKEN_RE } from "@/lib/ladder";
import { supabaseAdmin } from "@/lib/supabase";

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

  const { data: ok, error } = await db.rpc("start_ladder", {
    p_ladder: ladder.id,
    p_user: auth.userId,
  });
  if (error) {
    console.error("start_ladder failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!ok) return NextResponse.json({ error: "taken" }, { status: 409 });

  return NextResponse.json(await loadLadder(db, token));
}
