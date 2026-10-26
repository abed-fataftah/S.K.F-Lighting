import { describe, expect, it } from "vitest";
import { checkOrderRate, rateKey, type OrderLimiter } from "./rate-limit";

// A stand in for the Workers binding: `limit` allowed calls per key, like `simple: { limit }`.
function fakeLimiter(limit: number): OrderLimiter & { readonly keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      return { success: keys.filter((k) => k === key).length <= limit };
    },
  };
}

// covers: AC-10 (spec 0004)
describe("checkOrderRate", () => {
  it("allows five submissions a minute from one address and refuses the sixth", async () => {
    const limiter = fakeLimiter(5);
    const results = [];
    for (let i = 0; i < 6; i += 1) results.push(await checkOrderRate(limiter, "203.0.113.7"));
    expect(results).toEqual(["allowed", "allowed", "allowed", "allowed", "allowed", "limited"]);
    expect(await checkOrderRate(limiter, "198.51.100.2")).toBe("allowed");
  });

  it("fails open without a binding or when it throws", async () => {
    expect(await checkOrderRate(undefined, "local")).toBe("unchecked");
    const broken: OrderLimiter = {
      limit: async () => {
        throw new Error("down");
      },
    };
    expect(await checkOrderRate(broken, "local")).toBe("unchecked");
  });
});

describe("rateKey", () => {
  it("uses the connecting IP, or one shared local key", () => {
    expect(rateKey(" 203.0.113.7 ")).toBe("203.0.113.7");
    expect(rateKey(null)).toBe("local");
    expect(rateKey("")).toBe("local");
  });
});
