import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SheetSpec } from "../../import-template";

// covers: AC-2, AC-15 (spec 0007). What reaches the xlsx writer: the code column stays text so
// `00123` keeps its zeros, and the sheets read right to left.

const toFile = vi.fn(async () => {});
const writeXlsxFile = vi.fn<(sheets: unknown) => { toFile: typeof toFile }>(() => ({ toFile }));
vi.mock("write-excel-file/browser", () => ({ default: writeXlsxFile }));

const { downloadSheets } = await import("./write-sheet");

type Written = { sheet: string; data: unknown[][]; columns: unknown[]; rightToLeft: boolean };
const written = () => writeXlsxFile.mock.calls[0][0] as Written[];

const TEXT = "@";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("downloadSheets", () => {
  it("saves every sheet under the file name given, right to left, with its widths", async () => {
    const sheets: SheetSpec[] = [
      { name: "أ", rows: [["x"]], widths: [12] },
      { name: "ب", rows: [["y", "z"]], widths: [10, 20] },
    ];

    await downloadSheets(sheets, "skf-products-template.xlsx");

    expect(toFile).toHaveBeenCalledWith("skf-products-template.xlsx");
    expect(written().map((sheet) => [sheet.sheet, sheet.rightToLeft, sheet.columns])).toEqual([
      ["أ", true, [{ width: 12 }]],
      ["ب", true, [{ width: 10 }, { width: 20 }]],
    ]);
  });

  it("formats the text column as text below the header, keeping numbers elsewhere numbers", async () => {
    await downloadSheets(
      [
        {
          name: "مثال",
          rows: [
            ["الكود", "السعر"],
            ["00123", 450],
            [null, null],
          ],
          widths: [12, 12],
          textColumn: 0,
        },
      ],
      "t.xlsx",
    );

    expect(written()[0].data).toEqual([
      [
        { type: String, value: "الكود" },
        { type: String, value: "السعر" },
      ],
      [
        { type: String, value: "00123", format: TEXT },
        { type: Number, value: 450 },
      ],
      [{ type: String, format: TEXT }, null],
    ]);
  });

  it("adds empty rows up to textRows that still carry the text format", async () => {
    await downloadSheets(
      [
        {
          name: "المنتجات",
          rows: [["الكود", "الاسم"]],
          widths: [12, 12],
          textColumn: 0,
          textRows: 3,
        },
      ],
      "t.xlsx",
    );

    const [header, ...blank] = written()[0].data;
    expect(header).toHaveLength(2);
    expect(blank).toEqual(Array.from({ length: 3 }, () => [{ type: String, format: TEXT }, null]));
  });

  it("adds no empty rows when the filled rows already reach textRows", async () => {
    await downloadSheets(
      [{ name: "s", rows: [["h"], ["a"], ["b"]], widths: [12], textColumn: 0, textRows: 1 }],
      "t.xlsx",
    );
    expect(written()[0].data).toHaveLength(3);
  });
});
