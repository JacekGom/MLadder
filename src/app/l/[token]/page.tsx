import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth";
import { loadLadder, TOKEN_RE } from "@/lib/ladder";
import { supabaseAdmin } from "@/lib/supabase";
import LadderPlay from "./LadderPlay";

export const metadata = { title: "Drabinka · Drabinka muzyczna" };

export default async function LadderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();

  const { userId } = await requirePageAuth(`/l/${token}`);
  const db = supabaseAdmin();
  if (!db) throw new Error("Supabase is not configured.");

  const ladder = await loadLadder(db, token);
  if (!ladder) notFound();

  return (
    <main className="stack">
      <p>
        <Link href="/" className="muted">
          ← Strona główna
        </Link>
      </p>
      <LadderPlay initial={ladder} userId={userId} />
    </main>
  );
}
