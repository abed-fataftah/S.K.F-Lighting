import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Cookie = { name: string; value: string; options?: Record<string, unknown> };
type CookieMethods = { getAll(): Cookie[]; setAll(cookies: Cookie[]): void };

vi.mock("server-only", () => ({}));

const boundary = vi.hoisted(() => ({
  store: { getAll: vi.fn(), set: vi.fn() },
  createServerClient: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => boundary.store }));
vi.mock("@supabase/ssr", () => ({ createServerClient: boundary.createServerClient }));

const { createSupabaseServerClient } = await import("./supabase");

async function cookieMethods(): Promise<CookieMethods> {
  await createSupabaseServerClient();
  return boundary.createServerClient.mock.lastCall![2].cookies;
}

describe("createSupabaseServerClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    boundary.store.getAll.mockReset().mockReturnValue([]);
    boundary.store.set.mockReset();
    boundary.createServerClient.mockReset().mockReturnValue({ auth: {} });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("connects with the public URL and anon key, never the service role key", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret");

    await createSupabaseServerClient();

    expect(boundary.createServerClient).toHaveBeenCalledWith(
      "http://127.0.0.1:54321",
      "anon-key",
      expect.anything(),
    );
    expect(JSON.stringify(boundary.createServerClient.mock.lastCall)).not.toContain(
      "service-role-secret",
    );
  });

  it("reads the session from the request's cookies", async () => {
    boundary.store.getAll.mockReturnValue([{ name: "sb-auth", value: "token" }]);
    const cookies = await cookieMethods();

    expect(cookies.getAll()).toEqual([{ name: "sb-auth", value: "token" }]);
  });

  it("writes refreshed cookies with their options where cookies can be set", async () => {
    const cookies = await cookieMethods();

    cookies.setAll([{ name: "sb-auth", value: "fresh", options: { httpOnly: true } }]);

    expect(boundary.store.set).toHaveBeenCalledWith("sb-auth", "fresh", { httpOnly: true });
  });

  it("does not crash a Server Component render, where setting cookies throws", async () => {
    boundary.store.set.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    });
    const cookies = await cookieMethods();

    expect(() => cookies.setAll([{ name: "sb-auth", value: "fresh" }])).not.toThrow();
  });

  it("fails loudly when Supabase settings are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);

    await expect(createSupabaseServerClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
