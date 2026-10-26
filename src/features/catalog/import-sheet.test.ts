import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS, IMPORT_LIMITS } from "./import-schemas";
import {
  cellText,
  checkProduct,
  checkSheetFile,
  groupRows,
  isMisencodedCsv,
  mapHeaders,
  parseSheet,
  readRows,
  type CheckedProduct,
} from "./import-sheet";

// covers: AC-3, AC-4, AC-5, AC-6, AC-11 (spec 0007)

const HEADERS = IMPORT_COLUMNS.map((column) => column.header);
type Cells = Partial<Record<(typeof IMPORT_COLUMNS)[number]["key"], unknown>>;

/** A sheet with every header and one line per row, cells by column key. */
const sheet = (...rows: readonly Cells[]) => [
  HEADERS,
  ...rows.map((cells) => IMPORT_COLUMNS.map((column) => cells[column.key] ?? null)),
];

const productsOf = (data: readonly (readonly unknown[])[]): readonly CheckedProduct[] => {
  const parsed = parseSheet(data);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.sheet.products;
};

const problemsOf = (product: CheckedProduct) =>
  product.ok ? [] : product.problems.map(({ row, problem, column }) => ({ row, problem, column }));

const simple: Cells = { code: "LMP-20", name: "أباجورة خشب", main: "أباجورات", price: "120" };

describe("checkSheetFile", () => {
  it("takes xlsx and csv up to 5 MB, any case", () => {
    expect(checkSheetFile("products.XLSX", 1000)).toBeNull();
    expect(checkSheetFile("products.csv", IMPORT_LIMITS.maxFileBytes)).toBeNull();
  });

  it("refuses other types and bigger files", () => {
    expect(checkSheetFile("products.xls", 10)).toEqual({ error: "file_type" });
    expect(checkSheetFile("products", 10)).toEqual({ error: "file_type" });
    expect(checkSheetFile("a.csv", IMPORT_LIMITS.maxFileBytes + 1)).toEqual({
      error: "file_too_large",
    });
  });
});

describe("cellText", () => {
  it("rounds numbers to 2 decimals before turning them into text", () => {
    expect(cellText(0.1 + 0.2)).toBe("0.3");
    expect(cellText(120)).toBe("120");
    expect(cellText(19.999)).toBe("20");
  });

  it("reads booleans, dates, and empty cells as text", () => {
    expect(cellText(true)).toBe("true");
    expect(cellText(new Date(Date.UTC(2026, 9, 21)))).toBe("2026-10-21");
    expect(cellText(null)).toBe("");
    expect(cellText(undefined)).toBe("");
  });

  it("never reads NaN or Infinity as a number", () => {
    expect(cellText(Number.NaN)).toBe("");
    expect(cellText(Infinity)).toBe("");
  });
});

describe("isMisencodedCsv", () => {
  it("spots the replacement character a wrong encoding leaves", () => {
    expect(isMisencodedCsv("الكود,السعر")).toBe(false);
    expect(isMisencodedCsv("��,price")).toBe(true);
  });
});

describe("mapHeaders", () => {
  it("needs the code, size, price, and colours headers", () => {
    expect(mapHeaders(["الكود", "الحجم", "السعر"])).toEqual({
      ok: false,
      error: "missing_column",
      column: "الألوان",
    });
    expect(mapHeaders([])).toMatchObject({ ok: false, column: "الكود" });
  });

  it("matches headers after tidying and ignores unknown columns", () => {
    const mapped = mapHeaders(["ملاحظات", " الكود ", "الحجم", "السعر", "الألوان‏"]);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) expect(mapped.value.get("code")).toBe(1);
  });

  it("refuses a repeated header, naming it", () => {
    expect(mapHeaders(["الكود", "الحجم", "السعر", "الألوان", "السعر"])).toEqual({
      ok: false,
      error: "duplicate_column",
      column: "السعر",
    });
  });
});

describe("readRows", () => {
  it("numbers rows as the spreadsheet does and skips empty ones", () => {
    const rows = readRows(sheet({ code: "A-1", price: "5" }, {}, { code: "A-2", price: "6" }));
    expect(rows.ok && rows.value.map((row) => row.row)).toEqual([2, 4]);
  });

  it("reads an absent optional column as empty", () => {
    const rows = readRows([
      ["الكود", "الحجم", "السعر", "الألوان"],
      ["A-1", "", 120, ""],
    ]);
    expect(rows.ok && rows.value[0].cells).toMatchObject({ code: "A-1", price: "120", name: "" });
  });

  it("keeps the description's lines", () => {
    const rows = readRows(sheet({ code: "A-1", description: "سطر\r\nسطر ثان" }));
    expect(rows.ok && rows.value[0].cells.description).toBe("سطر\nسطر ثان");
  });

  it("refuses more than 500 products or 5,000 rows", () => {
    const many = Array.from({ length: IMPORT_LIMITS.maxProducts + 1 }, (_, i) => ({
      code: `P-${i}`,
    }));
    expect(readRows(sheet(...many))).toEqual({ ok: false, error: "too_many_rows" });
    const rows = Array.from({ length: IMPORT_LIMITS.maxRows + 1 }, (_, i) => ({
      code: `P-${i % 10}`,
      size: `${i}`,
    }));
    expect(readRows(sheet(...rows))).toEqual({ ok: false, error: "too_many_rows" });
    expect(readRows(sheet(...rows.slice(1))).ok).toBe(true);
  });
});

describe("groupRows", () => {
  it("joins rows of one code wherever they sit, codes in Arabic digits and lower case", () => {
    const rows = readRows(
      sheet({ code: "ch-١٠٠", size: "صغير" }, { code: "B-1" }, { code: "CH-100", size: "كبير" }),
    );
    if (!rows.ok) throw new Error();
    const { groups } = groupRows(rows.value);
    expect(groups.map((group) => [group.code, group.rows.map((row) => row.row)])).toEqual([
      ["CH-100", [2, 4]],
      ["B-1", [3]],
    ]);
  });

  it("lists a filled row with no code", () => {
    const rows = readRows(sheet({ name: "بلا كود", price: "5" }));
    if (!rows.ok) throw new Error();
    expect(groupRows(rows.value).problems).toEqual([
      { row: 2, file: null, code: null, problem: "code_missing" },
    ]);
  });
});

describe("checkProduct", () => {
  it("builds a simple product from one row", () => {
    const [product] = productsOf(sheet({ ...simple, visible: "نعم", diameter: "30" }));
    expect(product).toEqual({
      ok: true,
      code: "LMP-20",
      product: {
        code: "LMP-20",
        rows: [2],
        name: "أباجورة خشب",
        mainCategory: "أباجورات",
        specs: [{ label: "القطر (سم)", value: "30" }],
        visible: true,
        sizes: [],
        colours: [],
        price: "120",
      },
    });
  });

  it("builds sizes in row order and colours split on both commas", () => {
    const [product] = productsOf(
      sheet(
        {
          code: "CH-100",
          name: "ثريا",
          main: "ثريات",
          size: "60 سم",
          price: "450",
          colours: "ذهبي، فضي , أسود",
        },
        { code: "CH-100", size: "80 سم", price: "٦٥٠" },
      ),
    );
    expect(product.ok && product.product).toMatchObject({
      rows: [2, 3],
      sizes: [
        { label: "60 سم", price: "450" },
        // Sent as typed; `importProductSchema` parses it again on the server.
        { label: "80 سم", price: "٦٥٠" },
      ],
      colours: ["ذهبي", "فضي", "أسود"],
    });
    expect(product.ok && product.product.price).toBeUndefined();
  });

  it("refuses a different product cell on a later row, but takes a repeat or an empty one", () => {
    const [product] = productsOf(
      sheet(
        { code: "A-1", name: "ثريا", size: "1", price: "5" },
        { code: "A-1", name: "ثريا", size: "2", price: "5" },
        { code: "A-1", name: "ثريا أخرى", size: "3", price: "5" },
      ),
    );
    expect(problemsOf(product)).toEqual([
      { row: 2, problem: "skipped", column: undefined },
      { row: 3, problem: "skipped", column: undefined },
      { row: 4, problem: "conflicting_value", column: "الاسم" },
    ]);
  });

  it("lists every row of a product with a problem, the clean ones held back by the first", () => {
    const [product] = productsOf(
      sheet(
        { code: "A-1", size: "1", price: "5" },
        { code: "A-1", size: "2", price: "abc" },
        { code: "A-1", size: "3", price: "0" },
      ),
    );
    expect(product.ok).toBe(false);
    if (product.ok) return;
    expect(product.problems).toEqual([
      { row: 2, file: null, code: "A-1", problem: "skipped", withRow: 3 },
      { row: 3, file: null, code: "A-1", problem: "price_invalid", column: "السعر" },
      { row: 4, file: null, code: "A-1", problem: "price_invalid", column: "السعر" },
    ]);
  });

  it.each([
    ["mixed sizes", [{ size: "1" }, { size: "" }], [3, "size_mixed"]],
    ["two rows with no size", [{}, {}], [2, "size_mixed"]],
    ["a repeated size", [{ size: "كبير" }, { size: " كبير " }], [3, "size_duplicate"]],
    ["a long size", [{ size: "x".repeat(41) }], [2, "size_invalid"]],
  ])("refuses %s", (_, rows, [row, problem]) => {
    const [product] = productsOf(
      sheet(...rows.map((cells) => ({ code: "A-1", price: "5", ...cells }))),
    );
    expect(problemsOf(product)).toContainEqual({ row, problem, column: "الحجم" });
  });

  it("refuses a 13th size", () => {
    const rows = Array.from({ length: 13 }, (_, i) => ({ code: "A-1", size: `${i}`, price: "5" }));
    const [product] = productsOf(sheet(...rows));
    expect(problemsOf(product)).toContainEqual({
      row: 14,
      problem: "too_many_sizes",
      column: "الحجم",
    });
  });

  it.each([
    ["13 colours", Array.from({ length: 13 }, (_, i) => `لون ${i}`).join("،"), "too_many_colours"],
    ["a repeated colour", "ذهبي, ذهبي", "colour_duplicate"],
    ["a long colour name", "ل".repeat(41), "colour_invalid"],
  ])("refuses %s", (_, colours, problem) => {
    const [product] = productsOf(sheet({ ...simple, colours }));
    expect(problemsOf(product)).toEqual([{ row: 2, problem, column: "الألوان" }]);
  });

  it.each([
    [{ visible: "ربما" }, "yes_no_invalid", "ظاهر"],
    [{ available: "yes" }, "yes_no_invalid", "متوفر"],
    [{ description: "و".repeat(4001) }, "description_too_long", "الوصف"],
    [{ description: "LED 5W" }, "description_invalid", "الوصف"],
    [{ power: "x".repeat(121) }, "spec_too_long", "القدرة"],
    [{ name: "ث" }, "name_invalid", "الاسم"],
    [{ main: "Lamps" }, "category_invalid", "القسم الرئيسي"],
    [{ code: "CH 100" }, "code_invalid", "الكود"],
  ])("refuses %o", (cells, problem, column) => {
    const [product] = productsOf(sheet({ ...simple, ...cells }));
    expect(problemsOf(product)).toEqual([{ row: 2, problem, column }]);
  });

  it("takes empty yes and no cells as not given", () => {
    const [product] = productsOf(sheet({ ...simple, visible: "", available: "لا" }));
    expect(product.ok && product.product).toMatchObject({ available: false });
    expect(product.ok && "visible" in product.product).toBe(false);
  });

  it("checks a group handed to it directly", () => {
    const rows = readRows(sheet(simple));
    if (!rows.ok) throw new Error();
    expect(checkProduct({ code: "LMP-20", rows: rows.value }).ok).toBe(true);
  });
});
