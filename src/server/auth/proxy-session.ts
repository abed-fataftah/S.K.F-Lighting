import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

type PendingCookie = {
  name: string;
  value: string;
  options: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Refreshes the Supabase session before routing. Updated cookies are written onto
 * the request (so pages in this same request see the fresh token) and returned
 * so the caller can set them on whatever response it builds.
 */
export async function refreshSession(request: NextRequest) {
  const { url, anonKey } = supabaseEnv();
  const pending: PendingCookie[] = [];
  const headers: Record<string, string> = {};

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          pending.push({ name, value, options });
        }
        Object.assign(headers, cacheHeaders);
      },
    },
  });

  // Do not run code between createServerClient and getClaims (Supabase SSR guidance).
  await supabase.auth.getClaims();

  return function applyTo(response: NextResponse) {
    for (const { name, value, options } of pending) response.cookies.set(name, value, options);
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  };
}
