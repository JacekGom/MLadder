import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMe, type SpotifyUser } from "@/lib/spotify";

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
          <form action="/api/auth/logout" method="post" style={{ marginTop: 16 }}>
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
