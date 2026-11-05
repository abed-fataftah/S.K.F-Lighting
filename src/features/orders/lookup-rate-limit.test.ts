import { describe, expect, it, vi } from "vitest";
import type { OrderLimiter } from "@/features/checkout/rate-limit";
import { checkLookupRate } from "./lookup-rate-limit";

// covers: AC-6 (spec 0015). Stand in limiters for the two Workers bindings.

const limiter = (success: boolean) => ({ limit: vi.fn(async () => ({ success })) });
const throwing = (): OrderLimiter => ({
  limit: vi.fn(async () => {
    throw new Error("binding down");
  }),
});
const keys = { ip: "203.0.113.7", number: "26-00042" };

describe("checkLookupRate", () => {
  it("allows a try both limiters allow, keyed by IP and by number", async () => {
    const ip = limiter(true);
    const number = limiter(true);
    expect(await checkLookupRate({ ip, number }, keys)).toBe("allowed");
    expect(ip.limit).toHaveBeenCalledWith({ key: "203.0.113.7" });
    expect(number.limit).toHaveBeenCalledWith({ key: "26-00042" });
  });

  it("is limited by IP and then never asks the number limiter", async () => {
    const number = limiter(true);
    expect(await checkLookupRate({ ip: limiter(false), number }, keys)).toEqual({ limited: "ip" });
    expect(number.limit).not.toHaveBeenCalled();
  });

  it("is limited by number when the IP is under", async () => {
    expect(await checkLookupRate({ ip: limiter(true), number: limiter(false) }, keys)).toEqual({
      limited: "number",
    });
  });

  it.each([
    ["a missing IP binding", { ip: undefined, number: limiter(true) }],
    ["a missing number binding", { ip: limiter(true), number: undefined }],
    ["both missing", { ip: undefined, number: undefined }],
    ["a throwing binding", { ip: throwing(), number: limiter(true) }],
  ])("fails open as unchecked with %s", async (_label, limiters) => {
    expect(await checkLookupRate(limiters, keys)).toBe("unchecked");
  });

  it("is still limited by number when the IP binding is missing", async () => {
    expect(await checkLookupRate({ ip: undefined, number: limiter(false) }, keys)).toEqual({
      limited: "number",
    });
  });
});
