import { describe, expect, it } from "vitest";
import { classifyCustomerSearch } from "./search";

// covers: AC-3 (spec 0019)
describe("classifyCustomerSearch", () => {
  it("reads anything with @ as an email, lower cased and tidied", () => {
    expect(classifyCustomerSearch("  Sami@Example.COM ")).toEqual({
      kind: "email",
      text: "sami@example.com",
    });
    expect(classifyCustomerSearch("@gmail")).toEqual({ kind: "email", text: "@gmail" });
  });

  it.each([
    ["0599123456", "+970599123456"],
    ["٠٥٩٩ ١٢٣ ٤٥٦", "+970599123456"],
    ["+972 599 123 456", "+970599123456"],
    ["599123456", "+970599123456"],
  ])("reads the full phone %s", (text, e164) => {
    expect(classifyCustomerSearch(text)).toEqual({ kind: "phone", e164 });
  });

  it.each(["0599", "٠٥٩٩١٢", "+970", "12345", "- ( )"])(
    "refuses digits that are not a full phone: %s",
    (text) => {
      expect(classifyCustomerSearch(text)).toEqual({ kind: "invalid" });
    },
  );

  it("folds a name the way the catalog search does", () => {
    expect(classifyCustomerSearch(" أحمد  ")).toEqual({ kind: "name", folded: "احمد" });
    expect(classifyCustomerSearch("فاطمة")).toEqual({ kind: "name", folded: "فاطمه" });
    expect(classifyCustomerSearch("مُصطفى")).toEqual({ kind: "name", folded: "مصطفي" });
    expect(classifyCustomerSearch("Sami")).toEqual({ kind: "name", folded: "sami" });
    expect(classifyCustomerSearch("علي 2")).toEqual({ kind: "name", folded: "علي 2" });
  });

  it.each(["", "   ", "س", "a"])("refuses a name under two characters: %j", (text) => {
    expect(classifyCustomerSearch(text)).toEqual({ kind: "invalid" });
  });
});
