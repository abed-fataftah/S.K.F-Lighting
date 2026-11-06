import { describe, expect, it } from "vitest";
import {
  addZoneSchema,
  normalizeShopPhone,
  normalizeWhatsapp,
  parseFeeShekels,
  savePolicySchema,
  shopContactSchema,
} from "./schemas";

// covers: AC-2, AC-5, AC-10 (spec 0025)
describe("normalizeWhatsapp", () => {
  it("keeps only digits from a number typed with a plus, spaces, dashes, and brackets", () => {
    expect(normalizeWhatsapp("+970 599-123-456")).toEqual({ ok: true, digits: "970599123456" });
    expect(normalizeWhatsapp("(970) 599 123 456")).toEqual({ ok: true, digits: "970599123456" });
  });

  it("accepts Arabic digits", () => {
    expect(normalizeWhatsapp("٩٧٠٥٩٩١٢٣٤٥٦")).toEqual({ ok: true, digits: "970599123456" });
  });

  it("checks in order: empty, then a leading 0, then the digit count", () => {
    expect(normalizeWhatsapp("  ")).toEqual({ ok: false, error: "whatsapp_required" });
    expect(normalizeWhatsapp("0599 123 456")).toEqual({
      ok: false,
      error: "whatsapp_country_code",
    });
    expect(normalizeWhatsapp("00970599123456")).toEqual({
      ok: false,
      error: "whatsapp_country_code",
    });
    expect(normalizeWhatsapp("9705991")).toEqual({ ok: false, error: "whatsapp_invalid" });
    expect(normalizeWhatsapp("9".repeat(16))).toEqual({ ok: false, error: "whatsapp_invalid" });
    expect(normalizeWhatsapp("970 599 abc")).toEqual({ ok: false, error: "whatsapp_invalid" });
  });

  it("takes 8 and 15 digits, the edges", () => {
    expect(normalizeWhatsapp("97059912")).toEqual({ ok: true, digits: "97059912" });
    expect(normalizeWhatsapp("9".repeat(15))).toEqual({ ok: true, digits: "9".repeat(15) });
  });
});

describe("normalizeShopPhone", () => {
  it("stores the phone as typed after tidying, with Western digits", () => {
    expect(normalizeShopPhone("  ٠٢ 238  1234 ")).toBe("02 238 1234");
    expect(normalizeShopPhone("+970 (2) 238-1234")).toBe("+970 (2) 238-1234");
  });

  it("is null when blank, and invalid outside 7 to 15 digits or with letters", () => {
    expect(normalizeShopPhone(" ")).toBeNull();
    expect(normalizeShopPhone("123456")).toBe("invalid");
    expect(normalizeShopPhone("1234567")).toBe("1234567");
    expect(normalizeShopPhone("1".repeat(16))).toBe("invalid");
    expect(normalizeShopPhone("02 238 ext 1")).toBe("invalid");
  });
});

describe("parseFeeShekels", () => {
  it("turns whole shekels from 0 to 500 into agorot", () => {
    expect(parseFeeShekels("0")).toBe(0);
    expect(parseFeeShekels("20")).toBe(2000);
    expect(parseFeeShekels("500")).toBe(50_000);
    expect(parseFeeShekels("٢٠")).toBe(2000);
  });

  it("refuses empty, decimals, and anything above 500", () => {
    expect(parseFeeShekels("")).toBeNull();
    expect(parseFeeShekels("501")).toBeNull();
    expect(parseFeeShekels("12.5")).toBeNull();
    expect(parseFeeShekels("-1")).toBeNull();
    expect(parseFeeShekels("1000")).toBeNull();
  });
});

describe("shopContactSchema", () => {
  it("saves the WhatsApp digits, and blank phone and address as null", () => {
    expect(
      shopContactSchema.parse({
        whatsappNumber: "+970 599 123 456",
        contactPhone: "",
        address: " ",
      }),
    ).toEqual({ whatsappNumber: "970599123456", contactPhone: null, address: null });
  });

  it("names each field that fails", () => {
    const result = shopContactSchema.safeParse({
      whatsappNumber: "0599",
      contactPhone: "12",
      address: "١٢٣٤٥",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ["whatsappNumber", "whatsapp_country_code"],
      ["contactPhone", "phone_invalid"],
      ["address", "address_letters"],
    ]);
  });
});

describe("addZoneSchema", () => {
  it("tidies the names and gives the fee in agorot", () => {
    expect(addZoneSchema.parse({ name: " القدس  ", shortName: "القدس", feeShekels: "٣٠" })).toEqual(
      { name: "القدس", shortName: "القدس", fee: 3000 },
    );
  });

  it("refuses an empty name, a long short name, and a bad fee", () => {
    const result = addZoneSchema.safeParse({
      name: " ",
      shortName: "x".repeat(13),
      feeShekels: "12.5",
    });
    expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ["name", "required"],
      ["shortName", "too_long"],
      ["feeShekels", "fee_invalid"],
    ]);
  });
});

describe("savePolicySchema", () => {
  it("keeps the body's lines and refuses an empty title or body, or another slug", () => {
    expect(
      savePolicySchema.parse({ slug: "terms", title: " الشروط ", body: "## أ\nسطر", version: 2 }),
    ).toEqual({ slug: "terms", title: "الشروط", body: "## أ\nسطر", version: 2 });
    const result = savePolicySchema.safeParse({ slug: "about", title: "", body: " ", version: 0 });
    expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ["slug", expect.any(String)],
      ["title", "title_required"],
      ["body", "body_required"],
    ]);
  });
});
