import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import ar from "@/i18n/messages/ar.json";
import { PageErrorState } from "@/components/error-state";
import { PageFrame } from "@/components/page-frame";

// No database in a unit test: the head read fails, as it does when the database is down.
vi.mock("server-only", () => ({}));
vi.mock("../server/queries", () => ({
  CATEGORY_PAGE_SIZE: 24,
  getCategoryHead: async () => {
    throw new Error("down");
  },
  getCategoryList: async () => {
    throw new Error("down");
  },
}));
vi.mock("@/features/shell/server/shop-contact", () => ({
  getWhatsappNumber: async () => "970500000000",
}));
vi.mock("@/features/drafts/server/guard", () => ({ canAddToDraft: async () => false }));
vi.mock("@/server/monitoring/report", () => ({ reportError: async () => {} }));
vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "970500000000");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

// Translations come from the real Arabic catalog; only next-intl's request plumbing is replaced.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: keyof typeof ar) => (key: string) =>
    (ar[namespace] as Record<string, string>)[key],
}));

const { CategoryPage } = await import("./category-page");

type Frame = ReactElement<{ width: string; children: ReactElement<{ heading: string }> }>;

// covers: AC-17 (spec 0029: the error page sits in the narrow column)
describe("category page whose head read failed", () => {
  it("shows the error card alone, as the page heading, in the narrow column", async () => {
    const page = (await CategoryPage({
      address: { main: "anything", sub: null, params: {} },
    })) as Frame;

    expect(page.type).toBe(PageFrame);
    expect(page.props.width).toBe("form");
    expect(page.props.children.type).toBe(PageErrorState);
    expect(page.props.children.props.heading).toBe("h1");
  });
});
