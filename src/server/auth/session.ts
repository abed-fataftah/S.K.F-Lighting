import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "./supabase";

/** Verified token claims for normal pages and reads (checked locally, no round trip). */
export const getClaims = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return data.claims;
});

/** The user as Supabase sees it right now. Use before admin writes and money changes. */
export async function getVerifiedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
