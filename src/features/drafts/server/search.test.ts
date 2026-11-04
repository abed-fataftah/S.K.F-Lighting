import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { handleQuickOrderSearch } = await import("./search");

// covers: AC-1, AC-7, AC-19 (spec 0020)

const profile = { fullName: null, phone: null, phoneE164: null, removalPending: false };
const electrician = {
  userId: "u",
  email: null,
  profile: { ...profile, role: "electrician" as const },
};
const request = (q: string) =>
  new Request(`http://shop.test/api/quick-order/products?q=${encodeURIComponent(q)}`);

describe("handleQuickOrderSearch", () => {
  it("answers 401 signed out and 403 for anyone but an electrician", async () => {
    const search = vi.fn();
    const signedOut = await handleQuickOrderSearch(request("ثريا"), {
      account: async () => null,
      search,
    });
    expect(signedOut.status).toBe(401);
    const customer = await handleQuickOrderSearch(request("ثريا"), {
      account: async () => ({ ...electrician, profile: { ...profile, role: "customer" } }),
      search,
    });
    expect(customer.status).toBe(403);
    expect(search).not.toHaveBeenCalled();
  });

  it("asks nothing under 2 folded characters", async () => {
    const search = vi.fn();
    const response = await handleQuickOrderSearch(request("ث"), {
      account: async () => electrician,
      search,
    });
    expect(await response.json()).toEqual({ products: [] });
    expect(search).not.toHaveBeenCalled();
  });

  it("searches with the folded words and is never cached", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const response = await handleQuickOrderSearch(request("ثريّا ch-1"), {
      account: async () => electrician,
      search,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(search.mock.calls[0][0]).toMatchObject({ words: ["ثريا", "ch-1"] });
  });

  it("answers 503 and logs only the error name when the read fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleQuickOrderSearch(request("ثريا"), {
      account: async () => electrician,
      search: async () => {
        throw new TypeError("boom");
      },
    });
    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({ event: "quick_order_search_failed", error: "TypeError" }),
    );
    log.mockRestore();
  });
});
