import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-3 (spec 0007). The file checks before any reading, the CSV encoding and delimiter
// rules, and that a broken file is a banner, not a crash. The xlsx reader is a spy; papaparse is real.

const readSheet = vi.fn();
vi.mock("read-excel-file/browser", () => ({ readSheet }));

const { readSheetFile } = await import("./read-sheet");

const csv = (text: string | Uint8Array, name = "products.csv") =>
  new File([text as BlobPart], name, { type: "text/csv" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readSheetFile", () => {
  it("reads the first sheet of an xlsx", async () => {
    readSheet.mockResolvedValue([["الكود"], ["CH-1"]]);
    const file = new File(["x"], "Products.XLSX");

    expect(await readSheetFile(file)).toEqual({ ok: true, data: [["الكود"], ["CH-1"]] });
    expect(readSheet).toHaveBeenCalledWith(file);
  });

  it("answers file_unreadable for an xlsx the reader cannot open", async () => {
    readSheet.mockRejectedValue(new Error("not a zip"));
    expect(await readSheetFile(new File(["x"], "p.xlsx"))).toEqual({
      ok: false,
      error: "file_unreadable",
    });
  });

  it.each(["p.xls", "p.txt", "p", "p.xlsx.exe"])(
    "refuses %j as file_type without reading it",
    async (name) => {
      expect(await readSheetFile(new File(["x"], name))).toEqual({ ok: false, error: "file_type" });
      expect(readSheet).not.toHaveBeenCalled();
    },
  );

  it("refuses a file above 5 MB as file_too_large", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "p.xlsx");
    expect(await readSheetFile(big)).toEqual({ ok: false, error: "file_too_large" });
    expect(readSheet).not.toHaveBeenCalled();
  });

  it("reads a UTF-8 CSV with a BOM, the BOM dropped", async () => {
    const result = await readSheetFile(csv("﻿الكود,السعر\nCH-1,450"));
    expect(result).toEqual({
      ok: true,
      data: [
        ["الكود", "السعر"],
        ["CH-1", "450"],
      ],
    });
  });

  it("reads a CSV saved with `;` as Excel does in Arabic locales", async () => {
    const result = await readSheetFile(csv("الكود;السعر;الألوان\nCH-1;450;ذهبي، فضي"));
    expect(result).toEqual({
      ok: true,
      data: [
        ["الكود", "السعر", "الألوان"],
        ["CH-1", "450", "ذهبي، فضي"],
      ],
    });
  });

  it("answers csv_encoding for a CSV saved in Windows Arabic encoding", async () => {
    // "الكود" in windows-1256 is not valid UTF-8, so the decoder puts replacement characters in.
    const cp1256 = new Uint8Array([0xc7, 0xe1, 0xdf, 0xe6, 0xcf, 0x0a, 0x43, 0x48]);
    expect(await readSheetFile(csv(cp1256))).toEqual({ ok: false, error: "csv_encoding" });
  });
});
