// Reads the first sheet of an uploaded file into raw cells (spec 0007 AC-3). Browser only. The
// sheet libraries load on demand when a file is chosen, so they stay out of every other page and
// out of the Worker. What the cells mean is `parseSheet`'s job.
import { checkSheetFile, isMisencodedCsv, type SheetFileError } from "../../import-sheet";

export type RawSheet = readonly (readonly unknown[])[];

export type ReadSheetResult =
  { readonly ok: true; readonly data: RawSheet } | ({ readonly ok: false } & SheetFileError);

async function readXlsx(file: File): Promise<ReadSheetResult> {
  const { readSheet } = await import("read-excel-file/browser");
  try {
    // Only the first sheet is read, so the template's example sheet is never imported.
    return { ok: true, data: await readSheet(file) };
  } catch {
    return { ok: false, error: "file_unreadable" };
  }
}

async function readCsv(file: File): Promise<ReadSheetResult> {
  // UTF-8, with a leading BOM dropped by the decoder.
  const text = new TextDecoder("utf-8").decode(await file.arrayBuffer());
  if (isMisencodedCsv(text)) return { ok: false, error: "csv_encoding" };
  const { default: Papa } = await import("papaparse");
  // Excel in Arabic locales saves `;`, so the delimiter is guessed among these three.
  const parsed = Papa.parse<string[]>(text, { delimitersToGuess: [",", ";", "\t"] });
  return { ok: true, data: parsed.data };
}

export async function readSheetFile(file: File): Promise<ReadSheetResult> {
  const refused = checkSheetFile(file.name, file.size);
  if (refused) return { ok: false, ...refused };
  try {
    return file.name.toLowerCase().endsWith(".csv") ? await readCsv(file) : await readXlsx(file);
  } catch {
    return { ok: false, error: "file_unreadable" };
  }
}
