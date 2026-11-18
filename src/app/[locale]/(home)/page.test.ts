import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CardProduct } from "@/features/catalog/card-view";
import { BannerCarousel } from "@/features/home/components/banner-carousel";
import { HeroCard } from "@/features/home/components/hero-card";
import { HeroCoverflow } from "@/features/home/components/hero-coverflow";
import { CategoriesSection, TrustSection } from "@/features/home/components/home-sections";
import type { ZoneFee } from "@/features/home/fees";
import type { HomeCategory } from "@/features/home/home-rules";
import type { HomeSections } from "@/features/home/server/home";
import { noContact, type ShopContact } from "@/features/shell/contact";
import ar from "@/i18n/messages/ar.json";

// Home's reads are the boundary: each test decides how they answer.
vi.mock("server-only", () => ({}));
const getHomeSections = vi.fn<() => Promise<HomeSections>>();
const getDeliveryFees = vi.fn<() => Promise<readonly ZoneFee[] | null>>();
const getShopAddress = vi.fn<() => Promise<string | null>>();
vi.mock("@/features/home/server/home", () => ({ getHomeSections, getDeliveryFees }));
const getShopContact = vi.fn<() => Promise<ShopContact>>(async () => noContact);
vi.mock("@/features/shell/server/shop-contact", () => ({
  getShopAddress,
  getShopContact,
  getWhatsappNumber: async () => "970500000000",
  pickWhatsappNumber: (saved: string | null) => saved || "970500000000",
}));
const canAddToDraft = vi.fn<() => Promise<boolean>>(async () => false);
vi.mock("@/features/drafts/server/guard", () => ({ canAddToDraft }));
vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "970500000000");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

// Translations come from the real Arabic catalog; only next-intl's request plumbing is replaced.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: keyof typeof ar) => (key: string) =>
    (ar[namespace] as Record<string, string>)[key],
}));

const { default: HomePage, generateMetadata } = await import("./page");

type Props = {
  children?: ReactNode;
  className?: string;
  jumpTo?: string | null;
  banners?: unknown;
  categories?: unknown;
  first?: unknown;
  canAddToDraft?: boolean;
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
  productId: `product-${n}`,
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
const circle = (slug: string): HomeCategory => ({ slug, name: slug, imageKey: null, line: null });
const banner = { id: "b1", imageKey: "banners/b1.webp", alt: "خصم الشتاء", href: null };

function answer(sections: Partial<HomeSections>, fees: readonly ZoneFee[] | null = null) {
  getHomeSections.mockResolvedValue({
    banners: [],
    circles: [],
    categoryProducts: null,
    featured: [],
    ...sections,
  });
  getDeliveryFees.mockResolvedValue(fees);
  getShopAddress.mockResolvedValue(null);
}

// covers: AC-1, AC-2, AC-11, AC-12 (spec 0030); AC-6, AC-7 (spec 0011)
describe("home page", () => {
  afterEach(() => vi.clearAllMocks());

  const h1s = (page: ReactNode) => findAll(page, (el) => el.type === "h1");

  it("shows the coverflow hero with the picks, which owns the page's one h1", async () => {
    answer({ circles: [circle("lamps")], featured: [card(1), card(2)] });

    const page = await HomePage();

    const hero = find(page, HeroCoverflow);
    expect(hero?.props.products).toHaveLength(2);
    expect(hero?.props.jumpTo).toBe("categories");
    expect(find(page, HeroCard)).toBeNull();
    expect(find(page, BannerCarousel)).toBeNull();
    expect(h1s(page)).toEqual([]);
  });

  it("keeps the hero above the banners when a banner is on, with no hidden h1", async () => {
    answer({ banners: [banner], featured: [card(1)] });

    const page = await HomePage();

    expect(find(page, BannerCarousel)?.props.banners).toEqual([banner]);
    expect(find(page, HeroCoverflow)).not.toBeNull();
    expect(h1s(page)).toEqual([]);
    const order = findAll(
      page,
      (el) => el.type === HeroCoverflow || el.type === BannerCarousel,
    ).map((el) => el.type);
    expect(order).toEqual([HeroCoverflow, BannerCarousel]);
  });

  it("shows the fallback card with no products, or when the featured read failed", async () => {
    answer({ circles: [circle("lamps")], featured: [] });
    const empty = await HomePage();
    expect(find(empty, HeroCard)?.props.jumpTo).toBe("categories");
    expect(find(empty, HeroCoverflow)).toBeNull();

    answer({ featured: null });
    const failed = await HomePage();
    expect(find(failed, HeroCard)).not.toBeNull();
    expect(find(failed, HeroCoverflow)).toBeNull();
    expect(h1s(failed)).toEqual([]);
  });

  it("keeps the coverflow and drops only the banners when the banner read failed", async () => {
    answer({ banners: null, featured: [card(1)] });

    const page = await HomePage();

    expect(find(page, HeroCoverflow)).not.toBeNull();
    expect(find(page, BannerCarousel)).toBeNull();
  });

  it("hides only the parts whose read failed or came back empty", async () => {
    answer({ circles: null, featured: [card(1), card(2)] });

    const page = await HomePage();

    expect(find(page, CategoriesSection)).toBeNull();
    expect(find(page, HeroCoverflow)?.props.jumpTo).toBeNull();
    expect(find(page, TrustSection)).not.toBeNull();
  });

  // covers: AC-1, AC-6 (spec 0031)
  it("gives the category cards the first category's products and the draft check", async () => {
    answer({ circles: [circle("lamps"), circle("wires")], categoryProducts: [card(3)] });
    canAddToDraft.mockResolvedValueOnce(true);

    const section = find(await HomePage(), CategoriesSection);

    expect(section?.props.categories).toEqual([circle("lamps"), circle("wires")]);
    expect(section?.props.first).toEqual([card(3)]);
    expect(section?.props.canAddToDraft).toBe(true);
  });

  it("still renders the cards when the first category's read failed", async () => {
    answer({ circles: [circle("lamps")], categoryProducts: null });

    expect(find(await HomePage(), CategoriesSection)?.props.first).toBeNull();
  });

  it("hides the shop now button when there are no category cards", async () => {
    answer({ circles: [], featured: null });

    expect(find(await HomePage(), HeroCard)?.props.jumpTo).toBeNull();
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

type ScriptProps = { readonly dangerouslySetInnerHTML?: { readonly __html: string } };
const storeBlocks = (page: ReactNode) =>
  findAll(page, (el) => el.type === "script").map((el) =>
    JSON.parse((el.props as ScriptProps).dangerouslySetInnerHTML!.__html),
  );

// covers: AC-8, AC-9 (spec 0026)
describe("home for search engines", () => {
  afterEach(() => vi.clearAllMocks());

  it("carries one Store block with the saved name, number, and trimmed street line", async () => {
    answer({});
    getShopContact.mockResolvedValueOnce({
      phone: null,
      address: "  شارع السلام  ",
      whatsappNumber: "970599123456",
      shopName: "S.K.F Lighting",
    });

    const blocks = storeBlocks(await HomePage());

    expect(blocks).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "Store",
        name: "S.K.F Lighting",
        url: "http://localhost:3000/",
        logo: "http://localhost:3000/brand/logo.png",
        image: "http://localhost:3000/brand/share.png",
        telephone: "+970599123456",
        address: {
          "@type": "PostalAddress",
          streetAddress: "شارع السلام",
          addressLocality: ar.Seo.town,
          addressCountry: "PS",
        },
      },
    ]);
  });

  it("keeps a reduced block when the contact read failed", async () => {
    answer({});

    const [block] = storeBlocks(await HomePage());

    expect(block.name).toBe(ar.Metadata.title);
    expect(block.telephone).toBe("+970500000000");
    expect(block.address).toEqual({
      "@type": "PostalAddress",
      addressLocality: ar.Seo.town,
      addressCountry: "PS",
    });
  });

  it("names the town in its own title, description, and share tags", async () => {
    const meta = await generateMetadata();

    expect(meta.title).toBe(ar.Seo.homeTitle);
    expect(meta.description).toBe(ar.Seo.homeDescription);
    expect(meta.alternates?.canonical).toBe("http://localhost:3000/");
    expect(meta.openGraph).toMatchObject({
      title: ar.Seo.homeTitle,
      url: "http://localhost:3000/",
      siteName: ar.Metadata.title,
      images: [{ url: "http://localhost:3000/brand/share.png", alt: ar.Seo.shopImageAlt }],
    });
  });
});
