import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));

const { readShopContact, CONTACT_TIMEOUT_MS } = await import("./shop-contact");

// covers: AC-15 (spec 0003): a failing or hanging database gives nulls within 1.5 seconds.
describe("readShopContact", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns the phone and address the read gives", async () => {
    const contact = { phone: "0599 123 456", address: "نابلس" };
    await expect(readShopContact(async () => contact)).resolves.toEqual(contact);
  });

  it("returns nulls when the read fails, and logs no values", async () => {
    const result = await readShopContact(async () => {
      throw new Error("connection refused for 0599 123 456");
    });

    expect(result).toEqual({ phone: null, address: null });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("0599");
  });

  it("returns nulls after 1.5 seconds when the read hangs", async () => {
    vi.useFakeTimers();
    const pending = readShopContact(() => new Promise(() => {}));

    await vi.advanceTimersByTimeAsync(CONTACT_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ phone: null, address: null });
    expect(CONTACT_TIMEOUT_MS).toBe(1500);
  });

  it("says in the log that the read timed out, with the limit and nothing else", async () => {
    vi.useFakeTimers();
    const pending = readShopContact(() => new Promise(() => {}));

    await vi.advanceTimersByTimeAsync(CONTACT_TIMEOUT_MS);
    await pending;

    expect(console.error).toHaveBeenCalledWith("getShopContact: no answer within the time limit", {
      timeoutMs: CONTACT_TIMEOUT_MS,
    });
  });

  it("logs only the error's name when the read fails", async () => {
    await readShopContact(async () => {
      throw new TypeError("bad row نابلس");
    });

    expect(console.error).toHaveBeenCalledWith("getShopContact: read failed", {
      error: "TypeError",
    });
  });

  it("logs unknown when the read rejects with something that is not an Error", async () => {
    const result = await readShopContact(() => Promise.reject("0599 123 456"));

    expect(result).toEqual({ phone: null, address: null });
    expect(console.error).toHaveBeenCalledWith("getShopContact: read failed", {
      error: "unknown",
    });
  });
});
