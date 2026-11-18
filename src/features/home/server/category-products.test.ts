import { afterEach, describe, expect, it, vi } from "vitest";
import type { CardProduct } from "@/features/catalog/card-view";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ getDb: async () => ({}) }));

const { CATEGORY_PRODUCTS_TIMEOUT_MS, handleCategoryProducts, homeCategoryIds } =
  await import("./category-products");

// covers: AC-7, AC-8, AC-11 (spec 0031)

const request = (query: string, ip?: string) =>
  new Request(`http://localhost/api/catalog/home-products?${query}`, {
    headers: ip ? { "cf-connecting-ip": ip } : {},
  });

const card = { slug: "lamp-1", name: "أباجورة" } as unknown as CardProduct;
const limiterSaying = (success: boolean) => ({ limit: vi.fn(async () => ({ success })) });

const deps = (over: Partial<Parameters<typeof handleCategoryProducts>[1]> = {}) => ({
  limiter: limiterSaying(true),
  products: vi.fn(async () => [card]),
  production: true,
  ...over,
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("handleCategoryProducts", () => {
  it("answers the products, cacheable by the browser for a minute", async () => {
    const products = vi.fn(async () => [card]);
    const response = await handleCategoryProducts(request("category=lamps"), deps({ products }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    expect(await response.json()).toEqual({ products: [card] });
    expect(products).toHaveBeenCalledWith("lamps");
  });

  it("keys the limit on cf-connecting-ip, else local", async () => {
    const limiter = limiterSaying(true);
    await handleCategoryProducts(request("category=lamps", "203.0.113.9"), deps({ limiter }));
    await handleCategoryProducts(request("category=lamps"), deps({ limiter }));
    expect(limiter.limit.mock.calls).toEqual([[{ key: "203.0.113.9" }], [{ key: "local" }]]);
  });

  it("gives 429 no-store over the limit, with no read", async () => {
    const products = vi.fn(async () => [card]);
    const response = await handleCategoryProducts(
      request("category=lamps"),
      deps({ limiter: limiterSaying(false), products }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "too_many" });
    expect(products).not.toHaveBeenCalled();
  });

  it("fails open when the binding is missing, warning once outside production", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = await handleCategoryProducts(
      request("category=lamps"),
      deps({ limiter: undefined, production: false }),
    );
    const second = await handleCategoryProducts(
      request("category=lamps"),
      deps({ limiter: undefined, production: false }),
    );
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({ event: "home_category_products_rate_unchecked" }),
    );
  });

  it("gives 400 no-store for a bad request, with no read", async () => {
    const products = vi.fn(async () => [card]);
    for (const query of ["", "category=", "category=a&category=b", "category=a&x=1"]) {
      const response = await handleCategoryProducts(request(query), deps({ products }));
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "bad_request" });
    }
    expect(products).not.toHaveBeenCalled();
  });

  it("gives 404 no-store for a main unknown or not shown on Home", async () => {
    const response = await handleCategoryProducts(
      request("category=nope"),
      deps({ products: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("gives 503 no-store past the time limit and logs no category", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const pending = handleCategoryProducts(
      request("category=secret-slug"),
      deps({ products: () => new Promise<readonly CardProduct[]>(() => {}) }),
    );
    await vi.advanceTimersByTimeAsync(CATEGORY_PRODUCTS_TIMEOUT_MS + 1);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(error).toHaveBeenCalledWith(
      JSON.stringify({ event: "home_category_products_failed", error: "timeout" }),
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret-slug");
  });

  it("gives 503 when the read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleCategoryProducts(
      request("category=lamps"),
      deps({ products: vi.fn(async () => Promise.reject(new Error("down"))) }),
    );
    expect(response.status).toBe(503);
  });
});

describe("homeCategoryIds", () => {
  const row = (id: string, fields: Record<string, unknown> = {}) => ({
    id,
    slug: id,
    name: id,
    description: null,
    sort: 0,
    parentId: null,
    isVisible: true,
    showOnHome: true,
    homeSubtitle: null,
    imageKey: null,
    ...fields,
  });

  it("answers a main shown on Home with its subs, and nothing for any other", () => {
    const tree = {
      categories: [
        row("lamps"),
        row("lamps-desk", { parentId: "lamps" }),
        row("walls", { showOnHome: false }),
        row("empty"),
      ],
      listed: new Map([
        ["lamps", 1],
        ["lamps-desk", 2],
        ["walls", 3],
      ]),
    };
    expect([...(homeCategoryIds(tree, "lamps") ?? [])].sort()).toEqual(["lamps", "lamps-desk"]);
    // Not ticked for Home, no listed product, a sub, or unknown: no card, so no answer.
    expect(homeCategoryIds(tree, "walls")).toBeNull();
    expect(homeCategoryIds(tree, "empty")).toBeNull();
    expect(homeCategoryIds(tree, "lamps-desk")).toBeNull();
    expect(homeCategoryIds(tree, "nope")).toBeNull();
  });
});
