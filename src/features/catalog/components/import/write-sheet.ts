// Saves sheets as an .xlsx download (spec 0007 AC-2, AC-15). Browser only; the library loads on
// demand when the owner asks for the template or the problems file.
import type { SheetCell, SheetSpec } from "../../import-template";

type Cell =
  | null
  | { readonly type: StringConstructor; readonly value?: string; readonly format?: string }
  | { readonly type: NumberConstructor; readonly value: number };

const TEXT = "@";

function cellOf(value: SheetCell, asText: boolean): Cell {
  if (value === null) return asText ? { type: String, format: TEXT } : null;
  if (typeof value === "number") return { type: Number, value };
  return asText ? { type: String, value, format: TEXT } : { type: String, value };
}

function rowsOf(spec: SheetSpec): Cell[][] {
  const width = spec.rows[0]?.length ?? 0;
  // The header row (index 0) stays a plain row.
  const rows = spec.rows.map((row, index) =>
    row.map((value, column) => cellOf(value, index > 0 && column === spec.textColumn)),
  );
  // Empty rows that still carry the text format in the text column.
  const extra = Math.max(0, (spec.textRows ?? 0) - (spec.rows.length - 1));
  const blank = Array.from({ length: extra }, () =>
    Array.from({ length: width }, (_, column) => cellOf(null, column === spec.textColumn)),
  );
  return [...rows, ...blank];
}

export async function downloadSheets(
  sheets: readonly SheetSpec[],
  fileName: string,
): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  await writeXlsxFile(
    sheets.map((spec) => ({
      sheet: spec.name,
      data: rowsOf(spec),
      columns: spec.widths.map((width) => ({ width })),
      rightToLeft: true,
    })),
  ).toFile(fileName);
}
