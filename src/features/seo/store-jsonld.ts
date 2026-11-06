import { contactLine, type ShopContact } from "@/features/shell/contact";
import { routes } from "@/lib/routes";
import { SHOP_IMAGE, SHOP_LOGO_PATH } from "./share";

// Home's `Store` block (spec 0026 AC-9): what Google reads for local results.

export const SHOP_COUNTRY = "PS";

export function storeJsonLd(input: {
  readonly name: string;
  readonly siteUrl: string;
  /** Digits only, country code first (spec 0025 AC-4). */
  readonly whatsappNumber: string;
  /** The street line, already trimmed; null leaves it out. */
  readonly streetAddress: string | null;
  readonly town: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: input.name,
    url: `${input.siteUrl}${routes.home}`,
    logo: `${input.siteUrl}${SHOP_LOGO_PATH}`,
    image: `${input.siteUrl}${SHOP_IMAGE.path}`,
    telephone: `+${input.whatsappNumber}`,
    address: {
      "@type": "PostalAddress",
      ...(input.streetAddress ? { streetAddress: input.streetAddress } : {}),
      addressLocality: input.town,
      addressCountry: SHOP_COUNTRY,
    },
  };
}

/**
 * The block from the shop's saved details: the saved name, else the site title; the street line
 * after `contactLine`. A failed contact read (all nulls) still gives the reduced block (AC-9).
 */
export function storeFromContact(
  contact: ShopContact,
  input: {
    readonly siteUrl: string;
    readonly fallbackName: string;
    readonly whatsappNumber: string;
    readonly town: string;
  },
) {
  return storeJsonLd({
    name: contact.shopName?.trim() || input.fallbackName,
    siteUrl: input.siteUrl,
    whatsappNumber: input.whatsappNumber,
    streetAddress: contactLine(contact)?.address ?? null,
    town: input.town,
  });
}
