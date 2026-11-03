import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-12 (spec 0019), AC-13 (spec 0017). The account and the database write are spies, so
// these tests prove which account an order is placed for.

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./rate-limit", () => ({ orderRateCheck: vi.fn(async () => "ok") }));
vi.mock("@/server/db", () => ({ getDb: vi.fn(async () => ({})) }));
vi.mock("@/features/cart/server/cookies", () => ({ readCartCookie: vi.fn(async () => []) }));
vi.mock("./placed", () => ({ rememberPlacedOrder: vi.fn() }));

const getAccountProfile = vi.fn();
vi.mock("@/features/accounts/server/profile", () => ({ getAccountProfile }));

const placeOrderInDb = vi.fn();
vi.mock("./place-order", () => ({ placeOrderInDb }));

const { placeOrder } = await import("./actions");

const USER_ID = "5b0c7f1e-2d3a-4c5b-8e9f-0a1b2c3d4e5f";

const form = () => {
  const data = new FormData();
  const fields = {
    idempotencyKey: "3f6c1a52-8e1b-4c1e-9a55-2b1f0e7d9c11",
    name: "أحمد يوسف",
    phone: "0599123456",
    fulfilment: "pickup",
    expectedTotal: "12500",
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const profile = (role: "customer" | "electrician", removalPending: boolean) => ({
  userId: USER_ID,
  email: null,
  profile: { fullName: null, phone: null, phoneE164: null, role, removalPending },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  placeOrderInDb.mockResolvedValue({ kind: "cart_empty" });
});

describe("the account an order is placed for", () => {
  it("is the signed in account, with its role read now", async () => {
    getAccountProfile.mockResolvedValue(profile("electrician", false));
    await placeOrder(null, form());
    expect(placeOrderInDb.mock.calls[0][1].placedBy).toEqual({
      userId: USER_ID,
      role: "electrician",
    });
  });

  it("is none while the owner is removing the account, logged without personal data", async () => {
    getAccountProfile.mockResolvedValue(profile("customer", true));
    await placeOrder(null, form());
    expect(placeOrderInDb.mock.calls[0][1].placedBy).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      JSON.stringify({ event: "order_profile_removed", userId: USER_ID }),
    );
  });
});
