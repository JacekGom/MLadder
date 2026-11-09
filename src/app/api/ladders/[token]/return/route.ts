import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { loadLadder, TOKEN_RE } from "@/lib/ladder";
import { supabaseAdmin } from "@/lib/supabase";

/** The player sends the finished ladder back to the sender. */
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

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.slice(0, 280) : "";

  const ladder = await loadLadder(db, token);
  if (!ladder) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await db.rpc("return_ladder", {
    p_ladder: ladder.id,
    p_user: auth.userId,
    p_message: message,
  });
  if (error) {
    if (error.message === "forbidden" || error.message === "not_done") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("return_ladder failed", error);
    // Most likely migration 0005 hasn't been run yet.
    return NextResponse.json(
      { error: "db_error", detail: `${error.code ?? ""} ${error.message}`.trim() },
      { status: 500 },
    );
  }
  return NextResponse.json(await loadLadder(db, token));
}
