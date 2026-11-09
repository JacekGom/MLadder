"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Playback for ladders.
 * - Desktop: Spotify Web Playback SDK turns this tab into a Spotify device.
 * - Phones (the SDK doesn't support mobile browsers) or if the SDK fails:
 *   Spotify Connect, i.e. we ask Spotify to play on the user's active
 *   device, typically the Spotify app on the same phone. If nothing is
 *   active, we show a link that opens the song in the Spotify app.
 *
 * Which song is "ours" is tracked by the id we asked for, not the id
 * Spotify reports: Spotify may relink a track to another id (a different
 * release of the same song in the user's market), which used to leave the
 * play button stuck on ▶ for those songs.
 */

type SdkState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: { id: string | null; linked_from?: { id: string | null } } | null;
  };
};

type SdkPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  activateElement(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(v: number): Promise<void>;
  getVolume(): Promise<number>;
  getCurrentState(): Promise<SdkState | null>;
  addListener(event: string, cb: (arg: never) => void): void;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SdkPlayer;
    };
  }
}

export type PlayerNotice =
  | { kind: "open_app"; trackId: string }
  | { kind: "premium" }
  | { kind: "error" };

export type PlaybackStatus = {
  /** The song we asked Spotify to play (stays set while paused). */
  trackId: string | null;
  paused: boolean;
  positionMs: number;
  durationMs: number;
  /** 0-100, or null when the device doesn't allow remote volume. */
  volume: number | null;
};

const IDLE: PlaybackStatus = {
  trackId: null,
  paused: true,
  positionMs: 0,
  durationMs: 0,
  volume: null,
};

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function fetchToken(): Promise<string> {
  const res = await fetch("/api/spotify/token", { cache: "no-store" });
  if (!res.ok) throw new Error("token");
  return (await res.json()).token;
}

function control(action: "seek" | "volume" | "resume", value?: number) {
  return fetch("/api/spotify/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, value }),
  }).catch(() => null);
}

export function usePlayer() {
  const [status, setStatus] = useState<PlaybackStatus>(IDLE);
  const [notice, setNotice] = useState<PlayerNotice | null>(null);
  const playerRef = useRef<SdkPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const requestedRef = useRef<string | null>(null);
  // Ignore polled positions for a moment after a seek so the slider
  // doesn't jump back.
  const seekLockRef = useRef(0);

  const sdkActive = () => !!playerRef.current && !!deviceIdRef.current;

  const applySdkState = useCallback((s: SdkState | null) => {
    if (!s || !requestedRef.current) return;
    setStatus((prev) => ({
      ...prev,
      trackId: requestedRef.current,
      paused: s.paused,
      positionMs: Date.now() < seekLockRef.current ? prev.positionMs : s.position,
      durationMs: s.duration,
    }));
  }, []);

  // In-browser player (desktop only).
  useEffect(() => {
    if (isMobile()) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.Spotify) return;
      const player = new window.Spotify.Player({
        name: "Drabinka muzyczna",
        getOAuthToken: (cb) => {
          fetchToken().then(cb).catch(() => {});
        },
        volume: 0.8,
      });
      player.addListener("ready", (({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id;
        player.getVolume().then((v) =>
          setStatus((prev) => ({ ...prev, volume: Math.round(v * 100) })),
        );
      }) as (arg: never) => void);
      player.addListener("not_ready", (() => {
        deviceIdRef.current = null;
      }) as (arg: never) => void);
      player.addListener("player_state_changed", ((s: SdkState | null) =>
        applySdkState(s)) as (arg: never) => void);
      // Fall back to Spotify Connect if the in-browser player can't start.
      for (const ev of ["initialization_error", "authentication_error", "account_error"]) {
        player.addListener(ev, (() => {
          deviceIdRef.current = null;
          playerRef.current = null;
        }) as (arg: never) => void);
      }
      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify) {
      init();
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
      if (!document.getElementById("spotify-sdk")) {
        const s = document.createElement("script");
        s.id = "spotify-sdk";
        s.src = "https://sdk.scdn.co/spotify-player.js";
        s.async = true;
        document.body.appendChild(s);
      }
    }

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
      deviceIdRef.current = null;
    };
  }, [applySdkState]);

  // Keep the time slider moving while something is playing.
  const active = status.trackId !== null;
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (sdkActive()) {
        applySdkState(await playerRef.current!.getCurrentState().catch(() => null));
      } else {
        const res = await fetch("/api/spotify/state", { cache: "no-store" }).catch(() => null);
        const s = res?.ok ? await res.json() : null;
        if (s?.active && !stopped) {
          setStatus((prev) => ({
            ...prev,
            paused: !s.isPlaying,
            positionMs: Date.now() < seekLockRef.current ? prev.positionMs : s.positionMs,
            durationMs: s.durationMs || prev.durationMs,
            volume: s.supportsVolume ? s.volume : null,
          }));
        }
      }
    };
    tick();
    const id = setInterval(tick, sdkActive() ? 500 : 1000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active, applySdkState]);

  const play = useCallback(async (trackId: string) => {
    setNotice(null);
    // Must run inside the click for browsers' autoplay rules.
    await playerRef.current?.activateElement().catch(() => {});
    const res = await fetch("/api/spotify/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId, deviceId: deviceIdRef.current ?? undefined }),
    });
    if (res.ok) {
      requestedRef.current = trackId;
      setStatus((prev) => ({ ...prev, trackId, paused: false, positionMs: 0 }));
      return;
    }
    const { error } = await res.json().catch(() => ({ error: "error" }));
    if (error === "no_device") setNotice({ kind: "open_app", trackId });
    else if (error === "premium_required") setNotice({ kind: "premium" });
    else setNotice({ kind: "error" });
  }, []);

  const pause = useCallback(async () => {
    setStatus((prev) => ({ ...prev, paused: true }));
    if (sdkActive()) await playerRef.current!.pause().catch(() => {});
    else await fetch("/api/spotify/pause", { method: "POST" }).catch(() => {});
  }, []);

  const resume = useCallback(async () => {
    setStatus((prev) => ({ ...prev, paused: false }));
    if (sdkActive()) await playerRef.current!.resume().catch(() => {});
    else await control("resume");
  }, []);

  const toggle = useCallback(
    (trackId: string) => {
      if (status.trackId === trackId) return status.paused ? resume() : pause();
      return play(trackId);
    },
    [status.trackId, status.paused, pause, resume, play],
  );

  const seek = useCallback(async (ms: number) => {
    seekLockRef.current = Date.now() + 1500;
    setStatus((prev) => ({ ...prev, positionMs: ms }));
    if (sdkActive()) await playerRef.current!.seek(ms).catch(() => {});
    else await control("seek", ms);
  }, []);

  const setVolume = useCallback(async (percent: number) => {
    setStatus((prev) => ({ ...prev, volume: percent }));
    if (sdkActive()) await playerRef.current!.setVolume(percent / 100).catch(() => {});
    else await control("volume", percent);
  }, []);

  return {
    status,
    /** Id of the song currently playing (not paused), for ▶/⏸ buttons. */
    playingId: status.paused ? null : status.trackId,
    notice,
    dismissNotice: () => setNotice(null),
    toggle,
    pause,
    seek,
    setVolume,
  };
}
