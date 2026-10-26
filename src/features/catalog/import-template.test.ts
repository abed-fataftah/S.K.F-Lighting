import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS } from "./import-schemas";
import { listRows, problemsSheet, templateSheets } from "./import-template";
import type { EditorLookups } from "./server/admin-queries";

// covers: AC-2, AC-15 (spec 0007). The template and the problems file as plain data; the import
// reads the same headers, so a drift here breaks every filled template.

const lookups: EditorLookups = {
  categories: [
    {
      id: "m1",
      name: "ثريات",
      isVisible: true,
      children: [
        { id: "s1", name: "كريستال", isVisible: true },
        { id: "s2", name: "حديثة", isVisible: false },
      ],
    },
    { id: "m2", name: "أباجورات", isVisible: true, children: [] },
  ],
  colours: [
    { id: "c1", name: "ذهبي" },
    { id: "c2", name: "فضي" },
  ],
};

const HEADERS = IMPORT_COLUMNS.map((column) => column.header);
const CODE = HEADERS.indexOf("الكود");
const SIZE = HEADERS.indexOf("الحجم");
const COLOURS = HEADERS.indexOf("الألوان");

describe("templateSheets (AC-2)", () => {
  const [products, example, lists] = templateSheets(lookups);

  it("has the three sheets in order", () => {
    expect(templateSheets(lookups).map((sheet) => sheet.name)).toEqual([
      "المنتجات",
      "مثال",
      "القوائم",
    ]);
  });

  it("gives المنتجات only the header row, its code column as text for empty rows too", () => {
    expect(products.rows).toEqual([HEADERS]);
    expect(products.textColumn).toBe(CODE);
    expect(products.textRows).toBeGreaterThan(0);
    expect(products.widths).toHaveLength(HEADERS.length);
  });

  it("gives مثال the same headers and two products, one with 2 sizes and 2 colours", () => {
    const [headers, ...rows] = example.rows;
    expect(headers).toEqual(HEADERS);
    expect(example.textColumn).toBe(CODE);
    expect(rows.every((row) => row.length === HEADERS.length)).toBe(true);

    const codes = [...new Set(rows.map((row) => row[CODE]))];
    expect(codes).toHaveLength(2);
    const sized = rows.filter((row) => row[CODE] === codes[0]);
    expect(sized.map((row) => row[SIZE])).toHaveLength(2);
    expect(String(sized[0][COLOURS]).split(/[,،]/)).toHaveLength(2);
    const simple = rows.filter((row) => row[CODE] === codes[1]);
    expect(simple).toHaveLength(1);
    expect(simple[0][SIZE]).toBeNull();
  });

  it("heads القوائم with the three column names", () => {
    expect(lists.rows[0]).toEqual(["القسم الرئيسي", "القسم الفرعي", "الألوان"]);
    expect(lists.widths).toHaveLength(3);
  });
});

describe("listRows (AC-2)", () => {
  it("lists each main with an empty sub, then each sub with its main, colours beside", () => {
    expect(listRows(lookups)).toEqual([
      ["ثريات", null, "ذهبي"],
      ["أباجورات", null, "فضي"],
      ["ثريات", "كريستال", null],
      ["ثريات", "حديثة", null],
    ]);
  });

  it("runs as long as the colours when there are more colours than categories", () => {
    const rows = listRows({
      categories: [],
      colours: [
        { id: "c1", name: "ذهبي" },
        { id: "c2", name: "فضي" },
      ],
    });
    expect(rows).toEqual([
      [null, null, "ذهبي"],
      [null, null, "فضي"],
    ]);
  });

  it("gives no rows for a shop with no categories and no colours", () => {
    expect(listRows({ categories: [], colours: [] })).toEqual([]);
  });
});

describe("problemsSheet (AC-15)", () => {
  it("puts the headers first and each problem in the column order given", () => {
    const sheet = problemsSheet(
      "المشاكل",
      ["الصف", "الكود", "الملف", "المشكلة", "الإجراء"],
      [
        { row: "4", code: "CH-1", file: "", problem: "سعر غير صحيح", fix: "اكتب رقمًا" },
        { row: "", code: "", file: "IMG_1.jpg", problem: "اسم غير صالح", fix: "سمّه بالكود" },
      ],
    );
    expect(sheet.name).toBe("المشاكل");
    expect(sheet.rows).toEqual([
      ["الصف", "الكود", "الملف", "المشكلة", "الإجراء"],
      ["4", "CH-1", "", "سعر غير صحيح", "اكتب رقمًا"],
      ["", "", "IMG_1.jpg", "اسم غير صالح", "سمّه بالكود"],
    ]);
    expect(sheet.textColumn).toBe(1);
    expect(sheet.widths).toHaveLength(5);
  });
});
