import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ar from "@/i18n/messages/ar.json";

// next/navigation's notFound throws a special error that Next turns into a 404; stand in for it.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// Translations come from the real Arabic catalog; only next-intl's request plumbing is replaced.
vi.mock("next-intl/server", () => ({
  getTranslations:
    async ({ namespace }: { namespace: keyof typeof ar }) =>
    (key: string) =>
      (ar[namespace] as Record<string, string>)[key],
}));

const { default: StorefrontLayout, generateMetadata } = await import("./layout");

type Props = Parameters<typeof StorefrontLayout>[0];
type Element = ReactElement<{ children?: ReactNode; lang?: string; dir?: string }>;
const props = (locale: string, children: ReactNode = null) =>
  ({ params: Promise.resolve({ locale }), children }) as unknown as Props;

// covers: DW-2 (spec 0001 verify.md, UI steps: `/` is Arabic, right to left)
describe("storefront layout", () => {
  it("renders the page as Arabic, laid out right to left", async () => {
    const html = (await StorefrontLayout(props("ar"))) as Element;

    expect(html.type).toBe("html");
    expect(html.props).toMatchObject({ lang: "ar", dir: "rtl" });
  });

  it("renders the page content inside the body", async () => {
    const page = createElement("main", null, "محتوى الصفحة");
    const html = (await StorefrontLayout(props("ar", page))) as Element;

    // Outside the Next server runtime NextIntlClientProvider cannot infer its locale,
    // so render only what it wraps: the body's subtree below the provider.
    const body = html.props.children as Element;
    const provider = body.props.children as Element;
    expect(body.type).toBe("body");
    expect(renderToStaticMarkup(provider.props.children as ReactElement)).toBe(
      "<main>محتوى الصفحة</main>",
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
