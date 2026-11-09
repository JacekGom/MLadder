import { roundCount, roundName, type Match } from "@/lib/ladder";
import type { TrackSummary } from "@/lib/tracks";

type Props = {
  size: number;
  matches: Match[];
  tracks: Map<string, TrackSummary>;
};

/** Round-by-round list of duels; works on narrow screens without scrolling. */
export default function Bracket({ size, matches, tracks }: Props) {
  const rounds = roundCount(size);
  const byKey = new Map(matches.map((m) => [`${m.round}-${m.slot}`, m]));

  return (
    <div className="bracket">
      {Array.from({ length: rounds }, (_, round) => {
        const slots = size / 2 ** (round + 1);
        return (
          <section key={round}>
            <h3 className="label">{roundName(round, size)}</h3>
            <ul>
              {Array.from({ length: slots }, (_, slot) => {
                const m = byKey.get(`${round}-${slot}`);
                return (
                  <li key={slot} className="bracket-match">
                    {m ? (
                      <>
                        <Side track={tracks.get(m.trackA)} state={sideState(m, m.trackA)} />
                        <Side track={tracks.get(m.trackB)} state={sideState(m, m.trackB)} />
                      </>
                    ) : (
                      <>
                        <Side state="tbd" />
                        <Side state="tbd" />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

type SideState = "won" | "lost" | "open" | "tbd";

function sideState(m: Match, id: string): SideState {
  if (!m.winner) return "open";
  return m.winner === id ? "won" : "lost";
}

function Side({ track, state }: { track?: TrackSummary; state: SideState }) {
  if (state === "tbd" || !track) {
    return <div className="bracket-side tbd">?</div>;
  }
  return (
    <div className={`bracket-side ${state}`}>
      {track.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.image} alt="" />
      ) : (
        <span className="cover-placeholder" />
      )}
      <span className="bracket-text">
        <span className="track-name">{track.name}</span>
        <span className="muted">{track.artists}</span>
      </span>
      {state === "won" && <span className="bracket-check" aria-label="wygrana">✓</span>}
    </div>
  );
}
