import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

// covers: AC-10 (spec 0002)
describe("normalizePhone", () => {
  it.each([
    ["0599 123 456", "+970599123456"],
    ["+970599123456", "+970599123456"],
    ["00970599123456", "+970599123456"],
    ["0599-123-456", "+970599123456"],
    ["(0599) 123.456", "+970599123456"],
    ["0561234567", "+970561234567"],
    ["054 123 4567", "+972541234567"],
    ["0521234567", "+972521234567"],
    ["+972 54 123 4567", "+972541234567"],
    ["00972541234567", "+972541234567"],
  ])("turns %s into %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it("gives the same value for every way of writing one number", () => {
    const forms = ["0599 123 456", "+970599123456", "00970599123456", "+970 599-123-456"];

    expect(new Set(forms.map(normalizePhone))).toEqual(new Set(["+970599123456"]));
  });

  it.each([
    ["", "empty"],
    ["02 274 1234", "a landline"],
    ["+97022741234", "an international landline"],
    ["059912345", "one digit short"],
    ["05991234567", "one digit long"],
    ["+1 202 555 0100", "another country"],
    ["0599a23456", "a letter in it"],
    ["970599123456", "a country code without + or 00"],
    ["٠٥٩٩١٢٣٤٥٦", "Arabic numerals (not accepted yet; feature 13 decides)"],
  ])("returns null for %s (%s)", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});
