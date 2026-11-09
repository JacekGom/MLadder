"use client";

import { useState } from "react";
import type { TrackSummary } from "@/lib/tracks";
import type { PlaybackStatus } from "./usePlayer";

type Props = {
  status: PlaybackStatus;
  track: TrackSummary | undefined;
  onToggle: () => void;
  onSeek: (ms: number) => void;
  onVolume: (percent: number) => void;
};

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Slider that only sends its value when the user lets go, so dragging
 * doesn't fire dozens of Spotify API calls.
 */
function CommitSlider({
  value,
  max,
  onCommit,
  label,
}: {
  value: number;
  max: number;
  onCommit: (v: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const commit = () => {
    if (draft !== null) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      type="range"
      min={0}
      max={Math.max(1, max)}
      step={1}
      value={draft ?? Math.min(value, max)}
      aria-label={label}
      onChange={(e) => setDraft(Number(e.target.value))}
      onPointerUp={commit}
      onTouchEnd={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  );
}

export default function PlayerBar({ status, track, onToggle, onSeek, onVolume }: Props) {
  if (!status.trackId) return null;
  return (
    <div className="player-bar" role="region" aria-label="Odtwarzacz">
      <div className="player-row">
        {track?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.image} alt="" />
        ) : (
          <span className="cover-placeholder" />
        )}
        <span className="track-text">
          <span className="track-name">{track?.name ?? "…"}</span>
          <span className="muted">{track?.artists}</span>
        </span>
        <button
          className="play"
          onClick={onToggle}
          aria-label={status.paused ? "Odtwórz" : "Zatrzymaj"}
        >
          {status.paused ? "▶" : "⏸"}
        </button>
      </div>
      <div className="player-row slider-row">
        <span className="time">{fmt(status.positionMs)}</span>
        <CommitSlider
          value={status.positionMs}
          max={status.durationMs}
          onCommit={onSeek}
          label="Pozycja w utworze"
        />
        <span className="time">{fmt(status.durationMs)}</span>
      </div>
      {status.volume !== null && (
        <div className="player-row slider-row">
          <span className="time" aria-hidden>
            🔈
          </span>
          <CommitSlider value={status.volume} max={100} onCommit={onVolume} label="Głośność" />
          <span className="time" aria-hidden>
            🔊
          </span>
        </div>
      )}
    </div>
  );
}
