"use client";

import { useMemo, useState } from "react";
import CopyLink from "@/components/CopyLink";
import Bracket from "./Bracket";
import { usePlayer, type PlayerNotice } from "@/components/usePlayer";
import { nextMatch, roundCount, roundName, type LadderState } from "@/lib/ladder";
import type { TrackSummary } from "@/lib/tracks";

type Props = { initial: LadderState; userId: string };

export default function LadderPlay({ initial, userId }: Props) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = usePlayer();

  const byId = useMemo(
    () => new Map(state.tracks.map((t) => [t.id, t])),
    [state.tracks],
  );
  const isSender = state.senderId === userId;
  const isPlayer = state.recipientId === userId;

  async function post(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ladders/${state.token}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401) {
        window.location.href = `/api/auth/login?next=/l/${state.token}`;
        return;
      }
      const data = await res.json();
      if (res.ok) setState(data);
      else if (data.state) setState(data.state);
      else if (data.error === "taken") window.location.reload();
      else setError("Coś poszło nie tak. Spróbuj ponownie.");
    } catch {
      setError("Brak połączenia. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <>
      <h1>
        {isSender ? "Twoja drabinka" : `Drabinka od ${state.senderName}`} ·{" "}
        {state.size} piosenek
      </h1>
      {state.message && <blockquote className="card">„{state.message}”</blockquote>}
    </>
  );

  const notice = player.notice && (
    <Notice notice={player.notice} onClose={player.dismissNotice} />
  );

  // --- Finished ---------------------------------------------------------
  if (state.status === "done" && state.winnerTrackId) {
    const winner = byId.get(state.winnerTrackId);
    return (
      <div className="stack">
        {header}
        <p className="muted">
          {isPlayer
            ? "Gotowe! Twój zwycięzca:"
            : `${state.recipientName ?? "Odbiorca"} wybrał(a) zwycięzcę:`}
        </p>
        {winner && (
          <div className="winner">
            {winner.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={winner.image} alt="" />
            )}
            <div className="track-name">{winner.name}</div>
            <div className="muted">{winner.artists}</div>
            <PlayButton
              playing={player.playingId === winner.id}
              onClick={() => player.toggle(winner.id)}
              label
            />
          </div>
        )}
        {notice}
        <h2>Przebieg drabinki</h2>
        <Bracket size={state.size} matches={state.matches} tracks={byId} />
      </div>
    );
  }

  // --- Someone else is playing / will play ------------------------------
  if (state.status !== "pending" && !isPlayer) {
    const decided = state.matches.filter((m) => m.winner).length;
    return (
      <div className="stack">
        {header}
        <p className="muted">
          {isSender
            ? `${state.recipientName ?? "Odbiorca"} rozgrywa drabinkę: ${decided} z ${state.size - 1} pojedynków.`
            : "Tę drabinkę rozgrywa już ktoś inny."}
        </p>
        {isSender && (
          <>
            <div className="progress">
              <div style={{ width: `${(decided / (state.size - 1)) * 100}%` }} />
            </div>
            <Bracket size={state.size} matches={state.matches} tracks={byId} />
          </>
        )}
      </div>
    );
  }

  // --- Not started yet: intro with the song list -------------------------
  if (state.status === "pending") {
    return (
      <div className="stack">
        {header}
        {isSender ? (
          <>
            <p className="muted">
              Wyślij link do tej strony osobie, która ma rozstrzygnąć drabinkę.
            </p>
            <div className="row">
              <CopyLink />
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => post("start")}
              >
                Rozegraj samemu (test)
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Posłuchaj piosenek, jeśli chcesz, a potem zacznij. Piosenki
              zostaną losowo rozstawione w drabince, a Ty w każdym pojedynku
              wybierasz lepszą, aż zostanie jedna.
            </p>
            <div>
              <button className="button" disabled={busy} onClick={() => post("start")}>
                {busy ? "Losuję…" : "Zaczynamy"}
              </button>
            </div>
          </>
        )}
        {error && <p className="error">{error}</p>}
        {notice}
        <ul className="tracks">
          {state.tracks.map((t) => (
            <li key={t.id} className="track">
              <Cover track={t} />
              <span className="track-text">
                <span className="track-name">{t.name}</span>
                <span className="muted">{t.artists}</span>
              </span>
              <PlayButton
                playing={player.playingId === t.id}
                onClick={() => player.toggle(t.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // --- Duels --------------------------------------------------------------
  const match = nextMatch(state.matches);
  if (!match) {
    // Shouldn't happen (done is handled above); resync.
    return (
      <div className="stack">
        {header}
        <button className="button" onClick={() => window.location.reload()}>
          Odśwież
        </button>
      </div>
    );
  }
  const decided = state.matches.filter((m) => m.winner).length;
  const inRound = state.size / 2 ** (match.round + 1);
  const a = byId.get(match.trackA)!;
  const b = byId.get(match.trackB)!;

  return (
    <div className="stack">
      <div>
        <div className="label">
          {roundName(match.round, state.size)}
          {inRound > 1 && ` · pojedynek ${match.slot + 1} z ${inRound}`}
          {" · "}runda {match.round + 1} z {roundCount(state.size)}
        </div>
        <div className="progress">
          <div style={{ width: `${(decided / (state.size - 1)) * 100}%` }} />
        </div>
      </div>
      <h2 className="duel-title">Która lepsza?</h2>
      <div className="duel" key={`${match.round}-${match.slot}`}>
        {[a, b].map((t, i) => (
          <div key={t.id} className="duel-side">
            {i === 1 && <div className="vs">vs</div>}
            <div className="duel-card">
              <button
                className="duel-pick"
                disabled={busy}
                onClick={() =>
                  post("vote", { round: match.round, slot: match.slot, winner: t.id })
                }
              >
                <Cover track={t} />
                <span className="track-text">
                  <span className="track-name">{t.name}</span>
                  <span className="muted">{t.artists}</span>
                </span>
              </button>
              <PlayButton
                playing={player.playingId === t.id}
                onClick={() => player.toggle(t.id)}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="muted small">Dotknij piosenki, żeby ją wybrać. ▶ odtwarza ją (opcjonalnie).</p>
      {error && <p className="error">{error}</p>}
      {notice}
      {decided > 0 && (
        <details>
          <summary className="muted">Pokaż drabinkę</summary>
          <Bracket size={state.size} matches={state.matches} tracks={byId} />
        </details>
      )}
    </div>
  );
}

function Cover({ track }: { track: TrackSummary }) {
  return track.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="cover" src={track.image} alt="" />
  ) : (
    <span className="cover cover-placeholder" />
  );
}

function PlayButton({
  playing,
  onClick,
  label,
}: {
  playing: boolean;
  onClick: () => void;
  label?: boolean;
}) {
  return (
    <button
      className={label ? "button secondary" : "play"}
      onClick={onClick}
      aria-label={playing ? "Zatrzymaj" : "Odtwórz"}
    >
      {playing ? "⏸" : "▶"}
      {label && (playing ? " Zatrzymaj" : " Odtwórz")}
    </button>
  );
}

function Notice({ notice, onClose }: { notice: PlayerNotice; onClose: () => void }) {
  return (
    <div className="notice">
      {notice.kind === "open_app" && (
        <span>
          Nie widzę aktywnego odtwarzacza Spotify.{" "}
          <a
            href={`https://open.spotify.com/track/${notice.trackId}`}
            target="_blank"
            rel="noreferrer"
          >
            Otwórz piosenkę w Spotify
          </a>
          , a kolejne będą już grały w aplikacji.
        </span>
      )}
      {notice.kind === "premium" && <span>Odtwarzanie wymaga Spotify Premium.</span>}
      {notice.kind === "error" && <span>Nie udało się odtworzyć piosenki.</span>}
      <button className="notice-close" onClick={onClose} aria-label="Zamknij">
        ×
      </button>
    </div>
  );
}
