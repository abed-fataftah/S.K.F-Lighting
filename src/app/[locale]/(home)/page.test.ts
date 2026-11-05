import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CardProduct } from "@/features/catalog/card-view";
import { BannerCarousel } from "@/features/home/components/banner-carousel";
import { HeroCard } from "@/features/home/components/hero-card";
import {
  CategoriesSection,
  FeaturedSection,
  TrustSection,
} from "@/features/home/components/home-sections";
import type { ZoneFee } from "@/features/home/fees";
import type { HomeCircle } from "@/features/home/home-rules";
import type { HomeSections } from "@/features/home/server/home";
import ar from "@/i18n/messages/ar.json";

// Home's reads are the boundary: each test decides how they answer.
vi.mock("server-only", () => ({}));
const getHomeSections = vi.fn<() => Promise<HomeSections>>();
const getDeliveryFees = vi.fn<() => Promise<readonly ZoneFee[] | null>>();
const getShopAddress = vi.fn<() => Promise<string | null>>();
vi.mock("@/features/home/server/home", () => ({ getHomeSections, getDeliveryFees }));
vi.mock("@/features/shell/server/shop-contact", () => ({ getShopAddress }));
vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "970500000000");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

// Translations come from the real Arabic catalog; only next-intl's request plumbing is replaced.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: keyof typeof ar) => (key: string) =>
    (ar[namespace] as Record<string, string>)[key],
}));

const { default: HomePage } = await import("./page");

type Props = {
  children?: ReactNode;
  className?: string;
  jumpTo?: string | null;
  banners?: unknown;
  circles?: unknown;
  products?: unknown;
  zoneLine?: string | null;
  address?: string | null;
};
type Element = ReactElement<Props>;

// Walk the element tree (without rendering the components) for every match.
function findAll(node: ReactNode, match: (el: Element) => boolean): Element[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, match));
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const el = node as Element;
  return [...(match(el) ? [el] : []), ...findAll(el.props.children, match)];
}
const find = (node: ReactNode, type: unknown) => findAll(node, (el) => el.type === type)[0] ?? null;

const card = (n: number): CardProduct => ({
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
const circle = (slug: string): HomeCircle => ({ slug, name: slug, imageKey: null, line: null });
const banner = { id: "b1", imageKey: "banners/b1.webp", alt: "خصم الشتاء", href: null };

function answer(sections: Partial<HomeSections>, fees: readonly ZoneFee[] | null = null) {
  getHomeSections.mockResolvedValue({ banners: [], circles: [], featured: [], ...sections });
  getDeliveryFees.mockResolvedValue(fees);
  getShopAddress.mockResolvedValue(null);
}

// covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 (spec 0011)
describe("home page", () => {
  afterEach(() => vi.clearAllMocks());

  it("shows the hero with the page's only h1 when no banner is on", async () => {
    answer({ circles: [circle("lamps")], featured: [card(1)] });

    const page = await HomePage();

    expect(find(page, HeroCard)?.props.jumpTo).toBe("categories");
    expect(find(page, BannerCarousel)).toBeNull();
    expect(findAll(page, (el) => el.type === "h1")).toEqual([]);
  });

  it("shows the banners and a hidden h1 with the shop's name instead of the hero", async () => {
    answer({ banners: [banner] });

    const page = await HomePage();

    expect(find(page, BannerCarousel)?.props.banners).toEqual([banner]);
    expect(find(page, HeroCard)).toBeNull();
    const [heading] = findAll(page, (el) => el.type === "h1");
    expect(heading.props.children).toBe(ar.Home.title);
    expect(heading.props.className).toBe("sr-only");
  });

  it("falls back to the hero when the banner read failed", async () => {
    answer({ banners: null });

    expect(find(await HomePage(), HeroCard)).not.toBeNull();
  });

  it("hides only the parts whose read failed or came back empty", async () => {
    answer({ circles: null, featured: [card(1), card(2)] });

    const page = await HomePage();

    expect(find(page, CategoriesSection)).toBeNull();
    expect(find(page, FeaturedSection)?.props.products).toHaveLength(2);
    expect(find(page, HeroCard)?.props.jumpTo).toBe("featured");
    expect(find(page, TrustSection)).not.toBeNull();
  });

  it("hides the shop now button when there are neither circles nor products", async () => {
    answer({ circles: [], featured: null });

    const page = await HomePage();

    expect(find(page, FeaturedSection)).toBeNull();
    expect(find(page, HeroCard)?.props.jumpTo).toBeNull();
  });

  it("gives the delivery card the zone line and the pickup card the address", async () => {
    answer({}, [
      { shortName: "الضفة", fee: 2000 },
      { shortName: "الداخل", fee: 7000 },
    ]);
    getShopAddress.mockResolvedValue("الخليل، شارع السلام");

    const trust = find(await HomePage(), TrustSection);

    expect(trust?.props.zoneLine).toBe("الضفة ₪20 · الداخل ₪70");
    expect(trust?.props.address).toBe("الخليل، شارع السلام");
  });

  it("gives the delivery card no line with no active zone", async () => {
    answer({}, null);

    expect(find(await HomePage(), TrustSection)?.props.zoneLine).toBeNull();
  });
});
