import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ar from "@/i18n/messages/ar.json";

// next/navigation's notFound throws a special error that Next turns into a 404; stand in for it.
vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// next/font only works inside the Next build; stand in for the font loader.
vi.mock("next/font/google", () => ({
  Almarai: () => ({ variable: "almarai-variable", className: "almarai" }),
}));

// The shell's server reads: no database in a unit test.
vi.mock("server-only", () => ({}));
vi.mock("@/features/shell/server/shop-contact", () => ({
  getShopContact: async () => ({ phone: null, address: null }),
}));
vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "970500000000");

// Translations come from the real Arabic catalog; only next-intl's request plumbing is replaced.
vi.mock("next-intl/server", () => ({
  getTranslations:
    async ({ namespace }: { namespace: keyof typeof ar }) =>
    (key: string) =>
      (ar[namespace] as Record<string, string>)[key],
}));

const { default: StorefrontLayout, generateMetadata } = await import("./layout");

type Props = Parameters<typeof StorefrontLayout>[0];
type Element = ReactElement<{
  children?: ReactNode;
  lang?: string;
  dir?: string;
  id?: string;
  className?: string;
}>;
const props = (locale: string, children: ReactNode = null) =>
  ({ params: Promise.resolve({ locale }), children }) as unknown as Props;

// The layout returns <HtmlDocument>; call it to reach the <html> element it renders.
async function renderHtml(locale: string, children: ReactNode = null) {
  const doc = (await StorefrontLayout(props(locale, children))) as Element;
  return (doc.type as (p: typeof doc.props) => Element)(doc.props);
}

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

// covers: DW-2 (spec 0001 verify.md, UI steps: `/` is Arabic, right to left); AC-4 (spec 0003)
describe("storefront layout", () => {
  it("renders the page as Arabic, laid out right to left, in Almarai", async () => {
    const html = await renderHtml("ar");

    expect(html.type).toBe("html");
    expect(html.props).toMatchObject({ lang: "ar", dir: "rtl" });
    expect(html.props.className?.split(" ")).toContain("almarai-variable");
  });

  it("tells Base UI the direction and puts the page inside main#main", async () => {
    const page = createElement("section", null, "محتوى الصفحة");
    const html = await renderHtml("ar", page);

    const body = html.props.children as Element;
    const direction = body.props.children as ReactElement<{ direction: string; children: Element }>;
    expect(body.type).toBe("body");
    expect(direction.props.direction).toBe("rtl");
    expect(direction.props.children.props.className).toBe("isolate");

    // Walk the element tree (without rendering the client parts) to the page's <main>.
    const main = findElement(html, (el) => el.type === "main");
    expect(main?.props.id).toBe("main");
    expect(renderToStaticMarkup(main!.props.children as ReactElement)).toBe(
      "<section>محتوى الصفحة</section>",
    );
  });

  it.each(["en", "fr", "admin"])(
    "shows the not found page for the unknown locale %s",
    async (locale) => {
      await expect(StorefrontLayout(props(locale))).rejects.toThrow("NEXT_NOT_FOUND");
    },
  );
});

describe("storefront metadata", () => {
  it("uses the Arabic shop name and description", async () => {
    const metadata = await generateMetadata(props("ar"));

    expect(metadata).toEqual({ title: ar.Metadata.title, description: ar.Metadata.description });
  });

  it("returns no metadata for an unknown locale instead of throwing", async () => {
    await expect(generateMetadata(props("en"))).resolves.toEqual({});
  });
});
