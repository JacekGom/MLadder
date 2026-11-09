import { roundCount, roundName, type Match } from "@/lib/ladder";
import type { TrackSummary } from "@/lib/tracks";

type Props = {
  size: number;
  matches: Match[];
  tracks: Map<string, TrackSummary>;
  winnerTrackId?: string | null;
  /** The duel being played right now, highlighted in the tree. */
  current?: { round: number; slot: number } | null;
};

/**
 * Classic tournament tree: one column per round, connector lines between
 * pairs. Every column has the same height and its duels sit in equal-height
 * cells, so a pair's midpoint lines up with the next round's duel. Scrolls
 * sideways inside its own box on narrow screens.
 */
export default function Bracket({ size, matches, tracks, winnerTrackId, current }: Props) {
  const rounds = roundCount(size);
  const byKey = new Map(matches.map((m) => [`${m.round}-${m.slot}`, m]));
  const winner = winnerTrackId ? tracks.get(winnerTrackId) : undefined;

  return (
    <div className="bracket-scroll">
      <div className="bracket-tree">
        {Array.from({ length: rounds }, (_, round) => {
          const slots = size / 2 ** (round + 1);
          const last = round === rounds - 1;
          // Group duels in pairs that feed one duel of the next round.
          const pairs = last
            ? [[0]]
            : Array.from({ length: slots / 2 }, (_, p) => [2 * p, 2 * p + 1]);
          return (
            <div key={round} className="round-col">
              <div className="round-label">{roundName(round, size)}</div>
              <div className="round-body">
                {pairs.map((pair) => (
                  <div key={pair[0]} className={`pair${last ? " last" : ""}`}>
                    {pair.map((slot) => {
                      const m = byKey.get(`${round}-${slot}`);
                      const isCurrent = current?.round === round && current.slot === slot;
                      return (
                        <div key={slot} className="cell">
                          <div className={`bmatch${isCurrent ? " current" : ""}`}>
                            <Side track={m && tracks.get(m.trackA)} state={sideState(m, m?.trackA)} />
                            <Side track={m && tracks.get(m.trackB)} state={sideState(m, m?.trackB)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="round-col winner-col">
          <div className="round-label">Zwycięzca</div>
          <div className="round-body">
            <div className="cell">
              <div className="bmatch">
                <Side track={winner} state={winner ? "won" : "tbd"} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type SideState = "won" | "lost" | "open" | "tbd";

function sideState(m: Match | undefined, id: string | undefined): SideState {
  if (!m || !id) return "tbd";
  if (!m.winner) return "open";
  return m.winner === id ? "won" : "lost";
}

function Side({ track, state }: { track?: TrackSummary; state: SideState }) {
  if (state === "tbd" || !track) {
    return <div className="bside tbd">?</div>;
  }
  return (
    <div className={`bside ${state}`} title={`${track.name} · ${track.artists}`}>
      {track.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.image} alt="" />
      ) : (
        <span className="cover-placeholder" />
      )}
      <span className="bside-name">{track.name}</span>
    </div>
  );
}
