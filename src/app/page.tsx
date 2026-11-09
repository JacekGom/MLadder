import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { getMe, type SpotifyUser } from "@/lib/spotify";
import { supabaseAdmin } from "@/lib/supabase";

const STATUS: Record<string, string> = {
  pending: "czeka na odbiorcę",
  in_progress: "w trakcie",
  done: "rozstrzygnięta",
};

function sentStatus(l: SentLadder) {
  if (l.returned_at) return "✉ wynik odesłany";
  return l.status === "pending" ? STATUS.pending : "w trakcie";
}

function receivedStatus(l: SentLadder) {
  if (l.returned_at) return "odesłana";
  return l.status === "done" ? "do odesłania" : (STATUS[l.status] ?? l.status);
}

type SentLadder = {
  share_token: string;
  size: number;
  status: string;
  name?: string | null;
  message: string | null;
  returned_at?: string | null;
  created_at: string;
};

const ERRORS: Record<string, string> = {
  access_denied: "Logowanie anulowane w Spotify.",
  login_failed:
    "Nie udało się zalogować. Jeśli aplikacja jest w trybie deweloperskim, Twoje konto musi być dodane w Spotify Dashboard (User Management).",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getSession();

  let me: SpotifyUser | null = null;
  if (session.accessToken) {
    if (!session.expiresAt || Date.now() >= session.expiresAt) {
      redirect("/api/auth/refresh?next=/");
    }
    try {
      me = await getMe(session.accessToken);
    } catch (e) {
      console.error(e);
    }
  }

  let sent: SentLadder[] = [];
  let received: SentLadder[] = [];
  const db = supabaseAdmin();
  if (me && db) {
    const { data } = await db
      .from("ladders")
      .select("*")
      .eq("sender_id", me.id)
      .order("created_at", { ascending: false })
      .limit(20);
    sent = data ?? [];
    const { data: rec } = await db
      .from("ladders")
      .select("*")
      .eq("recipient_id", me.id)
      .neq("sender_id", me.id)
      .order("created_at", { ascending: false })
      .limit(20);
    received = rec ?? [];
  }

  return (
    <main>
      <h1>Drabinka muzyczna</h1>
      <p className="muted">
        Wybierz piosenki, wyślij je znajomemu, a on rozstrzygnie w drabince,
        która jest najlepsza.
      </p>

      {error && <p className="error">{ERRORS[error] ?? ERRORS.login_failed}</p>}

      {me ? (
        <>
          <div className="card">
            {me.images?.[0]?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar" src={me.images[0].url} alt="" />
            )}
            <div>
              <div>
                Zalogowano jako <strong>{me.display_name ?? me.id}</strong>
              </div>
              {me.product && me.product !== "premium" && (
                <div className="muted">
                  Konto bez Premium: odtwarzanie w aplikacji może nie działać.
                </div>
              )}
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            <Link className="button" href="/new">
              Nowa drabinka
            </Link>
          </p>

          {sent.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <h2>Wysłane</h2>
              <ul className="ladder-list">
                {sent.map((l) => (
                  <li key={l.share_token}>
                    <Link href={`/l/${l.share_token}`}>
                      {l.name || l.message || `Drabinka ${l.size} piosenek`}
                    </Link>
                    <span className="muted">
                      {l.size} · {sentStatus(l)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {received.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <h2>Otrzymane</h2>
              <ul className="ladder-list">
                {received.map((l) => (
                  <li key={l.share_token}>
                    <Link href={`/l/${l.share_token}`}>
                      {l.name || l.message || `Drabinka ${l.size} piosenek`}
                    </Link>
                    <span className="muted">
                      {l.size} · {receivedStatus(l)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <form action="/api/auth/logout" method="post" style={{ marginTop: 24 }}>
            <button className="button secondary" type="submit">
              Wyloguj
            </button>
          </form>
        </>
      ) : (
        <a className="button" href="/api/auth/login">
          Zaloguj przez Spotify
        </a>
      )}
    </main>
  );
}
