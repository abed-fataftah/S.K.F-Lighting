// The import template and the problems file as plain data (spec 0007 AC-2, AC-15). Pure: the page
// hands these to `write-sheet.ts`, which turns them into an .xlsx in the browser. The sheet names,
// headers, and example rows are the file format itself (the import reads the same headers), so
// they live here beside `IMPORT_COLUMNS`, not in ar.json.
import { IMPORT_COLUMNS, NO, YES, type ColumnKey } from "./import-schemas";
import type { EditorLookups } from "./server/admin-queries";

export type SheetCell = string | number | null;

export type SheetSpec = {
  readonly name: string;
  readonly rows: readonly (readonly SheetCell[])[];
  /** Column widths, in characters. */
  readonly widths: readonly number[];
  /** A column whose cells are formatted as text, so a code like `00123` keeps its zeros. */
  readonly textColumn?: number;
  /** How many rows under the header get the text format even when empty. */
  readonly textRows?: number;
};

export const TEMPLATE_FILE = "skf-products-template.xlsx";
export const PROBLEMS_FILE = "skf-import-problems.xlsx";

const HEADERS = IMPORT_COLUMNS.map((column) => column.header);
const WIDTHS = IMPORT_COLUMNS.map((column) =>
  column.key === "description" ? 40 : Math.max(12, column.header.length + 4),
);
const CODE_COLUMN = IMPORT_COLUMNS.findIndex((column) => column.key === "code");

const row = (cells: Partial<Record<ColumnKey, SheetCell>>): readonly SheetCell[] =>
  IMPORT_COLUMNS.map((column) => cells[column.key] ?? null);

/** Two example products: one with 2 sizes and 2 colours, one simple. */
const EXAMPLES: readonly (readonly SheetCell[])[] = [
  row({
    code: "CH-100",
    name: "ثريا كريستال دائرية",
    main: "ثريات",
    sub: "كريستال",
    size: "60 سم",
    price: 450,
    colours: "ذهبي، فضي",
    description: "ثريا كريستال بإطار معدني، مناسبة لغرف الجلوس.",
    diameter: "60",
    height: "45",
    base: "E14",
    power: "6 × 40 واط",
    light: "أبيض دافئ",
    visible: YES,
    available: YES,
  }),
  row({ code: "CH-100", size: "80 سم", price: 650 }),
  row({
    code: "LMP-20",
    name: "أباجورة خشب",
    main: "أباجورات",
    price: 120,
    visible: NO,
    available: YES,
  }),
];

/** The rows of the lists sheet: each main with an empty sub, then each sub with its main; colours beside. */
export function listRows(lookups: EditorLookups): readonly (readonly SheetCell[])[] {
  const categories = [
    ...lookups.categories.map((main) => [main.name, null] as const),
    ...lookups.categories.flatMap((main) =>
      main.children.map((sub) => [main.name, sub.name] as const),
    ),
  ];
  const length = Math.max(categories.length, lookups.colours.length);
  return Array.from({ length }, (_, index) => [
    categories[index]?.[0] ?? null,
    categories[index]?.[1] ?? null,
    lookups.colours[index]?.name ?? null,
  ]);
}

export function templateSheets(lookups: EditorLookups): readonly SheetSpec[] {
  return [
    {
      name: "المنتجات",
      rows: [HEADERS],
      widths: WIDTHS,
      textColumn: CODE_COLUMN,
      textRows: 2000,
    },
    { name: "مثال", rows: [HEADERS, ...EXAMPLES], widths: WIDTHS, textColumn: CODE_COLUMN },
    {
      name: "القوائم",
      rows: [["القسم الرئيسي", "القسم الفرعي", "الألوان"], ...listRows(lookups)],
      widths: [24, 24, 20],
    },
  ];
}

export type ProblemLine = {
  readonly row: string;
  readonly code: string;
  readonly file: string;
  readonly problem: string;
  readonly fix: string;
};

/** "تنزيل المشاكل": the problems table as one sheet (AC-15). Texts arrive already worded. */
export function problemsSheet(
  name: string,
  headers: readonly string[],
  lines: readonly ProblemLine[],
): SheetSpec {
  return {
    name,
    rows: [
      headers,
      ...lines.map((line) => [line.row, line.code, line.file, line.problem, line.fix]),
    ],
    widths: [10, 16, 24, 40, 40],
    textColumn: 1,
  };
}
