import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-8, AC-11 (spec 0012). The rate limit and the database are spies, so these tests
// prove what `placeOrder` does before it would reach them.

vi.mock("server-only", () => ({}));

const orderRateCheck = vi.fn();
vi.mock("./rate-limit", () => ({ orderRateCheck }));

const getDb = vi.fn(async () => {
  throw new Error("the database must not be reached");
});
vi.mock("@/server/db", () => ({ getDb }));

const readCartCookie = vi.fn(async () => []);
vi.mock("@/features/cart/server/cookies", () => ({ readCartCookie }));

const reportError = vi.fn(async () => {});
vi.mock("@/server/monitoring/report", () => ({ reportError }));

const { placeOrder } = await import("./actions");

const NAME = "أحمد يوسف";
const PHONE = "0599123456";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const valid = {
  idempotencyKey: "3f6c1a52-8e1b-4c1e-9a55-2b1f0e7d9c11",
  name: NAME,
  phone: PHONE,
  fulfilment: "pickup",
  expectedTotal: "12500",
};

let logged: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  logged = [];
  orderRateCheck.mockResolvedValue("limited");
  const keep = (line: unknown) => void logged.push(String(line));
  vi.spyOn(console, "warn").mockImplementation(keep);
  vi.spyOn(console, "info").mockImplementation(keep);
  vi.spyOn(console, "error").mockImplementation(keep);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the honeypot field", () => {
  it("saves nothing, skips the rate limit, and logs only order_honeypot", async () => {
    const result = await placeOrder(null, form({ ...valid, company_fax_2: "555 1234" }));
    expect(result).toEqual({ ok: false, error: "save_failed" });
    expect(orderRateCheck).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
    expect(readCartCookie).not.toHaveBeenCalled();
    expect(logged).toEqual([JSON.stringify({ event: "order_honeypot" })]);
  });

  it("catches a bot even when the rest of the form is invalid", async () => {
    const result = await placeOrder(null, form({ name: "x", company_fax_2: "y" }));
    expect(result).toEqual({ ok: false, error: "save_failed" });
  });

  it.each(["", "   ", "\n\t"])("treats %j as empty and goes on to the rate limit", async (trap) => {
    const result = await placeOrder(null, form({ ...valid, company_fax_2: trap }));
    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(orderRateCheck).toHaveBeenCalledOnce();
    expect(logged.join("\n")).not.toMatch(/order_honeypot/);
  });
});

describe("refused sends", () => {
  it("log the error code and field names, never what was typed", async () => {
    const result = await placeOrder(
      null,
      form({ ...valid, name: "أحمد", phone: "0222", city: "نابلس 2", notes: "بعد العصر" }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { name: { code: "name_full" }, phone: { code: "phone_mobile" } },
    });
    expect(orderRateCheck).not.toHaveBeenCalled();
    expect(logged).toEqual([
      JSON.stringify({ event: "order_refused", error: "invalid", fields: ["name", "phone"] }),
    ]);
    expect(logged.join("\n")).not.toMatch(/أحمد|0222|نابلس|العصر/);
  });

  it("log no typed value when the rate limit refuses", async () => {
    await placeOrder(null, form(valid));
    expect(logged.join("\n")).not.toContain(NAME);
    expect(logged.join("\n")).not.toContain(PHONE);
  });
});

// covers: AC-10, AC-11 (spec 0027): only an unexpected save failure reaches Sentry.
describe("reporting to Sentry", () => {
  it("reports a database failure while saving as order_save_failed, tagged checkout", async () => {
    orderRateCheck.mockResolvedValue("ok");
    const result = await placeOrder(null, form(valid));
    expect(result).toEqual({ ok: false, error: "save_failed" });
    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith(
      "order_save_failed",
      expect.objectContaining({ message: "the database must not be reached" }),
      {},
      { area: "checkout" },
    );
  });

  it("never reports the expected refusals: rate limited, invalid, or the trap", async () => {
    await placeOrder(null, form(valid));
    await placeOrder(null, form({ ...valid, phone: "0222" }));
    await placeOrder(null, form({ ...valid, company_fax_2: "x" }));
    expect(reportError).not.toHaveBeenCalled();
  });
});
