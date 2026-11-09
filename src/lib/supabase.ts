import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * Server-only Supabase client using the service role key.
 * Returns null when Supabase isn't configured yet, so the app can
 * still be tried locally with just Spotify credentials.
 */
export function supabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client;
  // Accept the URL with or without a trailing "/rest/v1/" (the Data API
  // settings page shows it that way); supabase-js adds that path itself.
  const url = process.env.SUPABASE_URL?.trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client =
    url && key
      ? createClient(url, key, { auth: { persistSession: false } })
      : null;
  return client;
}
