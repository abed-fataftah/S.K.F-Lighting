import { afterEach, describe, expect, it, vi } from "vitest";

// covers: AC-15 (spec 0014)

vi.mock("server-only", () => ({}));
vi.mock("./admin-queries", () => ({ countUnseenOrders: vi.fn() }));

const { unseenOrdersForSidebar, UNSEEN_COUNT_LIMIT_MS } = await import("./unseen-badge");

const error = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  vi.useRealTimers();
  error.mockClear();
});

describe("unseenOrdersForSidebar", () => {
  it("passes the count through", async () => {
    expect(await unseenOrdersForSidebar(async () => 3)).toBe(3);
    expect(error).not.toHaveBeenCalled();
  });

  it("shows no badge and logs only the error kind when the read times out", async () => {
    vi.useFakeTimers();
    const pending = unseenOrdersForSidebar(() => new Promise<number>(() => {}));
    await vi.advanceTimersByTimeAsync(UNSEEN_COUNT_LIMIT_MS);
    expect(await pending).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      JSON.stringify({ event: "unseen_count_failed", error: "timeout" }),
    );
  });

  it("shows no badge when the read fails", async () => {
    expect(
      await unseenOrdersForSidebar(async () => {
        throw new Error("connection refused for +970599123456");
      }),
    ).toBeUndefined();
    expect(error.mock.calls).toEqual([
      [JSON.stringify({ event: "unseen_count_failed", error: "failed" })],
    ]);
  });
});
