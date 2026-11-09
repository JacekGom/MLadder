import { NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { loadLadder, TOKEN_RE } from "@/lib/ladder";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Removes the ladder from the caller's profile; the database row goes away
 * once both the sender and the recipient have removed it.
 */
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
  if (!ladder) return NextResponse.json({ result: "deleted" });

  const { data, error } = await db.rpc("delete_ladder", {
    p_ladder: ladder.id,
    p_user: auth.userId,
  });
  if (error) {
    if (error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    console.error("delete_ladder failed", error);
    return NextResponse.json(
      { error: "db_error", detail: `${error.code ?? ""} ${error.message}`.trim() },
      { status: 500 },
    );
  }
  return NextResponse.json({ result: data as string });
}
