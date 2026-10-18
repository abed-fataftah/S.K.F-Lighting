import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

const auth = vi.hoisted(() => ({ getClaims: vi.fn(), getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth }) }));

const { getClaims, getVerifiedUser } = await import("./session");

describe("getClaims", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    auth.getClaims.mockReset();
    auth.getUser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the claims of a valid sign in token", async () => {
    const claims = { sub: "user-1", aal: "aal1", role: "authenticated" };
    auth.getClaims.mockResolvedValue({ data: { claims }, error: null });

    await expect(getClaims()).resolves.toEqual(claims);
  });

  it("returns null for a visitor with no session", async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: null });

    await expect(getClaims()).resolves.toBeNull();
  });

  it("returns null when the token is expired or tampered with", async () => {
    auth.getClaims.mockResolvedValue({ data: null, error: new Error("invalid JWT signature") });

    await expect(getClaims()).resolves.toBeNull();
  });

  it("returns null, never partial claims, when Supabase reports an error alongside data", async () => {
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
      error: new Error("expired"),
    });

    await expect(getClaims()).resolves.toBeNull();
  });
});

describe("getVerifiedUser", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    auth.getClaims.mockReset();
    auth.getUser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the user as Supabase sees them right now", async () => {
    const user = { id: "user-1", email: "owner@example.com" };
    auth.getUser.mockResolvedValue({ data: { user }, error: null });

    await expect(getVerifiedUser()).resolves.toEqual(user);
  });

  it("asks the Supabase server (getUser), not just the local token check", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    await getVerifiedUser();

    expect(auth.getUser).toHaveBeenCalledTimes(1);
    expect(auth.getClaims).not.toHaveBeenCalled();
  });

  it("returns null when the user was signed out, deleted, or the token was revoked", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("User not found") });

    await expect(getVerifiedUser()).resolves.toBeNull();
  });

  it("returns null for a visitor with no session", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getVerifiedUser()).resolves.toBeNull();
  });
});
