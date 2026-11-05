import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ getDb: async () => ({}) }));

const { COUNT_TIMEOUT_MS, handleCount } = await import("./count");

// covers: AC-12, AC-15, AC-16 (spec 0010)

const request = (query: string, ip?: string) =>
  new Request(`http://localhost/api/catalog/count?${query}`, {
    headers: ip ? { "cf-connecting-ip": ip } : {},
  });

const limiterSaying = (success: boolean) => ({ limit: vi.fn(async () => ({ success })) });

const deps = (over: Partial<Parameters<typeof handleCount>[1]> = {}) => ({
  limiter: limiterSaying(true),
  count: vi.fn(async () => 7),
  production: true,
  ...over,
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("handleCount", () => {
  it("answers the count with no-store", async () => {
    const response = await handleCount(request("q=ثريا"), deps());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ count: 7 });
  });

  it("keys the limit on cf-connecting-ip, else local", async () => {
    const limiter = limiterSaying(true);
    await handleCount(request("q=ثريا", "203.0.113.9"), deps({ limiter }));
    await handleCount(request("q=ثريا"), deps({ limiter }));
    expect(limiter.limit.mock.calls).toEqual([[{ key: "203.0.113.9" }], [{ key: "local" }]]);
  });

  it("gives 429 over the limit, with no read", async () => {
    const count = vi.fn(async () => 7);
    const response = await handleCount(
      request("q=ثريا"),
      deps({ limiter: limiterSaying(false), count }),
    );
    expect(response.status).toBe(429);
    expect(count).not.toHaveBeenCalled();
  });

  it("fails open when the binding is missing or throws, warning once outside production", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throwing = { limit: vi.fn(async () => Promise.reject(new Error("down"))) };
    const first = await handleCount(
      request("q=ثريا"),
      deps({ limiter: undefined, production: false }),
    );
    const second = await handleCount(
      request("q=ثريا"),
      deps({ limiter: throwing, production: false }),
    );
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(JSON.stringify({ event: "catalog_count_rate_unchecked" }));
  });

  it("gives 400 for a bad scope and 0 for a short query, both with no read", async () => {
    const count = vi.fn(async () => 7);
    const bad = await handleCount(request("main=a&q=ثريا"), deps({ count }));
    const short = await handleCount(request("q=ث"), deps({ count }));
    expect(bad.status).toBe(400);
    expect(await short.json()).toEqual({ count: 0 });
    expect(count).not.toHaveBeenCalled();
  });

  it("gives 404 for a category that is unknown or not shown", async () => {
    const response = await handleCount(
      request("main=nope"),
      deps({ count: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(404);
  });

  it("gives 503 past the time limit and logs no query", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const pending = handleCount(
      request("q=0599123456"),
      deps({ count: () => new Promise<number>(() => {}) }),
    );
    await vi.advanceTimersByTimeAsync(COUNT_TIMEOUT_MS + 1);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(error).toHaveBeenCalledWith(
      JSON.stringify({ event: "catalog_count_failed", error: "timeout" }),
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("0599123456");
  });
});
