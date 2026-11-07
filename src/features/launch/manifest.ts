// The backup manifest (spec 0028 AC-5, AC-10): what a dump holds, counted in the dump's own
// snapshot, so a restore can prove it brought every row back. It never holds customer data.
import { z } from "zod";

export type MediaCount = { readonly objects: number; readonly bytes: number };

export type BackupManifest = {
  readonly takenAt: string;
  readonly gitSha: string;
  readonly pgDump: string;
  readonly tables: Readonly<Record<string, number>>;
  /** null: the photo copy failed, the dump is still good. */
  readonly media: MediaCount | null;
};

const count = z.number().int().min(0);

const manifestSchema = z.object({
  takenAt: z.iso.datetime(),
  gitSha: z.string().min(1),
  pgDump: z.string().min(1),
  tables: z
    .record(z.string().regex(/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i), count)
    .refine((tables) => Object.keys(tables).length > 0, "The manifest lists no tables."),
  media: z.object({ objects: count, bytes: count }).nullable(),
});

/** A manifest read back from R2, or the reason it is not one. */
export function parseManifest(json: unknown): BackupManifest {
  return manifestSchema.parse(json);
}

export type ManifestMeta = {
  readonly takenAt: Date;
  readonly gitSha: string;
  readonly pgDump: string;
};

/** The manifest for one run: tables in name order, so two runs diff cleanly. */
export function buildManifest(
  counts: Readonly<Record<string, number>>,
  media: MediaCount | null,
  meta: ManifestMeta,
): BackupManifest {
  const tables = Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return parseManifest({
    takenAt: meta.takenAt.toISOString(),
    gitSha: meta.gitSha,
    pgDump: meta.pgDump,
    tables,
    media,
  });
}

/** The total rows a manifest counts, for the one summary log line. */
export function totalRows(manifest: BackupManifest): number {
  return Object.values(manifest.tables).reduce((sum, n) => sum + n, 0);
}

export type Mismatch = {
  readonly table: string;
  readonly expected: number;
  /** null: the table is missing from the restored database. */
  readonly actual: number | null;
};

/** Every manifest table whose restored count differs (AC-10). Empty means every count matches. */
export function compareCounts(
  manifest: BackupManifest,
  restored: Readonly<Record<string, number | null>>,
): readonly Mismatch[] {
  return Object.entries(manifest.tables)
    .map(([table, expected]) => ({ table, expected, actual: restored[table] ?? null }))
    .filter((row) => row.actual !== row.expected);
}
