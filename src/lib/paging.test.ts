import { describe, expect, it } from "vitest";
import { pageWindow, parsePage, splitPage } from "./paging";

// covers: AC-13 (spec 0004); AC-1 (spec 0006)
describe("parsePage", () => {
  it.each([
    [undefined, 1],
    ["", 1],
    ["abc", 1],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["2e3", 1],
    ["99999999999999999999", 1],
    ["1", 1],
    ["3", 3],
    [["4", "5"], 4],
  ])("reads %j as page %i", (value, page) => {
    expect(parsePage(value)).toBe(page);
  });
});

describe("pageWindow and splitPage", () => {
  it("reads one row more than the page size from the page start and shows the page", () => {
    expect(pageWindow(1, 50)).toEqual({ limit: 51, offset: 0 });
    expect(pageWindow(3, 50)).toEqual({ limit: 51, offset: 100 });
    expect(pageWindow(2, 10)).toEqual({ limit: 11, offset: 10 });

    const rows = Array.from({ length: 51 }, (_, i) => i);
    expect(splitPage(rows, 50)).toEqual({ rows: rows.slice(0, 50), hasNext: true });
    expect(splitPage(rows.slice(0, 50), 50)).toEqual({ rows: rows.slice(0, 50), hasNext: false });
  });
});
