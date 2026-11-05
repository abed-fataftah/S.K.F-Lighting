import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeLimit } from "./time-limit";

describe("withTimeLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the value the read gives", async () => {
    await expect(withTimeLimit(async () => [1, 2], 1000)).resolves.toEqual({
      ok: true,
      data: [1, 2],
    });
  });

  it("returns failed with the cause when the read throws", async () => {
    const cause = new Error("connection refused");
    await expect(
      withTimeLimit(async () => {
        throw cause;
      }, 1000),
    ).resolves.toEqual({ ok: false, error: "failed", cause });
  });

  it("returns timeout once the limit passes, not before", async () => {
    vi.useFakeTimers();
    const pending = withTimeLimit(() => new Promise(() => {}), 3000);
    let settled = false;
    void pending.then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(2999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ ok: false, error: "timeout" });
  });

  it("leaves no timer behind once a fast read answers", async () => {
    vi.useFakeTimers();

    await withTimeLimit(async () => "done", 3000);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves no timer behind once a read fails", async () => {
    vi.useFakeTimers();

    await withTimeLimit(async () => {
      throw new Error("down");
    }, 3000);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores an answer that arrives after the limit", async () => {
    vi.useFakeTimers();
    const pending = withTimeLimit(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("late"), 5000)),
      3000,
    );

    await vi.advanceTimersByTimeAsync(5000);

    await expect(pending).resolves.toEqual({ ok: false, error: "timeout" });
  });

  it("keeps a falsy value as data", async () => {
    await expect(withTimeLimit(async () => null, 1000)).resolves.toEqual({ ok: true, data: null });
  });
});
