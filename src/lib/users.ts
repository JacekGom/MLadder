import type { SupabaseClient } from "@supabase/supabase-js";
import { getMe } from "./spotify";

/**
 * Makes sure the users row exists. It can be missing if the user logged in
 * before Supabase was configured (or the upsert at login failed), and
 * ladders reference it via foreign keys.
 */
export async function ensureUser(
  db: SupabaseClient,
  userId: string,
  token: string,
): Promise<{ message?: string; code?: string } | null> {
  const { data: existing, error } = await db
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (error) return error;
  if (existing) return null;

  let profile: { display_name: string | null; avatar_url: string | null } = {
    display_name: null,
    avatar_url: null,
  };
  try {
    const me = await getMe(token);
    profile = { display_name: me.display_name, avatar_url: me.images?.[0]?.url ?? null };
  } catch (e) {
    console.error(e);
  }
  const { error: insertError } = await db
    .from("users")
    .upsert({ id: userId, ...profile }, { onConflict: "id", ignoreDuplicates: true });
  return insertError ?? null;
}
