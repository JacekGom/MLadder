/** The subset of a Spotify track the app stores and renders. */
export type TrackSummary = {
  id: string;
  name: string;
  artists: string;
  image: string | null;
  durationMs: number | null;
};

export type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms?: number;
  is_local?: boolean;
  artists?: { name: string }[];
  album?: { images?: { url: string; width?: number | null }[] };
};

export function toSummary(t: SpotifyTrack): TrackSummary {
  const images = t.album?.images ?? [];
  // Spotify lists images largest first (640, 300, 64); 300px looks sharp
  // in both lists and duel cards.
  const image = images[1]?.url ?? images[0]?.url ?? null;
  return {
    id: t.id,
    name: t.name,
    artists: (t.artists ?? []).map((a) => a.name).join(", "),
    image,
    durationMs: t.duration_ms ?? null,
  };
}

/** Local files and unavailable tracks have no id and can't be played. */
export function usable(t: SpotifyTrack | null | undefined): t is SpotifyTrack {
  return !!t && !!t.id && !t.is_local;
}

export const LADDER_SIZES = [4, 8, 16, 32] as const;
export type LadderSize = (typeof LADDER_SIZES)[number];

export const TRACK_ID_RE = /^[A-Za-z0-9]{22}$/;
