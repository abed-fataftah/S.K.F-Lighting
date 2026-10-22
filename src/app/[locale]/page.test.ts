import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/empty-state";
import { PageErrorState } from "@/components/error-state";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { CardProduct } from "@/features/catalog/card-view";
import ar from "@/i18n/messages/ar.json";

// The home grid's database read is the boundary: each test decides how it answers.
vi.mock("server-only", () => ({}));
const listHomeProducts = vi.fn<() => Promise<readonly CardProduct[]>>();
vi.mock("@/features/catalog/server/queries", () => ({ listHomeProducts }));
vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "970500000000");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

// Translations come from the real Arabic catalog; only next-intl's request plumbing is replaced.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: keyof typeof ar) => (key: string) =>
    (ar[namespace] as Record<string, string>)[key],
}));

const { default: HomePage } = await import("./page");

type Element = ReactElement<{ children?: ReactNode; whatsappNumber?: string }>;

// Walk the element tree (without rendering the client parts) for the first match.
function findElement(node: ReactNode, match: (el: Element) => boolean): Element | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, match);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object" || !("props" in node)) return null;
  const el = node as Element;
  return match(el) ? el : findElement(el.props.children, match);
}

const product = (n: number): CardProduct => ({
  slug: `lamp-${n}`,
  name: `أباجورة ${n}`,
  code: `DEMO-${n}`,
  imageKey: null,
  chips: [],
  listPrice: 18000,
  pricesDiffer: false,
  inStock: true,
  addVariantId: `variant-${n}`,
});

const errorCard = (page: ReactNode) => findElement(page, (el) => el.type === PageErrorState);
const productCards = (page: ReactNode) => {
  const grid = findElement(page, (el) => el.type === "ul");
  return grid ? (grid.props.children as Element[]).map((li) => li.props.children as Element) : [];
};

// covers: AC-15 (spec 0003: the page still renders when a read fails), AC-3 (spec 0004: the home grid)
describe("home page", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    listHomeProducts.mockReset();
  });

  it("shows a card for each product the read gives, and no error card", async () => {
    listHomeProducts.mockResolvedValue([product(1), product(2)]);

    const page = await HomePage();

    const cards = productCards(page);
    expect(cards.map((card) => card.type)).toEqual([ProductCard, ProductCard]);
    expect(errorCard(page)).toBeNull();
  });

  it("shows the empty state, not the error card, when the read gives no products", async () => {
    listHomeProducts.mockResolvedValue([]);

    const page = await HomePage();

    expect(findElement(page, (el) => el.type === EmptyState)).not.toBeNull();
    expect(errorCard(page)).toBeNull();
  });

  it("shows the error card with the shop's WhatsApp number when the read fails", async () => {
    listHomeProducts.mockRejectedValue(new Error("connection refused"));

    const page = await HomePage();

    expect(errorCard(page)?.props.whatsappNumber).toBe("970500000000");
    expect(findElement(page, (el) => el.type === "ul")).toBeNull();
  });

  it("keeps the page heading above the error card, so the page still has its h1", async () => {
    listHomeProducts.mockRejectedValue(new Error("connection refused"));

    const page = await HomePage();

    const heading = findElement(page, (el) => el.type === "h1");
    expect(heading?.props.children).toBe(ar.Home.productsTitle);
  });

  it("gives up on a hanging read after 3 seconds and shows the error card", async () => {
    vi.useFakeTimers();
    listHomeProducts.mockReturnValue(new Promise(() => {}));
    let settled = false;
    const pending = HomePage().then((page) => {
      settled = true;
      return page;
    });

    await vi.advanceTimersByTimeAsync(2999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(errorCard(await pending)).not.toBeNull();
  });

  it("logs why the read failed without any product or customer values", async () => {
    listHomeProducts.mockRejectedValue(new Error("timeout reading lamp-1 for 0599 123 456"));

    await HomePage();

    expect(console.error).toHaveBeenCalledWith("listHomeProducts: read failed", {
      error: "failed",
    });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("0599");
    expect(logged).not.toContain("lamp-1");
  });
});
