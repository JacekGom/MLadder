import type { SessionData } from "./session";

const ACCOUNTS = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";

/**
 * Scopes requested up front so users only consent once:
 * profile, top tracks for the song picker, and playback control
 * (Web Playback SDK on desktop, Spotify Connect on phones).
 */
export const SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-top-read",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
];

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Brak zmiennej środowiskowej ${name}.`);
  return value;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env("SPOTIFY_CLIENT_ID"),
    scope: SCOPES.join(" "),
    redirect_uri: env("SPOTIFY_REDIRECT_URI"),
    state,
  });
  return `${ACCOUNTS}/authorize?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const basic = Buffer.from(
    `${env("SPOTIFY_CLIENT_ID")}:${env("SPOTIFY_CLIENT_SECRET")}`,
  ).toString("base64");
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Spotify token error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export function exchangeCode(code: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env("SPOTIFY_REDIRECT_URI"),
    }),
  );
}

function refresh(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

export function applyTokens(session: SessionData, tokens: TokenResponse) {
  session.accessToken = tokens.access_token;
  // Spotify may or may not rotate the refresh token.
  if (tokens.refresh_token) session.refreshToken = tokens.refresh_token;
  // Refresh a minute early to avoid racing the expiry.
  session.expiresAt = Date.now() + (tokens.expires_in - 60) * 1000;
}

/**
 * Returns a usable access token, refreshing it if needed.
 * Mutates the session; the caller must `session.save()` when this is
 * called from a route handler or server action (cookies are read-only
 * while rendering a page).
 */
export async function ensureAccessToken(
  session: SessionData,
): Promise<{ token: string; refreshed: boolean } | null> {
  if (!session.accessToken || !session.refreshToken) return null;
  if (session.expiresAt && Date.now() < session.expiresAt) {
    return { token: session.accessToken, refreshed: false };
  }
  applyTokens(session, await refresh(session.refreshToken));
  return { token: session.accessToken!, refreshed: true };
}

export type SpotifyUser = {
  id: string;
  display_name: string | null;
  email?: string;
  product?: string;
  images?: { url: string }[];
};

export async function spotifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Spotify API ${path} ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export const getMe = (token: string) => spotifyGet<SpotifyUser>("/me", token);
