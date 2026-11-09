"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CopyLink from "@/components/CopyLink";
import Bracket from "./Bracket";
import PlayerBar from "@/components/PlayerBar";
import { usePlayer, type PlayerNotice } from "@/components/usePlayer";
import { nextMatch, roundCount, roundName, type LadderState } from "@/lib/ladder";
import type { TrackSummary } from "@/lib/tracks";

type Props = { initial: LadderState; userId: string };

type Player = ReturnType<typeof usePlayer>;

export default function LadderPlay({ initial, userId }: Props) {
  const [state, setState] = useState(initial);
  const player = usePlayer();
  const byId = useMemo(
    () => new Map(state.tracks.map((t) => [t.id, t])),
    [state.tracks],
  );
  const trackId = player.status.trackId;

  // Stop the music whenever the view changes: start, every pick, undo,
  // and the winner screen.
  const decided = state.matches.filter((m) => m.winner).length;
  const viewKey = `${state.status}:${decided}`;
  const lastViewKey = useRef(viewKey);
  const { stop } = player;
  useEffect(() => {
    if (lastViewKey.current === viewKey) return;
    lastViewKey.current = viewKey;
    stop();
  }, [viewKey, stop]);

  return (
    <>
      <LadderBody
        state={state}
        setState={setState}
        userId={userId}
        player={player}
        byId={byId}
      />
      {trackId && (
        <>
          <div style={{ height: player.status.volume !== null ? 150 : 120 }} />
          <PlayerBar
            status={player.status}
            track={byId.get(trackId)}
            onToggle={() => player.toggle(trackId)}
            onSeek={player.seek}
            onVolume={player.setVolume}
          />
        </>
      )}
    </>
  );
}

function LadderBody({
  state,
  setState,
  userId,
  player,
  byId,
}: {
  state: LadderState;
  setState: (s: LadderState) => void;
  userId: string;
  player: Player;
  byId: Map<string, TrackSummary>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      else
        setError(
          `Coś poszło nie tak. Spróbuj ponownie.${data.detail ? ` (${data.detail})` : ""}`,
        );
    } catch {
      setError("Brak połączenia. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <>
      <h1>{state.name || (isSender ? "Twoja drabinka" : `Drabinka od ${state.senderName}`)}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {state.name && (isSender ? "Twoja drabinka · " : `Od ${state.senderName} · `)}
        {state.size} piosenek
      </p>
      {state.message && <blockquote className="card">„{state.message}”</blockquote>}
    </>
  );

  const notice = player.notice && (
    <Notice notice={player.notice} onClose={player.dismissNotice} />
  );

  // --- Finished ---------------------------------------------------------
  if (state.status === "done" && state.winnerTrackId && (isPlayer || state.returnedAt)) {
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
        {isSender && !isPlayer && state.replyMessage && (
          <blockquote className="card">
            „{state.replyMessage}”
            <div className="muted small">— {state.recipientName ?? "odbiorca"}</div>
          </blockquote>
        )}
        {isPlayer && !isSender && (
          <ReturnBox
            key={state.returnedAt ?? "new"}
            senderName={state.senderName}
            returnedAt={state.returnedAt}
            replyMessage={state.replyMessage}
            busy={busy}
            onSend={(message) => post("return", { message })}
          />
        )}
        {isPlayer && (
          <div>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Rozegrać drabinkę od nowa? Obecny wynik zostanie zastąpiony nowym losowaniem.",
                  )
                )
                  post("restart");
              }}
            >
              ↻ Rozegraj ponownie
            </button>
          </div>
        )}
        {isSender && <SendCopyButton token={state.token} />}
        {error && <p className="error">{error}</p>}
        {notice}
        <h2>Przebieg drabinki</h2>
        <Bracket
          size={state.size}
          matches={state.matches}
          tracks={byId}
          winnerTrackId={state.winnerTrackId}
        />
      </div>
    );
  }

  // --- Someone else is playing / will play ------------------------------
  // The sender sees the result only once the player sends it back.
  if (state.status !== "pending" && !isPlayer) {
    const decided = state.matches.filter((m) => m.winner).length;
    const who = state.recipientName ?? "Odbiorca";
    return (
      <div className="stack">
        {header}
        <p className="muted">
          {!isSender
            ? "Tę drabinkę rozgrywa już ktoś inny."
            : state.status === "done"
              ? `${who} skończył(a) drabinkę, ale jeszcze nie odesłał(a) wyniku.`
              : `${who} rozgrywa drabinkę: ${decided} z ${state.size - 1} pojedynków. Wynik zobaczysz, gdy ${who} go odeśle.`}
        </p>
        {isSender && (
          <>
            <div className="progress">
              <div style={{ width: `${(decided / (state.size - 1)) * 100}%` }} />
            </div>
            <SendCopyButton token={state.token} />
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
            <CopyLink text={state.message} title={state.name ?? undefined} />
            <div className="row">
              <SendCopyButton token={state.token} />
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
                wide
              />
            </div>
          </div>
        ))}
      </div>
      <p className="muted small">
        Dotknij okładki lub tytułu, żeby wybrać piosenkę. Przycisk pod spodem
        tylko ją odtwarza (opcjonalnie).
      </p>
      {decided > 0 && (
        <div>
          <button className="button secondary" disabled={busy} onClick={() => post("undo")}>
            ↶ Cofnij ostatni wybór
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {notice}
      <h2>Drabinka</h2>
      <Bracket size={state.size} matches={state.matches} tracks={byId} current={match} />
    </div>
  );
}

function SendCopyButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/ladders/${token}/copy`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = `/l/${data.token}`;
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  return (
    <div>
      <button className="button secondary" disabled={busy} onClick={copy}>
        {busy ? "Tworzę kopię…" : "➕ Wyślij te piosenki komuś innemu"}
      </button>
      {error && <p className="error">Nie udało się utworzyć kopii.</p>}
    </div>
  );
}

function ReturnBox({
  senderName,
  returnedAt,
  replyMessage,
  busy,
  onSend,
}: {
  senderName: string;
  returnedAt: string | null;
  replyMessage: string | null;
  busy: boolean;
  onSend: (message: string) => void;
}) {
  const [message, setMessage] = useState(replyMessage ?? "");
  if (returnedAt) {
    return (
      <div className="card stack-sm" style={{ display: "flex", alignItems: "stretch" }}>
        <div>✉ Wynik odesłany!</div>
        {replyMessage && <div className="muted">„{replyMessage}”</div>}
        <div className="muted small">
          {senderName} zobaczy go na swojej liście drabinek. Możesz też wysłać
          link do tej strony:
        </div>
        <div>
          <CopyLink />
        </div>
      </div>
    );
  }
  return (
    <div className="card stack-sm" style={{ display: "flex", alignItems: "stretch" }}>
      <label className="stack-sm">
        <span className="label">Wiadomość dla nadawcy: {senderName} (opcjonalnie)</span>
        <textarea
          className="input"
          rows={2}
          maxLength={280}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="np. Trudny finał!"
        />
      </label>
      <div>
        <button className="button" disabled={busy} onClick={() => onSend(message)}>
          ✉ Odeślij wynik
        </button>
      </div>
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
  wide,
}: {
  playing: boolean;
  onClick: () => void;
  label?: boolean;
  wide?: boolean;
}) {
  if (wide) {
    return (
      <button className="play-wide" onClick={onClick} aria-label={playing ? "Zatrzymaj" : "Odtwórz"}>
        {playing ? "⏸ Pauza" : "▶ Odtwórz"}
      </button>
    );
  }
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
          Spotify nie zaczął grać (aplikacja Spotify jest pewnie uśpiona).{" "}
          <a href={`spotify:track:${notice.trackId}`}>Otwórz piosenkę w aplikacji Spotify</a>
          {" "}(lub{" "}
          <a
            href={`https://open.spotify.com/track/${notice.trackId}`}
            target="_blank"
            rel="noreferrer"
          >
            w przeglądarce
          </a>
          ), wróć tutaj, a kolejne piosenki będą już grały z poziomu drabinki.
        </span>
      )}
      {notice.kind === "browser_player" && (
        <span>
          Odtwarzacz w przeglądarce jeszcze się nie uruchomił. Odczekaj chwilę i kliknij ▶
          ponownie (w razie potrzeby odśwież stronę).
        </span>
      )}
      {notice.kind === "premium" && <span>Odtwarzanie wymaga Spotify Premium.</span>}
      {notice.kind === "error" && (
        <span>
          Nie udało się odtworzyć piosenki.
          {notice.detail && <span className="muted small"> ({notice.detail})</span>}
        </span>
      )}
      <button className="notice-close" onClick={onClose} aria-label="Zamknij">
        ×
      </button>
    </div>
  );
}
