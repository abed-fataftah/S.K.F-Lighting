import { describe, expect, it } from "vitest";
import { readCountRequest } from "./count-request";

// covers: AC-12, AC-16 (spec 0010)

const read = (query: string) => readCountRequest(new URLSearchParams(query));

describe("readCountRequest", () => {
  it.each([
    ["neither scope", ""],
    ["both scopes", "main=a&q=ثريا"],
    ["sub without main", "sub=b"],
    ["sub with q", "sub=b&q=ثريا"],
    ["an empty main", "main=&sub=b"],
  ])("is a bad request with %s", (_name, query) => {
    expect(read(query)).toEqual({ kind: "bad_request" });
  });

  it("reads a main and sub with the filters", () => {
    expect(read("main=ثريات&sub=كريستال&colour=ذهبي&min=100")).toEqual({
      kind: "category",
      main: "ثريات",
      sub: "كريستال",
      filters: { sizes: [], colours: ["ذهبي"], min: 100, max: null, available: false },
    });
  });

  it("reads a main alone with no sub", () => {
    expect(read("main=ثريات")).toMatchObject({ kind: "category", main: "ثريات", sub: null });
  });

  it("is too short under 2 folded characters, so no read runs", () => {
    expect(read("q=ث")).toEqual({ kind: "too_short" });
    expect(read("q=")).toEqual({ kind: "too_short" });
  });

  it("folds q as the search page does", () => {
    expect(read("q=إنارةُ&available=1")).toMatchObject({
      kind: "search",
      text: "إنارةُ",
      folded: "اناره",
      words: ["اناره"],
      filters: { available: true },
    });
  });
});
