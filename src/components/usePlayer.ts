"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Playback for duels.
 * - Desktop: Spotify Web Playback SDK turns this tab into a Spotify device.
 * - Phones (the SDK doesn't support mobile browsers) or if the SDK fails:
 *   Spotify Connect, i.e. we ask Spotify to play on the user's active
 *   device, typically the Spotify app on the same phone. If nothing is
 *   active, we show a link that opens the song in the Spotify app.
 */

type SdkPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  activateElement(): Promise<void>;
  pause(): Promise<void>;
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

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function fetchToken(): Promise<string> {
  const res = await fetch("/api/spotify/token", { cache: "no-store" });
  if (!res.ok) throw new Error("token");
  return (await res.json()).token;
}

export function usePlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<PlayerNotice | null>(null);
  const playerRef = useRef<SdkPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);

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
      }) as (arg: never) => void);
      player.addListener("not_ready", (() => {
        deviceIdRef.current = null;
      }) as (arg: never) => void);
      player.addListener("player_state_changed", ((
        state: { paused: boolean; track_window: { current_track: { id: string } | null } } | null,
      ) => {
        const id = state?.track_window.current_track?.id ?? null;
        setPlayingId(state && !state.paused ? id : null);
      }) as (arg: never) => void);
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
  }, []);

  const play = useCallback(async (trackId: string) => {
    setNotice(null);
    // Must run inside the click for browsers' autoplay rules.
    const activation = playerRef.current?.activateElement().catch(() => {});
    await activation;
    const res = await fetch("/api/spotify/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId, deviceId: deviceIdRef.current ?? undefined }),
    });
    if (res.ok) {
      setPlayingId(trackId);
      return;
    }
    const { error } = await res.json().catch(() => ({ error: "error" }));
    if (error === "no_device") setNotice({ kind: "open_app", trackId });
    else if (error === "premium_required") setNotice({ kind: "premium" });
    else setNotice({ kind: "error" });
  }, []);

  const pause = useCallback(async () => {
    setPlayingId(null);
    if (playerRef.current && deviceIdRef.current) {
      await playerRef.current.pause().catch(() => {});
    } else {
      await fetch("/api/spotify/pause", { method: "POST" }).catch(() => {});
    }
  }, []);

  const toggle = useCallback(
    (trackId: string) => (playingId === trackId ? pause() : play(trackId)),
    [playingId, pause, play],
  );

  return { playingId, notice, dismissNotice: () => setNotice(null), toggle, pause };
}
