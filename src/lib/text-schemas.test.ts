import { describe, expect, it } from "vitest";
import { z } from "zod";
import ar from "@/i18n/messages/ar.json";
import { normalizePhone } from "./phone";
import { arabicText, digitsField, textErrors, tidiedText } from "./text-schemas";

// covers: AC-9, AC-10, AC-11 (spec 0005)

const issueOf = (result: { success: boolean; error?: z.ZodError }) =>
  result.error?.issues[0]?.message;

describe("arabicText", () => {
  const name = arabicText({ min: 2, max: 120 });

  it("saves the tidied text", () => {
    expect(name.parse("  ثريـــا   كريستال\u200f ")).toBe("ثريا كريستال");
  });

  it.each(["ثريا كريستال Philips 60W", "ثريا كريستال", "لمبة LED ٩ واط"])("accepts %j", (text) => {
    expect(name.safeParse(text).success).toBe(true);
  });

  it.each(["Philips 60W", "١٢٣", "S.K.F lighting"])("asks for Arabic in %j", (text) => {
    expect(issueOf(name.safeParse(text))).toBe("arabic_required");
  });

  it("rejects tatweel only, which tidies to nothing", () => {
    expect(issueOf(name.safeParse("ــــ"))).toBe("too_short");
    expect(issueOf(arabicText({ min: 0, max: 10 }).safeParse("ــــ"))).toBe("arabic_required");
  });

  it("lets the brand sit beside Arabic in a shop name line", () => {
    expect(arabicText({ max: 80 }).safeParse("S.K.F lighting للإنارة").success).toBe(true);
  });

  it("checks length after tidying, in code points", () => {
    expect(issueOf(name.safeParse("  ب  "))).toBe("too_short");
    expect(issueOf(name.safeParse("ثـــــــــا"))).toBeUndefined();
    const short = arabicText({ max: 3 });
    expect(short.safeParse("ثريـــا").success).toBe(false);
    expect(issueOf(short.safeParse("ثريا"))).toBe("too_long");
    // Tashkeel are code points too, so they count against the limit.
    expect(issueOf(short.safeParse("ثُرَ"))).toBe("too_long");
  });

  it("puts min and max on the issue for the message", () => {
    const issue = name.safeParse("ب").error?.issues[0];
    expect(issue).toMatchObject({ message: "too_short", params: { min: 2 } });
  });

  it("treats a blank optional field as not filled", () => {
    const description = arabicText({ max: 4000, multiline: true, optional: true });
    expect(description.parse("  \u200f\n ")).toBeUndefined();
    expect(description.parse(undefined)).toBeUndefined();
    expect(issueOf(description.safeParse("Philips"))).toBe("arabic_required");
    expect(description.parse("سطر\n\n\n\nسطر")).toBe("سطر\n\nسطر");
  });

  it("fails an empty required field as too short", () => {
    expect(issueOf(arabicText({ max: 10 }).safeParse(" "))).toBe("too_short");
  });
});

describe("tidiedText", () => {
  it("keeps digits as typed and does not ask for Arabic", () => {
    const notes = tidiedText({ max: 500, multiline: true, optional: true });
    expect(notes.parse(" Call after 5 ")).toBe("Call after 5");
    expect(notes.parse("الطابق ٣")).toBe("الطابق ٣");
  });

  it("flags text over the limit", () => {
    expect(issueOf(tidiedText({ max: 5 }).safeParse("abcdef"))).toBe("too_long");
  });
});

describe("digitsField", () => {
  const phone = digitsField(
    (clean) => ({ typed: clean, e164: normalizePhone(clean) }),
    z.object({ typed: z.string(), e164: z.string() }),
  );

  it.each([
    ["٠٥٩٩١٢٣٤٥٦", "0599123456"],
    ["۰۵۹۹۱۲۳۴۵۶", "0599123456"],
    ["\u200f0599 123 456", "0599 123 456"],
  ])("cleans the phone %j to %j and keeps it E.164", (typed, clean) => {
    expect(phone.parse(typed)).toEqual({ typed: clean, e164: "+970599123456" });
  });

  it("fails a phone that is not a mobile", () => {
    expect(phone.safeParse("٠٢ ٢٧٤ ١٢٣٤").success).toBe(false);
  });

  it("uppercases a product code typed with Arabic digits", () => {
    const code = digitsField((clean) => clean.toUpperCase(), z.string().regex(/^[A-Z]+-\d+$/));
    expect(code.parse(" ch-١٠٢٠ ")).toBe("CH-1020");
  });

  it("reads a price typed with Arabic separators", () => {
    const price = digitsField((clean) => clean, z.string());
    expect(price.parse("١٬٢٥٠")).toBe("1,250");
  });
});

describe("textErrors", () => {
  it("maps every issue to a Validation message in ar.json", () => {
    for (const key of Object.values(textErrors)) {
      expect(ar.Validation[key]).toMatch(/[؀-ۿ]/);
    }
  });
});
