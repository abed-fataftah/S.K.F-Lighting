// The weekly backup's pure rules (spec 0028 AC-4 to AC-6): where a run writes, which keys it
// encrypts to, and when the photo copy must not run. scripts/backup-run.ts does the side effects.
import { fail, ok, type Result } from "@/lib/result";

const STAMP = /^\d{8}T\d{4}Z$/;

/** `20261108T0100Z`: an instant in UTC to the minute (AC-4). Sliced from the ISO string, so no local clock. */
export function backupStamp(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
}

/** `db/<stamp>/` for the Sunday run; any other start (a hand run, a local proof) writes under `db/manual/<stamp>/`. */
export function backupPrefix(stamp: string, eventName: string | undefined): string {
  if (!STAMP.test(stamp)) throw new RangeError(`Not a backup stamp: ${stamp}`);
  return eventName === "schedule" ? `db/${stamp}/` : `db/manual/${stamp}/`;
}

/** 2 keys normally, 3 only while one is being rotated (AC-4, AC-17). */
export type Recipients = readonly [string, string] | readonly [string, string, string];

const AGE_RECIPIENT = /^age1[0-9a-z]+$/;

/** The `age` public keys, one per line (AC-4). Blank lines are ignored; anything else refuses. */
export function parseRecipients(
  text: string | undefined,
): Result<Recipients, "not_two_or_three_keys" | "not_age_keys" | "same_key"> {
  const lines = (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length !== 2 && lines.length !== 3) return fail("not_two_or_three_keys");
  if (!lines.every((line) => AGE_RECIPIENT.test(line))) return fail("not_age_keys");
  if (new Set(lines).size !== lines.length) return fail("same_key");
  return ok(lines as unknown as Recipients);
}

export type MediaGuard = "ok" | "empty" | "dropped";

/**
 * Whether the photo sync may run (AC-6): never on an empty source, and never when the source holds
 * at least 20% fewer objects than the last manifest counted. No earlier count skips the drop check.
 */
export function mediaGuard(sourceObjects: number, previousObjects: number | null): MediaGuard {
  if (sourceObjects === 0) return "empty";
  if (previousObjects !== null && (previousObjects - sourceObjects) * 5 >= previousObjects) {
    return "dropped";
  }
  return "ok";
}

const MANIFEST_PATH = /^(?:manual\/)?(\d{8}T\d{4}Z)\/manifest\.json$/;

/**
 * The newest manifest older than `stamp`, from an `rclone lsf -R` listing of `db/` (paths like
 * `20261101T0100Z/manifest.json` and `manual/20261103T1200Z/manifest.json`), or null.
 */
export function newestEarlierManifest(paths: readonly string[], stamp: string): string | null {
  const earlier = paths
    .map((path) => ({ path, stamp: MANIFEST_PATH.exec(path.trim())?.[1] }))
    .filter((entry): entry is { path: string; stamp: string } => !!entry.stamp)
    .filter((entry) => entry.stamp < stamp)
    .sort((a, b) => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0));
  return earlier[0]?.path.trim() ?? null;
}
