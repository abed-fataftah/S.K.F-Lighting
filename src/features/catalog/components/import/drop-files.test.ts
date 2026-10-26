import { describe, expect, it } from "vitest";
import { filesFromDrop } from "./drop-files";

// covers: AC-12 (spec 0007). A dropped folder is flattened to its files at any depth. The browser's
// drop entries are stood in by small fakes with the same shape.

type FakeEntry = FileSystemEntry;

const fileEntry = (file: File | "broken"): FakeEntry =>
  ({
    isFile: true,
    isDirectory: false,
    file: (resolve: (file: File) => void, reject: (error: Error) => void) =>
      file === "broken" ? reject(new Error("gone")) : resolve(file),
  }) as unknown as FakeEntry;

/** A folder whose reader hands its entries over in the chunks given, then an empty one. */
const folderEntry = (...chunks: FakeEntry[][]): FakeEntry =>
  ({
    isFile: false,
    isDirectory: true,
    createReader: () => {
      const pending = [...chunks, []];
      return {
        readEntries: (resolve: (entries: FakeEntry[]) => void) => resolve(pending.shift()!),
      };
    },
  }) as unknown as FakeEntry;

const transfer = (entries: (FakeEntry | null)[], files: File[] = []): DataTransfer =>
  ({
    items: entries.map((entry) => ({ kind: "file", webkitGetAsEntry: () => entry })),
    files,
  }) as unknown as DataTransfer;

const photo = (name: string) => new File(["x"], name, { type: "image/jpeg" });
const names = (files: readonly File[]) => files.map((file) => file.name);

describe("filesFromDrop", () => {
  it("gives the dropped files as they are", async () => {
    const files = await filesFromDrop(
      transfer([fileEntry(photo("CH-1.jpg")), fileEntry(photo("CH-2.jpg"))]),
    );
    expect(names(files)).toEqual(["CH-1.jpg", "CH-2.jpg"]);
  });

  it("flattens a folder and its sub folders, reading every chunk", async () => {
    const nested = folderEntry([fileEntry(photo("CH-1_3.jpg"))]);
    const top = folderEntry(
      [fileEntry(photo("CH-1.jpg")), nested],
      [fileEntry(photo("CH-1_2.jpg"))],
    );

    const files = await filesFromDrop(transfer([top, fileEntry(photo("LMP-2.png"))]));

    expect(names(files).sort()).toEqual(["CH-1.jpg", "CH-1_2.jpg", "CH-1_3.jpg", "LMP-2.png"]);
  });

  it("gives nothing for an empty folder", async () => {
    expect(await filesFromDrop(transfer([folderEntry()]))).toEqual([]);
  });

  it("leaves out a file the browser can no longer read", async () => {
    const files = await filesFromDrop(
      transfer([fileEntry("broken"), fileEntry(photo("CH-1.jpg"))]),
    );
    expect(names(files)).toEqual(["CH-1.jpg"]);
  });

  it("falls back to the plain file list when an item has no entry", async () => {
    const plain = [photo("CH-1.jpg")];
    expect(await filesFromDrop(transfer([null], plain))).toEqual(plain);
  });

  it("falls back to the plain file list where entries are not supported", async () => {
    const plain = [photo("CH-1.jpg")];
    const noEntries = { items: [{ kind: "file" }], files: plain } as unknown as DataTransfer;
    expect(await filesFromDrop(noEntries)).toEqual(plain);
  });

  it("ignores dragged text and gives the file list when no files were dropped", async () => {
    const textOnly = { items: [{ kind: "string" }], files: [] } as unknown as DataTransfer;
    expect(await filesFromDrop(textOnly)).toEqual([]);
  });
});
