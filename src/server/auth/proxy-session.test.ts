import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshSession } from "./proxy-session";

type Cookie = { name: string; value: string; options?: Record<string, unknown> };
type CookieMethods = {
  getAll(): Cookie[];
  setAll(cookies: Cookie[], headers?: Record<string, string>): void;
};

// Supabase is the boundary: each test decides what happens inside getClaims (refresh or not).
const supabase = vi.hoisted(() => ({
  onGetClaims: (() => {}) as (cookies: CookieMethods) => void,
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: CookieMethods }) => ({
    auth: {
      getClaims: supabase.getClaims.mockImplementation(async () => {
        supabase.onGetClaims(options.cookies);
        return { data: null, error: null };
      }),
    },
  }),
}));

const refreshed: Cookie = {
  name: "sb-127-auth-token",
  value: "fresh-token",
  options: { httpOnly: true, path: "/", sameSite: "lax" },
};
const noStore = { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0" };

describe("refreshSession", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    supabase.onGetClaims = () => {};
    supabase.getClaims.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hands the incoming cookies to Supabase so it can read the current session", async () => {
    let seen: Cookie[] = [];
    supabase.onGetClaims = (cookies) => {
      seen = cookies.getAll();
    };
    const request = new NextRequest("http://localhost/", {
      headers: { cookie: "sb-127-auth-token=old" },
    });

    await refreshSession(request);

    expect(seen).toContainEqual(
      expect.objectContaining({ name: "sb-127-auth-token", value: "old" }),
    );
  });

  it("checks the session exactly once per request", async () => {
    await refreshSession(new NextRequest("http://localhost/"));

    expect(supabase.getClaims).toHaveBeenCalledTimes(1);
  });

  it("writes a refreshed token onto the request so pages in the same request see it", async () => {
    supabase.onGetClaims = (cookies) => cookies.setAll([refreshed], noStore);
    const request = new NextRequest("http://localhost/", {
      headers: { cookie: "sb-127-auth-token=old" },
    });

    await refreshSession(request);

    expect(request.cookies.get("sb-127-auth-token")?.value).toBe("fresh-token");
  });

  it("sets the refreshed cookie, with its options, on the response it is given", async () => {
    supabase.onGetClaims = (cookies) => cookies.setAll([refreshed], noStore);
    const applyTo = await refreshSession(new NextRequest("http://localhost/"));

    const response = applyTo(NextResponse.next());

    expect(response.cookies.get("sb-127-auth-token")).toMatchObject({
      value: "fresh-token",
      httpOnly: true,
      path: "/",
    });
  });

  it("adds Supabase's no-store cache headers so a shared cache never keeps a session cookie", async () => {
    supabase.onGetClaims = (cookies) => cookies.setAll([refreshed], noStore);
    const applyTo = await refreshSession(new NextRequest("http://localhost/"));

    const response = applyTo(NextResponse.next());

    expect(response.headers.get("cache-control")).toBe(noStore["Cache-Control"]);
  });

  it("keeps the refreshed cookie on a redirect response too", async () => {
    supabase.onGetClaims = (cookies) => cookies.setAll([refreshed], noStore);
    const applyTo = await refreshSession(new NextRequest("http://localhost/ar"));

    const response = applyTo(NextResponse.redirect("http://localhost/", 307));

    expect(response.status).toBe(307);
    expect(response.cookies.get("sb-127-auth-token")?.value).toBe("fresh-token");
  });

  it("leaves the response untouched when the session needs no refresh", async () => {
    const applyTo = await refreshSession(new NextRequest("http://localhost/"));

    const response = applyTo(NextResponse.next());

    expect(response.cookies.getAll()).toEqual([]);
    expect(response.headers.get("cache-control")).toBeNull();
  });

  it("fails loudly when Supabase settings are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);

    await expect(refreshSession(new NextRequest("http://localhost/"))).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });
});
