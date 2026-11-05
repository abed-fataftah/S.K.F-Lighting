// Reading the import sheet (spec 0007 AC-3 to AC-6, AC-11). Pure: the browser hands over the first
// sheet's cells as they came out of the file, and this turns them into products ready to send, or
// into row problems that say what to fix. Row numbers are the spreadsheet's own (header = 1).
import { tidyText } from "@/lib/arabic";
import {
  IMPORT_COLUMNS,
  IMPORT_LIMITS,
  PRODUCT_COLUMNS,
  SHEET_EXTENSIONS,
  SPEC_COLUMNS,
  checkCategoryName,
  checkColourName,
  checkDescription,
  checkName,
  checkPrice,
  checkSizeLabel,
  checkSpecValue,
  checkYesNo,
  headerOf,
  isProductCode,
  normalizeCode,
  repeatedIndexes,
  splitColours,
  type ColumnKey,
  type FileError,
  type ImportProductInput,
  type ProblemCode,
} from "./import-schemas";
import { PRODUCT_LIMITS, optionKey } from "./schemas";

export type SheetFileError = { readonly error: FileError; readonly column?: string };

export type SheetRow = {
  readonly row: number;
  readonly cells: Readonly<Record<ColumnKey, string>>;
};

/** One line of the problems table. `row` and `file` say where; `column` names the cell's header. */
export type ImportProblem = {
  readonly row: number | null;
  readonly file: string | null;
  readonly code: string | null;
  readonly problem: ProblemCode;
  readonly column?: string;
  /** For `skipped`: the row whose problem holds this one back. */
  readonly withRow?: number;
};

export type CheckedProduct =
  | { readonly ok: true; readonly code: string; readonly product: ImportProductInput }
  | {
      readonly ok: false;
      readonly code: string;
      readonly rows: readonly number[];
      readonly problems: readonly ImportProblem[];
    };

export type ParsedSheet = {
  /** Every product in the order its first row appears. */
  readonly products: readonly CheckedProduct[];
  /** Rows that belong to no product (no code). */
  readonly problems: readonly ImportProblem[];
};

type Parsed<T> =
  { readonly ok: true; readonly value: T } | ({ readonly ok: false } & SheetFileError);

/** Only `.xlsx` and `.csv`, up to 5 MB (AC-3). */
export function checkSheetFile(name: string, size: number): SheetFileError | null {
  const ext = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";
  if (!(SHEET_EXTENSIONS as readonly string[]).includes(ext)) return { error: "file_type" };
  if (size > IMPORT_LIMITS.maxFileBytes) return { error: "file_too_large" };
  return null;
}

/** A CSV is UTF-8: a replacement character means it was saved in another encoding (AC-3). */
export const isMisencodedCsv = (text: string): boolean => text.includes("�");

/**
 * Any cell as text (AC-3): a number rounded to 2 decimals first, so formula noise like
 * `0.30000000000000004` reads `0.3`; a date as its ISO day; anything else as `String(value)`.
 */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "";
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  return String(value);
}

/** Header row to column positions: required headers present, none repeated, others ignored. */
export function mapHeaders(headerRow: readonly unknown[]): Parsed<ReadonlyMap<ColumnKey, number>> {
  const positions = new Map<ColumnKey, number>();
  for (const [index, cell] of headerRow.entries()) {
    const header = tidyText(cellText(cell));
    const column = IMPORT_COLUMNS.find((known) => known.header === header);
    if (!column) continue;
    if (positions.has(column.key)) {
      return { ok: false, error: "duplicate_column", column: column.header };
    }
    positions.set(column.key, index);
  }
  const missing = IMPORT_COLUMNS.find((column) => column.required && !positions.has(column.key));
  if (missing) return { ok: false, error: "missing_column", column: missing.header };
  return { ok: true, value: positions };
}

/** The data rows as text by column, without the empty ones. An absent optional column is empty. */
export function readRows(data: readonly (readonly unknown[])[]): Parsed<readonly SheetRow[]> {
  const headers = mapHeaders(data[0] ?? []);
  if (!headers.ok) return headers;
  const positions = headers.value;

  const rows: SheetRow[] = [];
  for (const [index, line] of data.entries()) {
    if (index === 0) continue;
    const cells = Object.fromEntries(
      IMPORT_COLUMNS.map(({ key }) => {
        const position = positions.get(key);
        const text = position === undefined ? "" : cellText(line[position]);
        return [key, tidyText(text, { multiline: key === "description" })];
      }),
    ) as Record<ColumnKey, string>;
    if (Object.values(cells).every((cell) => cell === "")) continue;
    rows.push({ row: index + 1, cells });
  }

  const products = new Set(rows.map((row) => normalizeCode(row.cells.code)).filter(Boolean));
  if (rows.length > IMPORT_LIMITS.maxRows || products.size > IMPORT_LIMITS.maxProducts) {
    return { ok: false, error: "too_many_rows" };
  }
  return { ok: true, value: rows };
}

export type RowGroup = { readonly code: string; readonly rows: readonly SheetRow[] };

/** Rows of one code form one product, wherever they sit (AC-4); a row with no code is a problem. */
export function groupRows(rows: readonly SheetRow[]): {
  readonly groups: readonly RowGroup[];
  readonly problems: readonly ImportProblem[];
} {
  const groups = new Map<string, SheetRow[]>();
  const problems: ImportProblem[] = [];
  for (const row of rows) {
    const code = normalizeCode(row.cells.code);
    if (!code) {
      problems.push({ row: row.row, file: null, code: null, problem: "code_missing" });
      continue;
    }
    groups.set(code, [...(groups.get(code) ?? []), row]);
  }
  return { groups: [...groups].map(([code, grouped]) => ({ code, rows: grouped })), problems };
}

/** Every row of a product with a problem is listed: clean ones as held back by the first problem. */
export function withSkippedRows(
  code: string,
  rows: readonly number[],
  problems: readonly ImportProblem[],
): readonly ImportProblem[] {
  const first = Math.min(...problems.map((problem) => problem.row ?? Infinity));
  const skipped = rows
    .filter((row) => !problems.some((problem) => problem.row === row))
    .map((row): ImportProblem => ({ row, file: null, code, problem: "skipped", withRow: first }));
  return [...problems, ...skipped].sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
}

/** The rules of one product (AC-4 to AC-6), all or nothing (AC-11). */
export function checkProduct(group: RowGroup): CheckedProduct {
  const { code, rows } = group;
  const [first] = rows;
  const problems: ImportProblem[] = [];
  const add = (row: number, problem: ProblemCode, column?: ColumnKey) =>
    problems.push({
      row,
      file: null,
      code,
      problem,
      ...(column ? { column: headerOf(column) } : {}),
    });

  if (!isProductCode(code)) rows.forEach((row) => add(row.row, "code_invalid", "code"));

  // A later row repeats the product cells or leaves them empty.
  for (const row of rows.slice(1)) {
    for (const column of PRODUCT_COLUMNS) {
      const cell = row.cells[column];
      if (cell !== "" && cell !== first.cells[column]) add(row.row, "conflicting_value", column);
    }
  }

  const cell = (column: ColumnKey) => first.cells[column];
  const optional = <T>(
    column: ColumnKey,
    check: (text: string) => { ok: true; value: T } | { ok: false; problem: ProblemCode },
  ): T | undefined => {
    if (cell(column) === "") return undefined;
    const result = check(cell(column));
    if (result.ok) return result.value;
    add(first.row, result.problem, column);
    return undefined;
  };

  const name = optional("name", checkName);
  const mainCategory = optional("main", checkCategoryName);
  const subCategory = optional("sub", checkCategoryName);
  const description = optional("description", checkDescription);
  const visible = optional("visible", checkYesNo);
  const available = optional("available", checkYesNo);
  const specs = SPEC_COLUMNS.flatMap((column) => {
    const value = optional(column, checkSpecValue);
    return value ? [{ label: headerOf(column), value }] : [];
  });

  // Prices, one per row.
  const prices = rows.map((row) => {
    const price = checkPrice(row.cells.price);
    if (!price.ok) add(row.row, price.problem, "price");
    return row.cells.price;
  });

  // Every row has a size, or the product is one row with no size (AC-5).
  const sized = rows.some((row) => row.cells.size !== "");
  if (sized || rows.length > 1) {
    rows.forEach((row, index) => {
      if (row.cells.size === "") add(row.row, "size_mixed", "size");
      else if (index >= PRODUCT_LIMITS.maxSizes) add(row.row, "too_many_sizes", "size");
      else if (!checkSizeLabel(row.cells.size).ok) add(row.row, "size_invalid", "size");
    });
    const labelled = rows.filter((row) => row.cells.size !== "");
    for (const index of repeatedIndexes(labelled.map((row) => optionKey(row.cells.size)))) {
      add(labelled[index].row, "size_duplicate", "size");
    }
  }

  // Colours, from the first row.
  const colourNames = splitColours(cell("colours"));
  if (colourNames.length > PRODUCT_LIMITS.maxColours) add(first.row, "too_many_colours", "colours");
  else if (colourNames.some((colour) => !checkColourName(colour).ok)) {
    add(first.row, "colour_invalid", "colours");
  } else if (repeatedIndexes(colourNames.map(optionKey)).length) {
    add(first.row, "colour_duplicate", "colours");
  }

  const rowNumbers = rows.map((row) => row.row);
  if (problems.length) {
    return {
      ok: false,
      code,
      rows: rowNumbers,
      problems: withSkippedRows(code, rowNumbers, problems),
    };
  }

  return {
    ok: true,
    code,
    product: {
      code,
      rows: rowNumbers,
      ...(name !== undefined ? { name } : {}),
      ...(mainCategory !== undefined ? { mainCategory } : {}),
      ...(subCategory !== undefined ? { subCategory } : {}),
      ...(description !== undefined ? { description } : {}),
      specs,
      ...(visible !== undefined ? { visible } : {}),
      ...(available !== undefined ? { available } : {}),
      sizes: sized
        ? rows.map((row, index) => ({ label: row.cells.size, price: prices[index] }))
        : [],
      colours: colourNames,
      ...(sized ? {} : { price: prices[0] }),
    },
  };
}

/** The whole first sheet: a file error, or every product checked plus the rows with no code. */
export function parseSheet(
  data: readonly (readonly unknown[])[],
): { readonly ok: true; readonly sheet: ParsedSheet } | ({ readonly ok: false } & SheetFileError) {
  const rows = readRows(data);
  if (!rows.ok) return rows;
  const { groups, problems } = groupRows(rows.value);
  return { ok: true, sheet: { products: groups.map(checkProduct), problems } };
}
