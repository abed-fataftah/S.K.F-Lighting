import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-4, AC-5, AC-6 (spec 0015). The limiters, the database read, and the cookie are stand
// ins, so these tests prove what `lookupOrder` does around them: one answer for every miss, no
// query once limited, and the cookie before the redirect on a match.

vi.mock("server-only", () => ({}));

const findLookupOrderId = vi.fn();
vi.mock("./customer-order", () => ({ findLookupOrderId }));

const lookupRateCheck = vi.fn();
vi.mock("./lookup-rate-limit", () => ({ lookupRateCheck }));

const rememberTrackedOrder = vi.fn();
vi.mock("./tracked", () => ({ rememberTrackedOrder }));

const getDb = vi.fn(async () => ({}));
vi.mock("@/server/db", () => ({ getDb }));

class Redirected extends Error {
  constructor(readonly url: string) {
    super(url);
  }
}
const redirect = vi.fn((url: string) => {
  throw new Redirected(url);
});
vi.mock("next/navigation", () => ({ redirect }));

const { lookupOrder } = await import("./lookup-actions");

const ORDER_ID = "3f6c1a52-8e1b-4c1e-9a55-2b1f0e7d9c11";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

let logged: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  logged = [];
  findLookupOrderId.mockResolvedValue(null);
  lookupRateCheck.mockResolvedValue("allowed");
  const keep = (...line: unknown[]) => void logged.push(line.map(String).join(" "));
  vi.spyOn(console, "log").mockImplementation(keep);
  vi.spyOn(console, "warn").mockImplementation(keep);
  vi.spyOn(console, "info").mockImplementation(keep);
  vi.spyOn(console, "error").mockImplementation(keep);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lookupOrder on a match", () => {
  it("remembers the order, then redirects to its page under the parsed number", async () => {
    findLookupOrderId.mockResolvedValue(ORDER_ID);
    const error = await lookupOrder(
      null,
      form({ number: "٢٦ ٠٠٠٤٢", phone: "059 912 3456" }),
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(Redirected);
    expect((error as Redirected).url).toBe("/orders/26-00042");
    expect(findLookupOrderId).toHaveBeenCalledWith(expect.anything(), "26-00042", "+970599123456");
    expect(lookupRateCheck).toHaveBeenCalledWith("26-00042");
    expect(rememberTrackedOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(rememberTrackedOrder.mock.invocationCallOrder[0]).toBeLessThan(
      redirect.mock.invocationCallOrder[0],
    );
  });
});

describe("lookupOrder on a miss", () => {
  it.each([
    ["a wrong phone", { number: "26-00042", phone: "0599000000" }],
    ["a wrong number", { number: "26-00043", phone: "0599123456" }],
    ["an unknown number", { number: "99-99999", phone: "0599123456" }],
  ])("answers %s with the same not_found and the typed values", async (_label, fields) => {
    const result = await lookupOrder(null, form(fields));

    expect(result).toEqual({ ok: false, error: "not_found", values: fields });
    expect(findLookupOrderId).toHaveBeenCalledTimes(1);
    expect(rememberTrackedOrder).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("logs nothing the customer typed", async () => {
    await lookupOrder(null, form({ number: "26-00042", phone: "0599123456" }));
    expect(logged.join("\n")).not.toMatch(/26-00042|0599123456|599123456/);
  });
});

describe("lookupOrder on a format error", () => {
  it("returns the field errors and the typed values, and never reaches the database", async () => {
    const fields = { number: "26/00042", phone: "123" };
    const result = await lookupOrder(null, form(fields));

    expect(result).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { number: { code: "number_format" }, phone: { code: "phone_mobile" } },
      values: fields,
    });
    expect(lookupRateCheck).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
    expect(findLookupOrderId).not.toHaveBeenCalled();
  });

  it("keeps empty values when a field is missing", async () => {
    const result = await lookupOrder(null, form({}));
    expect(result).toMatchObject({ error: "invalid", values: { number: "", phone: "" } });
  });
});

describe("lookupOrder when limited", () => {
  it.each(["ip", "number"] as const)(
    "answers limited by %s with no query, logging only the limiter",
    async (by) => {
      lookupRateCheck.mockResolvedValue({ limited: by });
      const fields = { number: "26-00042", phone: "0599123456" };
      const result = await lookupOrder(null, form(fields));

      expect(result).toEqual({ ok: false, error: "limited", values: fields });
      expect(getDb).not.toHaveBeenCalled();
      expect(findLookupOrderId).not.toHaveBeenCalled();
      expect(logged).toEqual([JSON.stringify({ event: "order_lookup_limited", by })]);
    },
  );

  it("goes on with the lookup when the limiters are unchecked", async () => {
    lookupRateCheck.mockResolvedValue("unchecked");
    const result = await lookupOrder(null, form({ number: "26-00042", phone: "0599123456" }));
    expect(result).toMatchObject({ error: "not_found" });
    expect(findLookupOrderId).toHaveBeenCalledTimes(1);
  });
});
