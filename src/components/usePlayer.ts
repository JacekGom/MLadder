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
  | { kind: "browser_player" }
  | { kind: "premium" }
  | { kind: "error"; detail?: string };

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

/*
 * The in-browser player lives for the whole visit, not per page. Creating a
 * new Spotify player after the previous one was disconnected (moving from
 * one ladder to another without reloading) often never became ready, so
 * playback only worked after a refresh.
 */
type SdkListener = { onState(s: SdkState | null): void; onReady(): void };
const sdk: {
  player: SdkPlayer | null;
  deviceId: string | null;
  /** "loading" until Spotify registers this tab as a device. */
  state: "off" | "loading" | "ready" | "failed";
  listeners: Set<SdkListener>;
} = { player: null, deviceId: null, state: "off", listeners: new Set() };

function ensureSdk() {
  if (sdk.state !== "off") return;
  sdk.state = "loading";

  const init = () => {
    if (!window.Spotify || sdk.player) return;
    const player = new window.Spotify.Player({
      name: "Drabinka muzyczna",
      getOAuthToken: (cb) => {
        fetchToken().then(cb).catch(() => {});
      },
      volume: 0.8,
    });
    player.addListener("ready", (({ device_id }: { device_id: string }) => {
      sdk.deviceId = device_id;
      sdk.state = "ready";
      sdk.listeners.forEach((l) => l.onReady());
    }) as (arg: never) => void);
    player.addListener("not_ready", (() => {
      sdk.deviceId = null;
      sdk.state = "loading";
    }) as (arg: never) => void);
    player.addListener("player_state_changed", ((s: SdkState | null) =>
      sdk.listeners.forEach((l) => l.onState(s))) as (arg: never) => void);
    // Fall back to Spotify Connect if the in-browser player can't start.
    for (const ev of ["initialization_error", "authentication_error", "account_error"]) {
      player.addListener(ev, (() => {
        sdk.deviceId = null;
        sdk.player = null;
        sdk.state = "failed";
      }) as (arg: never) => void);
    }
    sdk.player = player;
    player.connect();
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
      s.onerror = () => {
        sdk.state = "failed";
      };
      document.body.appendChild(s);
    }
  }
}

export function usePlayer() {
  const [status, setStatus] = useState<PlaybackStatus>(IDLE);
  const [notice, setNotice] = useState<PlayerNotice | null>(null);
  const requestedRef = useRef<string | null>(null);
  // Ignore polled positions for a moment after a seek so the slider
  // doesn't jump back.
  const seekLockRef = useRef(0);

  const sdkActive = () => !!sdk.player && !!sdk.deviceId;

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
    const readVolume = () =>
      sdk.player
        ?.getVolume()
        .then((v) => setStatus((prev) => ({ ...prev, volume: Math.round(v * 100) })))
        .catch(() => {});
    const listener: SdkListener = { onState: applySdkState, onReady: readVolume };
    sdk.listeners.add(listener);
    ensureSdk();
    if (sdk.state === "ready") readVolume();
    return () => {
      sdk.listeners.delete(listener);
      // Leaving the page: don't keep playing this ladder's song.
      if (requestedRef.current && sdkActive()) sdk.player!.pause().catch(() => {});
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
        applySdkState(await sdk.player!.getCurrentState().catch(() => null));
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

  /**
   * Spotify accepts a play command even when the phone app is asleep and
   * then nothing happens. If after a few seconds nothing is playing, offer
   * to open the song in the Spotify app. The player bar stays, so once the
   * song is started there, the slider follows it. (We don't compare track
   * ids: Spotify may report a relinked id for the same song.)
   */
  const verifyRemote = useCallback((trackId: string) => {
    const check = async (attempt: number) => {
      if (requestedRef.current !== trackId) return;
      const res = await fetch("/api/spotify/state", { cache: "no-store" }).catch(() => null);
      const s = res?.ok ? await res.json() : null;
      if (s?.active && s.isPlaying) return;
      if (attempt < 2) setTimeout(() => check(attempt + 1), 3000);
      else if (requestedRef.current === trackId) setNotice({ kind: "open_app", trackId });
    };
    setTimeout(() => check(1), 3000);
  }, []);

  /**
   * On desktop, waits until the in-browser player is registered with
   * Spotify. Without this, a click right after the page opens (e.g. on the
   * winner of a finished ladder) had no device id yet and the song went to
   * another Spotify device, such as the user's sleeping phone.
   */
  const waitForSdk = useCallback(async () => {
    const until = Date.now() + 10000;
    while (sdk.state === "loading" && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 200));
    }
    return sdk.deviceId;
  }, []);

  const play = useCallback(async (trackId: string) => {
    setNotice(null);
    // Must run inside the click for browsers' autoplay rules.
    await sdk.player?.activateElement().catch(() => {});
    const desktop = sdk.state !== "off" && sdk.state !== "failed";
    const deviceId = desktop ? await waitForSdk() : null;
    if (desktop && !deviceId) {
      setNotice({ kind: "browser_player" });
      return;
    }
    const send = () =>
      fetch("/api/spotify/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, deviceId: deviceId ?? undefined }),
      });
    let res = await send();
    // A freshly registered browser player can be unknown to Spotify for a
    // few seconds (404 → no_device). Retry instead of giving up.
    for (let i = 0; deviceId && res.status === 409 && i < 4; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      res = await send();
    }
    if (res.ok) {
      requestedRef.current = trackId;
      setStatus((prev) => ({ ...prev, trackId, paused: false, positionMs: 0 }));
      if (!sdkActive()) verifyRemote(trackId);
      return;
    }
    const { error, detail } = await res.json().catch(() => ({ error: "error" }));
    if (error === "no_device" && deviceId) setNotice({ kind: "browser_player" });
    else if (error === "no_device") {
      // Phone: keep the player bar so that once the song is opened in the
      // Spotify app (link in the notice), the slider follows it.
      requestedRef.current = trackId;
      setStatus((prev) => ({ ...prev, trackId, paused: true, positionMs: 0 }));
      setNotice({ kind: "open_app", trackId });
    }
    else if (error === "premium_required") setNotice({ kind: "premium" });
    else setNotice({ kind: "error", detail });
  }, [verifyRemote, waitForSdk]);

  const pause = useCallback(async () => {
    setStatus((prev) => ({ ...prev, paused: true }));
    if (sdkActive()) await sdk.player!.pause().catch(() => {});
    else await fetch("/api/spotify/pause", { method: "POST" }).catch(() => {});
  }, []);

  const resume = useCallback(async () => {
    setStatus((prev) => ({ ...prev, paused: false }));
    if (sdkActive()) await sdk.player!.resume().catch(() => {});
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
    if (sdkActive()) await sdk.player!.seek(ms).catch(() => {});
    else await control("seek", ms);
  }, []);

  /** Stops playback and hides the player (used whenever the view changes). */
  const stop = useCallback(async () => {
    if (!requestedRef.current) return;
    requestedRef.current = null;
    setStatus((prev) => ({ ...IDLE, volume: prev.volume }));
    if (sdkActive()) await sdk.player!.pause().catch(() => {});
    else await fetch("/api/spotify/pause", { method: "POST" }).catch(() => {});
  }, []);

  const setVolume = useCallback(async (percent: number) => {
    setStatus((prev) => ({ ...prev, volume: percent }));
    if (sdkActive()) await sdk.player!.setVolume(percent / 100).catch(() => {});
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
    stop,
    seek,
    setVolume,
  };
}
