import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuth } from "@/lib/auth";
import { loadLadder, TOKEN_RE } from "@/lib/ladder";
import { supabaseAdmin } from "@/lib/supabase";

/** Sender changes the name and message before anyone has started. */
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
  const name = typeof body.name === "string" ? body.name.slice(0, 80) : "";
  const message = typeof body.message === "string" ? body.message.slice(0, 280) : "";

  const ladder = await loadLadder(db, token);
  if (!ladder) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await db.rpc("update_ladder_text", {
    p_ladder: ladder.id,
    p_user: auth.userId,
    p_name: name,
    p_message: message,
  });
  if (error) {
    if (error.message === "forbidden" || error.message === "not_pending") {
      return NextResponse.json(
        { error: error.message, state: await loadLadder(db, token) },
        { status: 409 },
      );
    }
    console.error("update_ladder_text failed", error);
    return NextResponse.json(
      { error: "db_error", detail: `${error.code ?? ""} ${error.message}`.trim() },
      { status: 500 },
    );
  }
  return NextResponse.json(await loadLadder(db, token));
}
