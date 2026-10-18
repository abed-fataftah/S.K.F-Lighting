import { describe, expect, it } from "vitest";
import ar from "./messages/ar.json";

type Messages = { [key: string]: string | Messages };

function leaves(messages: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [p, v] of leaves(value, path)) out.set(p, v);
  }
  return out;
}

describe("Arabic message catalog", () => {
  const catalog = leaves(ar);

  it("has no empty strings", () => {
    const empty = [...catalog].filter(([, value]) => value.trim() === "").map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("writes every sentence in Arabic script", () => {
    expect(ar.Home.comingSoon).toMatch(/[؀-ۿ]/);
    expect(ar.Metadata.description).toMatch(/[؀-ۿ]/);
  });

  // The shop is Arabic only (spec 0001, amended 2026-10-17), so no message may be left in English.
  it("has Arabic text in every message, with no English only strings", () => {
    const notArabic = [...catalog].filter(([, value]) => !/[؀-ۿ]/.test(value)).map(([key]) => key);

    expect(notArabic).toEqual([]);
  });
});
