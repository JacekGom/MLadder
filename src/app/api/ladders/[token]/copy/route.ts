import { NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { loadLadder, TOKEN_RE } from "@/lib/ladder";
import { supabaseAdmin } from "@/lib/supabase";

/** Sender copies a ladder (same songs, name, message) to send to someone else. */
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

  const { data, error } = await db.rpc("copy_ladder", {
    p_ladder: ladder.id,
    p_user: auth.userId,
  });
  if (error) {
    if (error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    console.error("copy_ladder failed", error);
    return NextResponse.json(
      { error: "db_error", detail: `${error.code ?? ""} ${error.message}`.trim() },
      { status: 500 },
    );
  }
  return NextResponse.json({ token: data as string });
}
