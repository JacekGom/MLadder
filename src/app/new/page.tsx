import Link from "next/link";
import { requirePageAuth } from "@/lib/auth";
import { spotifyGet } from "@/lib/spotify";
import { toSummary, usable, type SpotifyTrack, type TrackSummary } from "@/lib/tracks";
import LadderBuilder from "./LadderBuilder";

export const metadata = { title: "Nowa drabinka · Drabinka muzyczna" };

export default async function NewLadderPage() {
  const { token } = await requirePageAuth("/new");

  let top: TrackSummary[] = [];
  let topError = false;
  try {
    // short_term = roughly the last 4 weeks; 50 is Spotify's maximum.
    const data = await spotifyGet<{ items: SpotifyTrack[] }>(
      "/me/top/tracks?time_range=short_term&limit=50",
      token,
    );
    top = data.items.filter(usable).map(toSummary);
  } catch (e) {
    console.error(e);
    topError = true;
  }

  return (
    <main>
      <p>
        <Link href="/" className="muted">
          ← Wróć
        </Link>
      </p>
      <h1>Nowa drabinka</h1>
      <LadderBuilder top={top} topError={topError} />
    </main>
  );
}
