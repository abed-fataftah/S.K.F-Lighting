import { describe, expect, it } from "vitest";
import { IMPORT_LIMITS } from "./import-schemas";
import { matchPhotos, parsePhotoName, type PhotoTarget } from "./photo-names";

// covers: AC-12 (spec 0007)

describe("parsePhotoName", () => {
  it.each([
    ["CH-100.jpg", { code: "CH-100", position: 1 }],
    ["ch-100_3.WEBP", { code: "CH-100", position: 3 }],
    ["CH-100_99.jpeg", { code: "CH-100", position: 99 }],
    ["lmp-20_1.png", { code: "LMP-20", position: 1 }],
    ["١٢٣.jpg", { code: "123", position: 1 }],
  ])("reads %s", (name, expected) => {
    expect(parsePhotoName(name)).toEqual(expected);
  });

  it.each(["CH-100_0.jpg", "CH-100_100.jpg", "IMG_2231.jpg", "CH-100.heic", "CH 100.jpg", ".jpg"])(
    "refuses %s",
    (name) => {
      expect(parsePhotoName(name)).toBeNull();
    },
  );
});

const file = (name: string, size = 1000) => ({ id: name, name, size });
const targets = new Map<string, PhotoTarget>([
  ["CH-100", "sheet"],
  ["LMP-20", "live"],
  ["OLD-1", "archived"],
  ["BAD-1", "skipped"],
]);

describe("matchPhotos", () => {
  it("puts each product's photos in position order", () => {
    const matched = matchPhotos(
      [file("CH-100_2.jpg"), file("ch-100.png"), file("LMP-20_5.webp")],
      targets,
    );
    expect(matched.byCode.get("CH-100")?.map((photo) => photo.name)).toEqual([
      "ch-100.png",
      "CH-100_2.jpg",
    ]);
    expect(matched.byCode.get("LMP-20")?.length).toBe(1);
    expect(matched.problems).toEqual([]);
  });

  it("says why each other file is left out, in file name order", () => {
    const matched = matchPhotos(
      [
        file("NOPE-1.jpg"),
        file("OLD-1.jpg"),
        file("BAD-1.jpg"),
        file("IMG_2231.jpg"),
        file("CH-100.jpg", IMPORT_LIMITS.maxPhotoBytes + 1),
      ],
      targets,
    );
    expect(matched.problems.map(({ file: name, problem }) => [name, problem])).toEqual([
      ["BAD-1.jpg", "photo_product_skipped"],
      ["CH-100.jpg", "photo_too_large"],
      ["IMG_2231.jpg", "photo_name_invalid"],
      ["NOPE-1.jpg", "photo_no_product"],
      ["OLD-1.jpg", "photo_archived"],
    ]);
    expect(matched.byCode.size).toBe(0);
  });

  it("keeps the first file by name at a repeated position", () => {
    const matched = matchPhotos([file("CH-100_1.png"), file("CH-100.jpg")], targets);
    expect(matched.byCode.get("CH-100")?.map((photo) => photo.name)).toEqual(["CH-100.jpg"]);
    expect(matched.problems).toEqual([
      { row: null, file: "CH-100_1.png", code: "CH-100", problem: "photo_duplicate_number" },
    ]);
  });

  it("uses the first 8 by position and lists the rest", () => {
    const files = Array.from({ length: 9 }, (_, i) => file(`CH-100_${9 - i}.jpg`));
    const matched = matchPhotos(files, targets);
    expect(matched.byCode.get("CH-100")?.map((photo) => photo.name)).toEqual(
      Array.from({ length: 8 }, (_, i) => `CH-100_${i + 1}.jpg`),
    );
    expect(matched.problems.map((problem) => [problem.file, problem.problem])).toEqual([
      ["CH-100_9.jpg", "photo_over_limit"],
    ]);
  });

  it("stops after the first 1,000 files by name", () => {
    const files = Array.from({ length: 1001 }, (_, i) =>
      file(`NOPE-${String(i).padStart(4, "0")}.jpg`),
    );
    const matched = matchPhotos(files, targets);
    expect(matched.problems.filter((problem) => problem.problem === "photo_run_limit")).toEqual([
      { row: null, file: "NOPE-1000.jpg", code: null, problem: "photo_run_limit" },
    ]);
  });
});
