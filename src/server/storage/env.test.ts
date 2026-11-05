import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { parseStorageEnv } = await import("./env");

// covers: AC-16 (spec 0006)
describe("parseStorageEnv", () => {
  const key = "service-role-key-for-tests-only";

  it("reads the Supabase URL and the service role key", () => {
    expect(
      parseStorageEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: key,
      }),
    ).toEqual({ url: "http://127.0.0.1:54321", serviceRoleKey: key });
  });

  it("fails loudly without the key or with a bad URL", () => {
    expect(() => parseStorageEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
    expect(() =>
      parseStorageEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() =>
      parseStorageEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url", SUPABASE_SERVICE_ROLE_KEY: key }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
