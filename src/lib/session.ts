import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  /** Unix time in ms when the access token expires. */
  expiresAt?: number;
  /** CSRF state for the OAuth round trip. */
  oauthState?: string;
  /** Where to return after logging in (relative path). */
  loginNext?: string;
};

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET musi mieć co najmniej 32 znaki.");
  }
  return {
    password,
    cookieName: "mladder_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // A year; the cookie is re-saved on every token refresh, so active
      // users stay logged in and never see the Spotify login again.
      maxAge: 60 * 60 * 24 * 365,
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}
