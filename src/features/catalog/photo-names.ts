// Bulk photos matched by file name (spec 0007 AC-12). Pure: given the picked files' names and
// sizes and what each code is, it says which photos go to which product, in which position, and
// why every other file is left out. "By file name" compares the names upper cased, character by
// character, so the result is the same on every browser and system.
import { IMPORT_LIMITS, PHOTO_EXTENSIONS, isProductCode, normalizeCode } from "./import-schemas";
import type { ImportProblem } from "./import-sheet";

const PHOTO_NAME = new RegExp(`^(.+?)(?:_(\\d{1,2}))?\\.(${PHOTO_EXTENSIONS.join("|")})$`, "i");

/** `CH-100.jpg` is position 1 (the main photo), `ch-100_3.WEBP` position 3; else null. */
export function parsePhotoName(
  name: string,
): { readonly code: string; readonly position: number } | null {
  const match = PHOTO_NAME.exec(name);
  if (!match) return null;
  const code = normalizeCode(match[1]);
  const position = match[2] === undefined ? 1 : Number(match[2]);
  if (!isProductCode(code) || position < 1 || position > 99) return null;
  return { code, position };
}

export const byFileName = (a: string, b: string): number => {
  const x = a.toUpperCase();
  const y = b.toUpperCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

/** What a code is to this run: a live product, one the sheet writes, or one it cannot take photos. */
export type PhotoTarget = "live" | "sheet" | "archived" | "skipped";

export type PhotoFile = { readonly id: string; readonly name: string; readonly size: number };

export type MatchedPhotos = {
  /** Per code, the photos to attach in position order (at most `maxPerProduct`). */
  readonly byCode: ReadonlyMap<string, readonly { readonly id: string; readonly name: string }[]>;
  readonly problems: readonly ImportProblem[];
};

const problemFor = (target: PhotoTarget | undefined) =>
  target === undefined
    ? "photo_no_product"
    : target === "archived"
      ? "photo_archived"
      : "photo_product_skipped";

export function matchPhotos(
  files: readonly PhotoFile[],
  targets: ReadonlyMap<string, PhotoTarget>,
  maxPerProduct: number = IMPORT_LIMITS.maxPhotosPerProduct,
  maxPerRun: number = IMPORT_LIMITS.maxPhotosPerRun,
): MatchedPhotos {
  const problems: ImportProblem[] = [];
  const problem = (file: PhotoFile, code: string | null, kind: ImportProblem["problem"]) =>
    problems.push({ row: null, file: file.name, code, problem: kind });

  const sorted = [...files].sort((a, b) => byFileName(a.name, b.name));
  const candidates = new Map<string, { file: PhotoFile; position: number }[]>();
  for (const [index, file] of sorted.entries()) {
    if (index >= maxPerRun) {
      problem(file, null, "photo_run_limit");
      continue;
    }
    const parsed = parsePhotoName(file.name);
    if (!parsed) {
      problem(file, null, "photo_name_invalid");
      continue;
    }
    if (file.size > IMPORT_LIMITS.maxPhotoBytes) {
      problem(file, parsed.code, "photo_too_large");
      continue;
    }
    const target = targets.get(parsed.code);
    if (target !== "live" && target !== "sheet") {
      problem(file, parsed.code, problemFor(target));
      continue;
    }
    candidates.set(parsed.code, [
      ...(candidates.get(parsed.code) ?? []),
      { file, position: parsed.position },
    ]);
  }

  const byCode = new Map<string, { id: string; name: string }[]>();
  for (const [code, photos] of candidates) {
    // The files are in name order, so the first one at a position is the one kept.
    const unique = photos.filter((photo, index) => {
      const earlier = photos.findIndex((other) => other.position === photo.position);
      if (earlier === index) return true;
      problem(photo.file, code, "photo_duplicate_number");
      return false;
    });
    const ranked = [...unique].sort((a, b) => a.position - b.position);
    ranked.slice(maxPerProduct).forEach((photo) => problem(photo.file, code, "photo_over_limit"));
    byCode.set(
      code,
      ranked.slice(0, maxPerProduct).map(({ file }) => ({ id: file.id, name: file.name })),
    );
  }

  return { byCode, problems: problems.sort((a, b) => byFileName(a.file!, b.file!)) };
}
