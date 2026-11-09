import Link from "next/link";
import { notFound } from "next/navigation";
import CopyLink from "@/components/CopyLink";
import { requirePageAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const metadata = { title: "Drabinka · Drabinka muzyczna" };

type Ladder = {
  id: string;
  size: number;
  status: string;
  message: string | null;
  sender_id: string;
  recipient_id: string | null;
  sender: { display_name: string | null } | null;
};

export default async function LadderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{24}$/.test(token)) notFound();

  const { userId } = await requirePageAuth(`/l/${token}`);
  const db = supabaseAdmin();
  if (!db) throw new Error("Supabase is not configured.");

  const { data: ladder } = await db
    .from("ladders")
    .select(
      "id, size, status, message, sender_id, recipient_id, sender:users!ladders_sender_id_fkey(display_name)",
    )
    .eq("share_token", token)
    .maybeSingle<Ladder>();
  if (!ladder) notFound();

  const { data: tracks } = await db
    .from("ladder_tracks")
    .select("spotify_track_id, name, artists, album_image_url")
    .eq("ladder_id", ladder.id)
    .order("name");

  const isSender = ladder.sender_id === userId;
  const senderName = ladder.sender?.display_name ?? ladder.sender_id;

  return (
    <main className="stack">
      <p>
        <Link href="/" className="muted">
          ← Strona główna
        </Link>
      </p>
      <h1>
        {isSender ? "Twoja drabinka" : `Drabinka od ${senderName}`} · {ladder.size} piosenek
      </h1>
      {ladder.message && <blockquote className="card">„{ladder.message}”</blockquote>}

      {isSender ? (
        <>
          <p className="muted">
            Wyślij link do tej strony osobie, która ma rozstrzygnąć drabinkę.
          </p>
          <div>
            <CopyLink />
          </div>
        </>
      ) : (
        <p className="muted">
          Rozgrywanie pojedynków pojawi się w następnej wersji aplikacji. Na razie
          możesz zobaczyć, jakie piosenki trafiły do drabinki.
        </p>
      )}

      <ul className="tracks">
        {(tracks ?? []).map((t) => (
          <li key={t.spotify_track_id}>
            <a
              className="track"
              href={`https://open.spotify.com/track/${t.spotify_track_id}`}
              target="_blank"
              rel="noreferrer"
            >
              {t.album_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.album_image_url} alt="" width={48} height={48} />
              ) : (
                <span className="cover-placeholder" />
              )}
              <span className="track-text">
                <span className="track-name">{t.name}</span>
                <span className="muted">{t.artists}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
