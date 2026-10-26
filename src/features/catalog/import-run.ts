// The import run (spec 0007 AC-13, AC-15): products in batches of 25, one batch after another, then
// the photos of every product the run wrote. Side effects (the actions, the resize, the upload)
// come in as functions, so the order of work, the limits, and the counts are tested without a
// browser. Photos are prepared one at a time (one decoded bitmap on an older phone) and uploaded
// up to 4 at a time; a failed upload is tried once more.
import { IMPORT_LIMITS, type ImportProductInput, type ProblemCode } from "./import-schemas";
import type { ImportProblem } from "./import-sheet";
import type { Review } from "./import-plan";
import type { ImportOutcome } from "./server/import-products";

export type PhotoImage = {
  readonly storageKey: string;
  readonly width: number;
  readonly height: number;
};

export type RunProgress = {
  readonly stage: "products" | "photos";
  readonly done: number;
  readonly total: number;
};

export type RunEffects<P extends { readonly width: number; readonly height: number }> = {
  readonly importBatch: (
    products: readonly ImportProductInput[],
  ) => Promise<
    | { readonly ok: true; readonly results: readonly ImportOutcome[] }
    | { readonly ok: false; readonly error: "forbidden" | "failed" }
  >;
  /** The resized photo, or null when the browser cannot read it. */
  readonly preparePhoto: (fileId: string) => Promise<P | null>;
  /** One upload attempt: the storage key, null when it failed, or `forbidden`. */
  readonly uploadPhoto: (productId: string, photo: P) => Promise<string | null | "forbidden">;
  readonly setPhotos: (
    productId: string,
    images: readonly PhotoImage[],
  ) => Promise<"ok" | "failed" | "forbidden">;
  readonly onProgress: (progress: RunProgress) => void;
};

export type RunResult = {
  readonly outcomes: readonly ImportOutcome[];
  readonly photoProblems: readonly ImportProblem[];
  /** Photo files attached to a product. */
  readonly attached: number;
  /** Live products outside the sheet whose photos were replaced. */
  readonly photoUpdates: number;
  /** The session ended partway; the rest was not sent. */
  readonly forbidden: boolean;
};

export function batches<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

type Job = {
  readonly productId: string;
  readonly fileId: string;
  readonly name: string;
  readonly code: string;
  readonly position: number;
};

export async function runImport<P extends { readonly width: number; readonly height: number }>(
  review: Review,
  effects: RunEffects<P>,
): Promise<RunResult> {
  const outcomes: ImportOutcome[] = [];
  let forbidden = false;

  // 1. Products, one batch after another.
  const total = review.send.length;
  effects.onProgress({ stage: "products", done: 0, total });
  for (const batch of batches(review.send, IMPORT_LIMITS.batchSize)) {
    const answer = forbidden ? null : await effects.importBatch(batch).catch(() => null);
    if (answer?.ok) {
      outcomes.push(...answer.results);
    } else {
      if (answer && answer.error === "forbidden") forbidden = true;
      outcomes.push(
        ...batch.map((product) => ({
          code: product.code,
          outcome: "skipped" as const,
          problem: "save_failed" as const,
        })),
      );
    }
    effects.onProgress({ stage: "products", done: outcomes.length, total });
  }

  // 2. Photos, for products this run wrote and live products the sheet left alone.
  const photoProblems: ImportProblem[] = [];
  const problem = (name: string, code: string, kind: ProblemCode) =>
    photoProblems.push({ row: null, file: name, code, problem: kind });
  const written = new Map(
    outcomes.flatMap((outcome) =>
      outcome.outcome === "skipped" ? [] : [[outcome.code, outcome.id]],
    ),
  );

  const jobs: Job[] = [];
  for (const plan of review.photos) {
    const productId = plan.fromSheet ? written.get(plan.code) : plan.productId;
    plan.files.forEach((file, position) => {
      if (!productId || forbidden) problem(file.name, plan.code, "photo_product_skipped");
      else jobs.push({ productId, fileId: file.id, name: file.name, code: plan.code, position });
    });
  }

  const slots = new Map<string, (PhotoImage | null)[]>();
  const waiting = new Map<string, number>();
  for (const job of jobs) {
    slots.set(job.productId, []);
    waiting.set(job.productId, (waiting.get(job.productId) ?? 0) + 1);
  }

  let attached = 0;
  let photoUpdates = 0;
  let done = 0;
  const attaching: Promise<void>[] = [];
  const fromSheet = new Set(
    review.photos.filter((plan) => plan.fromSheet).map((plan) => plan.code),
  );

  const attach = async (productId: string, code: string) => {
    const productJobs = jobs.filter((job) => job.productId === productId);
    const images = slots.get(productId)!;
    const ready = productJobs.flatMap((job) =>
      images[job.position] ? [images[job.position]!] : [],
    );
    // None uploaded: the stored photos and version stay as they are.
    if (!ready.length) return;
    const answer = await effects.setPhotos(productId, ready).catch(() => "failed" as const);
    if (answer === "ok") {
      attached += ready.length;
      if (!fromSheet.has(code)) photoUpdates += 1;
      return;
    }
    if (answer === "forbidden") forbidden = true;
    productJobs
      .filter((job) => images[job.position])
      .forEach((job) => problem(job.name, job.code, "photo_upload_failed"));
  };

  const settle = (job: Job, image: PhotoImage | null) => {
    slots.get(job.productId)![job.position] = image;
    done += 1;
    effects.onProgress({ stage: "photos", done, total: jobs.length });
    const left = waiting.get(job.productId)! - 1;
    waiting.set(job.productId, left);
    if (left === 0) attaching.push(attach(job.productId, job.code));
  };

  const upload = async (job: Job, photo: P) => {
    for (let attempt = 1; attempt <= 2 && !forbidden; attempt += 1) {
      const key = await effects.uploadPhoto(job.productId, photo).catch(() => null);
      if (key === "forbidden") forbidden = true;
      else if (key)
        return settle(job, { storageKey: key, width: photo.width, height: photo.height });
    }
    problem(job.name, job.code, "photo_upload_failed");
    settle(job, null);
  };

  if (jobs.length) effects.onProgress({ stage: "photos", done: 0, total: jobs.length });
  const uploading = new Set<Promise<void>>();
  for (const job of jobs) {
    const photo = forbidden ? null : await effects.preparePhoto(job.fileId).catch(() => null);
    if (!photo) {
      problem(job.name, job.code, forbidden ? "photo_upload_failed" : "photo_unreadable");
      settle(job, null);
      continue;
    }
    while (uploading.size >= IMPORT_LIMITS.uploadsAtOnce) await Promise.race(uploading);
    const task = upload(job, photo).finally(() => uploading.delete(task));
    uploading.add(task);
  }
  await Promise.all(uploading);
  await Promise.all(attaching);

  return { outcomes, photoProblems, attached, photoUpdates, forbidden };
}

/** The problems the run found, one line per sheet row of a product it did not write (AC-15). */
export function runProblems(review: Review, result: RunResult): readonly ImportProblem[] {
  const rows = new Map(review.send.map((product) => [product.code, product.rows]));
  const products = result.outcomes.flatMap((outcome) =>
    outcome.outcome === "skipped"
      ? (rows.get(outcome.code) ?? []).map((row): ImportProblem => ({
          row,
          file: null,
          code: outcome.code,
          problem: outcome.problem,
        }))
      : [],
  );
  return [...products, ...result.photoProblems];
}

/** The result line (AC-15), counted from the run's outcomes, not from the review. */
export function runTotals(sheetProducts: number, result: RunResult) {
  const created = result.outcomes.filter((outcome) => outcome.outcome === "created").length;
  const updated = result.outcomes.filter((outcome) => outcome.outcome === "updated").length;
  return {
    created,
    updated: updated + result.photoUpdates,
    photos: result.attached,
    notImported: sheetProducts - created - updated,
  };
}
