import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "@/components/error-state";
import StorefrontError from "./error";

vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "970500000000");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

type Card = ReactElement<{ onRetry: () => void; whatsappNumber: string }>;
const cardOf = (page: ReactElement<{ children: Card }>) => page.props.children;

// covers: AC-15 (spec 0003: a failed storefront page shows the error card, not a bare 500)
describe("storefront error page", () => {
  it("shows the error card with the shop's WhatsApp number", () => {
    const page = StorefrontError({ error: new Error("down"), retry: () => {} });

    const card = cardOf(page);
    expect(card.type).toBe(ErrorState);
    expect(card.props.whatsappNumber).toBe("970500000000");
  });

  it("hands retry straight to Next, so pressing it renders the page again", () => {
    const retry = vi.fn();
    const page = StorefrontError({ error: new Error("down"), retry });

    cardOf(page).props.onRetry();

    expect(retry).toHaveBeenCalledOnce();
  });

  it("never shows the error's own message to the shopper", () => {
    const page = StorefrontError({
      error: new Error("relation orders: 0599 123 456"),
      retry: () => {},
    });

    expect(JSON.stringify(cardOf(page).props)).not.toContain("0599");
  });
});
