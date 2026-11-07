import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-1, AC-7 (spec 0027). The admin check, the env, the database, and `reportError` are
// spies; the GraphQL call is a fake fetcher passed in.

vi.mock("server-only", () => ({}));
vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "970500000000");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://skf.example");

const requireAdminPage = vi.fn(async () => ({ userId: "admin" }));
vi.mock("@/server/auth/admin", () => ({ requireAdminPage }));

const serverEnv = vi.fn();
vi.mock("@/server/env", () => ({ serverEnv }));

const reportError = vi.fn(async () => {});
vi.mock("@/server/monitoring/report", () => ({ reportError }));

vi.mock("@/server/db", () => ({
  getDb: async () => {
    throw new Error("no database in this test");
  },
}));

const { fetchStatsRows, readStats } = await import("./queries");

const cf = {
  accountId: "acc",
  siteTag: "site",
  token: "secret-token",
  graphqlUrl: "http://127.0.0.1:8790/graphql",
};
const week = { from: "2026-11-01", to: "2026-11-07" };
const answer = (rows: unknown[]) =>
  new Response(
    JSON.stringify({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: rows }] } } }),
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchStatsRows", () => {
  it("posts the query with the bearer token and returns the rows", async () => {
    const rows = [
      { count: 2, sum: { visits: 1 }, dimensions: { datetimeHour: "2026-11-02T08:00:00Z" } },
    ];
    const fetcher = vi.fn(async () => answer(rows));
    expect(await fetchStatsRows("visits", cf, week, fetcher)).toEqual({ ok: true, data: rows });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(cf.graphqlUrl);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret-token" });
  });

  it.each([
    ["http_500", async () => new Response("boom", { status: 500 })],
    [
      "graphql",
      async () => new Response(JSON.stringify({ data: null, errors: [{ message: "x" }] })),
    ],
    ["graphql", async () => new Response("<html>not json</html>")],
    ["network", async () => Promise.reject(new TypeError("fetch failed"))],
  ] as const)("fails as %s", async (code, fetcher) => {
    expect(await fetchStatsRows("visits", cf, week, fetcher)).toEqual({ ok: false, error: code });
  });

  it("fails as timeout when the answer takes longer than the limit", async () => {
    const slow = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    expect(await fetchStatsRows("visits", cf, week, slow, 20)).toEqual({
      ok: false,
      error: "timeout",
    });
  });
});

describe("readStats", () => {
  const period = { preset: "7d" as const, ...week };

  it("is null when Web Analytics is not set up, and reports nothing", async () => {
    serverEnv.mockReturnValue({ designSystemPage: false, cf: null });
    expect(await readStats(period)).toBeNull();
    expect(requireAdminPage).toHaveBeenCalledWith("/admin/stats");
    expect(reportError).not.toHaveBeenCalled();
  });

  it("checks the admin before any call leaves", async () => {
    requireAdminPage.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(readStats(period)).rejects.toThrow("NEXT_REDIRECT");
    expect(serverEnv).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("reports each failed section as stats_read_failed with its section and status", async () => {
    serverEnv.mockReturnValue({ designSystemPage: false, cf });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("down", { status: 503 }));
    const stats = await readStats(period);
    const [visits, products, sources] = await Promise.all([
      stats!.visits,
      stats!.products,
      stats!.sources,
    ]);
    expect([visits, products, sources]).toEqual([
      { ok: false, error: "http_503" },
      { ok: false, error: "http_503" },
      { ok: false, error: "http_503" },
    ]);
    expect(reportError).toHaveBeenCalledTimes(3);
    expect(reportError).toHaveBeenCalledWith("stats_read_failed", "http_503", {
      section: "sources",
      status: "http_503",
    });
    fetchSpy.mockRestore();
  });
});
