import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrackSummary } from "./tracks";

export type Match = {
  round: number;
  slot: number;
  trackA: string;
  trackB: string;
  winner: string | null;
};

export type LadderState = {
  id: string;
  token: string;
  size: number;
  status: "pending" | "in_progress" | "done";
  message: string | null;
  senderId: string;
  senderName: string;
  recipientId: string | null;
  recipientName: string | null;
  winnerTrackId: string | null;
  tracks: TrackSummary[];
  matches: Match[];
};

export const TOKEN_RE = /^[a-f0-9]{24}$/;

export function roundCount(size: number) {
  return Math.round(Math.log2(size));
}

/** "Finał", "Półfinał", ... counted from the end. */
export function roundName(round: number, size: number) {
  const fromEnd = roundCount(size) - 1 - round;
  return (
    ["Finał", "Półfinał", "Ćwierćfinał"][fromEnd] ?? `Runda ${round + 1}`
  );
}

/** The first undecided duel, round by round. */
export function nextMatch(matches: Match[]): Match | null {
  return (
    [...matches]
      .filter((m) => !m.winner)
      .sort((a, b) => a.round - b.round || a.slot - b.slot)[0] ?? null
  );
}

type Row = {
  id: string;
  share_token: string;
  size: number;
  status: LadderState["status"];
  message: string | null;
  sender_id: string;
  recipient_id: string | null;
  winner_track_id: string | null;
  sender: { display_name: string | null } | null;
  recipient: { display_name: string | null } | null;
};

export async function loadLadder(
  db: SupabaseClient,
  token: string,
): Promise<LadderState | null> {
  const { data: l, error } = await db
    .from("ladders")
    .select(
      "id, share_token, size, status, message, sender_id, recipient_id, winner_track_id, " +
        "sender:users!ladders_sender_id_fkey(display_name), " +
        "recipient:users!ladders_recipient_id_fkey(display_name)",
    )
    .eq("share_token", token)
    .maybeSingle<Row>();
  if (error) throw error;
  if (!l) return null;

  const [tracksRes, matchesRes] = await Promise.all([
    db
      .from("ladder_tracks")
      .select("spotify_track_id, name, artists, album_image_url, duration_ms, seed")
      .eq("ladder_id", l.id)
      .order("seed", { ascending: true, nullsFirst: false })
      .order("name"),
    db
      .from("ladder_matches")
      .select("round, slot, track_a, track_b, winner")
      .eq("ladder_id", l.id)
      .order("round")
      .order("slot"),
  ]);
  if (tracksRes.error) throw tracksRes.error;
  if (matchesRes.error) throw matchesRes.error;

  return {
    id: l.id,
    token: l.share_token,
    size: l.size,
    status: l.status,
    message: l.message,
    senderId: l.sender_id,
    senderName: l.sender?.display_name ?? l.sender_id,
    recipientId: l.recipient_id,
    recipientName: l.recipient
      ? (l.recipient.display_name ?? l.recipient_id)
      : null,
    winnerTrackId: l.winner_track_id,
    tracks: tracksRes.data.map((t) => ({
      id: t.spotify_track_id,
      name: t.name,
      artists: t.artists,
      image: t.album_image_url,
      durationMs: t.duration_ms,
    })),
    matches: matchesRes.data.map((m) => ({
      round: m.round,
      slot: m.slot,
      trackA: m.track_a,
      trackB: m.track_b,
      winner: m.winner,
    })),
  };
}
