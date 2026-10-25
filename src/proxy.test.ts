import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

type CookieMethods = {
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
};

// Supabase is the only boundary mocked; next-intl locale routing runs for real.
const supabase = vi.hoisted(() => ({ refresh: false }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: CookieMethods }) => ({
    auth: {
      getClaims: async () => {
        if (supabase.refresh)
          options.cookies.setAll([{ name: "sb-auth", value: "fresh", options: { path: "/" } }]);
        return { data: null, error: null };
      },
    },
  }),
}));

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} });
}

function rewrittenTo(response: Response) {
  const target = response.headers.get("x-middleware-rewrite");
  return target ? new URL(target).pathname : null;
}

function redirectedTo(response: Response) {
  const target = response.headers.get("location");
  return target ? new URL(target).pathname : null;
}

describe("proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    supabase.refresh = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // covers: DW-2 (verify.md UI steps)
  describe("storefront locale routing", () => {
    it("serves Arabic at / without a prefix", async () => {
      const response = await proxy(request("/"));

      expect(redirectedTo(response)).toBeNull();
      expect(rewrittenTo(response)).toBe("/ar");
    });

    it("redirects /ar to / because Arabic has no prefix", async () => {
      const response = await proxy(request("/ar"));

      expect(response.status).toBe(307);
      expect(redirectedTo(response)).toBe("/");
    });

    it("treats /en as an ordinary Arabic path, since there is no English site", async () => {
      const response = await proxy(request("/en"));

      expect(redirectedTo(response)).toBeNull();
      expect(rewrittenTo(response)).toBe("/ar/en");
    });

    it("keeps an English language browser on Arabic at /", async () => {
      const response = await proxy(
        new NextRequest("http://localhost/", { headers: { "accept-language": "en-US,en;q=0.9" } }),
      );

      expect(redirectedTo(response)).toBeNull();
      expect(rewrittenTo(response)).toBe("/ar");
    });

    it("ignores a NEXT_LOCALE=en cookie left over from the old English site", async () => {
      const response = await proxy(request("/", "NEXT_LOCALE=en"));

      expect(redirectedTo(response)).toBeNull();
      expect(rewrittenTo(response)).toBe("/ar");
    });

    it("sets no language cookie", async () => {
      const response = await proxy(request("/"));

      expect(response.cookies.get("NEXT_LOCALE")).toBeUndefined();
    });

    it.each(["/administrator", "/authors", "/design-systems"])(
      "still locale routes %s, which only starts with a reserved word",
      async (path) => {
        const response = await proxy(request(path));

        expect(rewrittenTo(response)).toBe(`/ar${path}`);
      },
    );
  });

  describe("paths outside locale routing", () => {
    it.each([
      "/admin",
      "/admin/",
      "/admin/orders/42",
      "/auth/callback",
      "/auth/confirm",
      "/design-system",
    ])("passes %s straight through, with no locale rewrite or redirect", async (path) => {
      const response = await proxy(request(path));

      expect(rewrittenTo(response)).toBeNull();
      expect(redirectedTo(response)).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    // covers: AC-1 (spec 0004), the guard's `?next=`
    it("tells the dashboard which path was asked for, over any value the browser sent", async () => {
      const response = await proxy(
        new NextRequest("http://localhost/admin/orders?page=2", {
          headers: { "x-admin-path": "//evil.com" },
        }),
      );

      expect(response.headers.get("x-middleware-request-x-admin-path")).toBe(
        "/admin/orders?page=2",
      );
    });

    it("adds no path header outside the dashboard", async () => {
      const response = await proxy(request("/auth/callback"));

      expect(response.headers.get("x-middleware-request-x-admin-path")).toBeNull();
    });
  });

  describe("session refresh", () => {
    it.each([
      ["a storefront page", "/"],
      ["a locale redirect", "/ar"],
      ["an admin page", "/admin"],
      ["an auth callback", "/auth/callback"],
    ])("sets the refreshed session cookie on %s", async (_label, path) => {
      supabase.refresh = true;

      const response = await proxy(request(path));

      expect(response.cookies.get("sb-auth")?.value).toBe("fresh");
    });

    // covers: AC-15 (spec 0010)
    it("skips the refresh on the public catalog count", async () => {
      supabase.refresh = true;

      const response = await proxy(request("/api/catalog/count?q=ثريا"));

      expect(response.cookies.get("sb-auth")).toBeUndefined();
    });
  });

  // covers: AC-15 (spec 0010)
  describe("route handlers", () => {
    it("keeps /api outside locale routing", async () => {
      const response = await proxy(request("/api/catalog/count?q=ثريا"));

      expect(rewrittenTo(response)).toBeNull();
      expect(redirectedTo(response)).toBeNull();
    });

    it("still refreshes the session on other /api paths", async () => {
      supabase.refresh = true;

      const response = await proxy(request("/api/other"));

      expect(rewrittenTo(response)).toBeNull();
      expect(response.cookies.get("sb-auth")?.value).toBe("fresh");
    });
  });
});

describe("proxy matcher", () => {
  const matches = (path: string) =>
    config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));

  it.each(["/", "/admin", "/admin/orders", "/auth/callback", "/products/lamp"])(
    "runs the proxy for %s",
    (path) => {
      expect(matches(path)).toBe(true);
    },
  );

  it.each([
    "/favicon.ico",
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/logo.svg",
    "/robots.txt",
  ])("skips %s (Next internals and static files)", (path) => {
    expect(matches(path)).toBe(false);
  });
});
