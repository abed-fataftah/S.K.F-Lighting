import { describe, expect, it } from "vitest";
import {
  buildSearchText,
  codeQuery,
  foldedQuery,
  likePattern,
  queryWords,
  readSearchRequest,
  searchTier,
  shownQuery,
  sizeKey,
} from "./search-text";

// covers: AC-2, AC-3, AC-4, AC-7 (spec 0010)

describe("buildSearchText", () => {
  it("folds the name, the product code, and the option codes, in that order", () => {
    expect(buildSearchText("إنارةُ حديقة", "GL-7", ["GL-7-BK", "GL-7-GD"])).toBe(
      "اناره حديقه gl-7 gl-7-bk gl-7-gd",
    );
  });

  it("leaves out missing and empty parts", () => {
    expect(buildSearchText("ثريا", "CH-1", [null, "", "  "])).toBe("ثريا ch-1");
  });

  it("is a single line with single spaces", () => {
    expect(buildSearchText("ثريا   كريستال", "CH-1", [])).toBe("ثريا كريستال ch-1");
  });
});

describe("sizeKey", () => {
  it.each([
    ["60 سم", "60سم"],
    ["٦٠ سم", "60سم"],
    ["60 X 40", "60x40"],
    ["  كبير ", "كبير"],
    ["2.5 سم", "2.5سم"],
  ])("%j becomes %j", (label, key) => {
    expect(sizeKey(label)).toBe(key);
  });

  it.each([null, "", "   ", "ـــ"])("is null for %j", (label) => {
    expect(sizeKey(label)).toBeNull();
  });
});

describe("the query", () => {
  it("keeps the first q and tidies it", () => {
    expect(shownQuery(["  ثريا   ذهبية ", "ثانية"])).toBe("ثريا ذهبية");
    expect(shownQuery(undefined)).toBe("");
  });

  it("cuts the query to 100 code points before tidying", () => {
    const long = "😀".repeat(120);
    expect(Array.from(shownQuery(long))).toHaveLength(100);
  });

  it("folds the query the way the stored text is folded", () => {
    expect(foldedQuery("إنارةُ")).toBe(foldedQuery("انارة"));
  });

  it("splits words, drops duplicates, and keeps the first 8", () => {
    expect(queryWords("ثريا ثريا ذهبي")).toEqual(["ثريا", "ذهبي"]);
    expect(queryWords("a b c d e f g h i j")).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("uppercases the folded query for codes, so full width forms match too", () => {
    expect(codeQuery(foldedQuery("ｌ-１０２"))).toBe("L-102");
  });
});

describe("readSearchRequest", () => {
  it("is none without a query", () => {
    expect(readSearchRequest(undefined)).toEqual({ kind: "none" });
    expect(readSearchRequest("   ")).toEqual({ kind: "none" });
  });

  it("is short under 2 folded characters, keeping the shown text", () => {
    expect(readSearchRequest("ث")).toEqual({ kind: "short", text: "ث" });
    // Marks fold away, so a letter with a mark is still one character.
    expect(readSearchRequest("ثُ")).toEqual({ kind: "short", text: "ثُ" });
  });

  it("searches the whole query from 2 characters, even with a 1 character word", () => {
    expect(readSearchRequest("L 1")).toEqual({
      kind: "search",
      text: "L 1",
      folded: "l 1",
      words: ["l", "1"],
      code: "L 1",
    });
  });
});

describe("likePattern", () => {
  it("wraps the word for a substring match", () => {
    expect(likePattern("ثريا")).toBe("%ثريا%");
  });

  it("escapes %, _, and the backslash", () => {
    expect(likePattern(String.raw`50%_a\b`)).toBe(String.raw`%50\%\_a\\b%`);
  });
});

describe("searchTier", () => {
  const product = {
    code: "L-102",
    optionCodes: ["L-102-GD", null],
    searchText: "ثريا كريستال l-102 l-102-gd",
  };
  const query = (text: string) => {
    const folded = foldedQuery(text);
    return { folded, code: codeQuery(folded) };
  };

  it.each([
    ["the exact product code", "l-102", 0],
    ["an exact option code", "L-102-GD", 0],
    ["the start of a code", "l-10", 1],
    ["the start of the name", "ثريا كري", 2],
    ["a word inside the text", "كريستال", 3],
  ] as const)("is tier %s for %s", (_name, text, tier) => {
    expect(searchTier(product, query(text))).toBe(tier);
  });
});
