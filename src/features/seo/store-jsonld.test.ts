import { describe, expect, it } from "vitest";
import { noContact } from "@/features/shell/contact";
import { storeFromContact } from "./store-jsonld";

// covers: AC-9 (spec 0026)
describe("storeFromContact", () => {
  const input = {
    siteUrl: "https://skf.example",
    fallbackName: "S.K.F للإنارة",
    whatsappNumber: "970599123456",
    town: "الخليل",
  };

  it("publishes the saved name, the trimmed street line, and the number with a plus", () => {
    expect(
      storeFromContact(
        { ...noContact, shopName: "S.K.F Lighting", address: "  شارع السلام ", phone: "0599" },
        input,
      ),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "Store",
      name: "S.K.F Lighting",
      url: "https://skf.example/",
      logo: "https://skf.example/brand/logo.png",
      image: "https://skf.example/brand/share.png",
      telephone: "+970599123456",
      address: {
        "@type": "PostalAddress",
        streetAddress: "شارع السلام",
        addressLocality: "الخليل",
        addressCountry: "PS",
      },
    });
  });

  it("falls back to the site title and leaves a blank street line out", () => {
    const block = storeFromContact({ ...noContact, shopName: "  ", address: "   " }, input);

    expect(block.name).toBe("S.K.F للإنارة");
    expect(block.address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "الخليل",
      addressCountry: "PS",
    });
  });
});
