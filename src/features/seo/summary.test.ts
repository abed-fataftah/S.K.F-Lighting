import { describe, expect, it } from "vitest";
import { stripMarkdown, summarize } from "./summary";

// covers: AC-15 (spec 0009); AC-10 (spec 0026)
describe("summarize", () => {
  it("collapses whitespace and cuts at 155 code points", () => {
    expect(summarize("  ثريا\n\nكريستال \t كبيرة ")).toBe("ثريا كريستال كبيرة");
    expect(Array.from(summarize("😀".repeat(200))!)).toHaveLength(155);
  });

  it("gives null for no text", () => {
    expect(summarize(null)).toBeNull();
    expect(summarize(" \n ")).toBeNull();
  });
});

describe("stripMarkdown", () => {
  it("keeps only the words and the link text of a policy body", () => {
    const body = [
      "# سياسة الإرجاع",
      "",
      "يمكنك **إرجاع** المنتج خلال _سبعة_ أيام.",
      "",
      "- المنتج بحالته الأصلية",
      "* مع الفاتورة",
      "1. تواصل معنا",
      "",
      "> ملاحظة مهمة",
      "",
      "---",
      "",
      "اقرأ [شروط الاستخدام](/policies/terms) و ~~القديم~~ و `الرمز`.",
    ].join("\n");

    expect(summarize(stripMarkdown(body))).toBe(
      "سياسة الإرجاع يمكنك إرجاع المنتج خلال سبعة أيام. المنتج بحالته الأصلية مع الفاتورة تواصل معنا ملاحظة مهمة اقرأ شروط الاستخدام و القديم و الرمز.",
    );
  });

  it("keeps an image's alt text and a bare link's address", () => {
    expect(stripMarkdown("![شعار](/a.png) <https://skf.example>")).toBe("شعار https://skf.example");
  });

  it("leaves an empty body empty, so the page falls back", () => {
    expect(summarize(stripMarkdown(""))).toBeNull();
    expect(summarize(stripMarkdown("#  \n\n---\n"))).toBeNull();
  });
});
