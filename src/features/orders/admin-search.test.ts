import { describe, expect, it } from "vitest";
import { classifyOrderSearch } from "./admin-search";

// covers: AC-13 (spec 0014)

const classify = (text: string) => classifyOrderSearch(text, 2026);

describe("classifyOrderSearch", () => {
  it("reads a full order number, with Arabic digits too", () => {
    expect(classify("26-00042")).toEqual({ kind: "number", number: "26-00042" });
    expect(classify(" 25-123456 ")).toEqual({ kind: "number", number: "25-123456" });
    expect(classify("٢٦-٠٠٠٤٢")).toEqual({ kind: "number", number: "26-00042" });
  });

  it("reads one to seven digits as this year's short form", () => {
    expect(classify("42")).toEqual({ kind: "number", number: "26-00042" });
    expect(classify("٤٢")).toEqual({ kind: "number", number: "26-00042" });
    expect(classify("123456")).toEqual({ kind: "number", number: "26-123456" });
    expect(classify("1234567")).toEqual({ kind: "number", number: "26-1234567" });
    expect(classifyOrderSearch("7", 2027)).toEqual({ kind: "number", number: "27-00007" });
  });

  it("reads a phone in any typed form", () => {
    const phone = { kind: "phone", e164: "+970599123456" };
    expect(classify("0599123456")).toEqual(phone);
    expect(classify("0599 123 456")).toEqual(phone);
    expect(classify("+970599123456")).toEqual(phone);
    expect(classify("+972599123456")).toEqual(phone);
    expect(classify("٠٥٩٩١٢٣٤٥٦")).toEqual(phone);
    // Nine digits is a local number without its 0, never a short form.
    expect(classify("599123456")).toEqual(phone);
    expect(classify("0541234567")).toEqual({ kind: "phone", e164: "+972541234567" });
  });

  it("refuses text, an empty field, zero, an eight digit number, and a spaced number", () => {
    for (const text of ["", "   ", "أحمد", "0", "0000000", "12345678", "26 - 00042", "26–00042"]) {
      expect(classify(text)).toEqual({ kind: "invalid" });
    }
  });
});
