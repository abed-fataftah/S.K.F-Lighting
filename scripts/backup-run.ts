// `pnpm backup:run`: the weekly off site copy (spec 0028 AC-4 to AC-6). In order: both dumps from
// one snapshot, each `pg_dump | age | rclone rcat` straight into R2 (no unencrypted byte on disk),
// then the photo copy, then `manifest.json` last, so a manifest means its dumps finished.
// Runs in `.github/workflows/backup.yml`; locally it reads .env.local for anything unset.
// Logs the stamp, counts, and sizes only: never a row, a phone, or an address.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { MEDIA_BUCKET } from "@/features/catalog/media-rules";
import {
  backupPrefix,
  backupStamp,
  mediaGuard,
  newestEarlierManifest,
  parseRecipients,
} from "@/features/launch/backup";
import {
  buildManifest,
  parseManifest,
  totalRows,
  type MediaCount,
} from "@/features/launch/manifest";
import { backupEnv, type BackupEnv } from "@/features/launch/server/env";
import {
  expectAllOk,
  rcloneEnv,
  rcloneSize,
  runOne,
  runPipe,
  toolVersion,
} from "@/features/launch/server/tools";

// The sign in rows only (spec 0028 AC-4): MFA factors, sessions, and refresh tokens stay out.
const AUTH_TABLES = ["auth.users", "auth.identities"] as const;

const DUMPS = [
  { file: "dump.age", args: ["-Fc", "-n", "public", "-n", "drizzle"] },
  { file: "auth.age", args: ["-Fc", "--data-only", "-t", "auth.users", "-t", "auth.identities"] },
] as const;

// rclone stops a sync that would delete more than this many files (AC-6).
const MAX_DELETE = 50;

function loadEnv() {
  // Local runs read the same file as `next dev`; set values win.
  if (!existsSync(".env.local")) return;
  const before = { ...process.env };
  process.loadEnvFile(".env.local");
  Object.assign(process.env, before);
}

type Sizes = Record<string, number>;

/**
 * Opens a read only snapshot, counts every table in it, and keeps it open while both dumps read
 * the same moment in time (`pg_dump --snapshot`).
 */
async function dumpInSnapshot(
  env: BackupEnv,
  recipientsFile: string,
  prefix: string,
  rclone: NodeJS.ProcessEnv,
): Promise<{ readonly counts: Record<string, number>; readonly sizes: Sizes }> {
  const sql = postgres(env.databaseUrl, { max: 1, onnotice: () => {} });
  try {
    return await sql.begin("isolation level repeatable read read only", async (tx) => {
      const [{ snapshot }] = await tx<
        { snapshot: string }[]
      >`select pg_export_snapshot() as snapshot`;
      const listed = await tx<{ schema: string; name: string }[]>`
        select table_schema as schema, table_name as name from information_schema.tables
        where table_schema in ('public', 'drizzle') and table_type = 'BASE TABLE'
        order by 1, 2`;
      const tables = [
        ...listed.map((row) => [row.schema, row.name] as const),
        ...AUTH_TABLES.map((table) => table.split(".") as [string, string]),
      ];
      const counts: Record<string, number> = {};
      for (const [schema, name] of tables) {
        const [{ n }] = await tx<{ n: number }[]>`
          select count(*)::int as n from ${tx(schema)}.${tx(name)}`;
        counts[`${schema}.${name}`] = n;
      }

      const sizes: Sizes = {};
      for (const dump of DUMPS) {
        const target = `r2:${env.r2.bucket}/${prefix}${dump.file}`;
        expectAllOk(
          await runPipe([
            {
              name: `pg_dump ${dump.file}`,
              command: "pg_dump",
              args: [`--snapshot=${snapshot}`, ...dump.args, `--dbname=${env.databaseUrl}`],
            },
            { name: `age ${dump.file}`, command: "age", args: ["-R", recipientsFile] },
            {
              name: `rclone rcat ${dump.file}`,
              command: "rclone",
              args: ["rcat", target],
              env: rclone,
            },
          ]),
        );
        const { bytes } = await rcloneSize(target, rclone);
        if (bytes === 0) throw new Error(`${dump.file} uploaded empty`);
        sizes[dump.file] = bytes;
      }
      return { counts, sizes };
    });
  } finally {
    await sql.end();
  }
}

/** The `media.objects` of the newest earlier manifest under `db/`, or null when there is none. */
async function previousMediaCount(
  env: BackupEnv,
  stamp: string,
  rclone: NodeJS.ProcessEnv,
): Promise<number | null> {
  const root = `r2:${env.r2.bucket}/db/`;
  const listing = await runOne({
    name: "rclone lsf db/",
    command: "rclone",
    args: ["lsf", "-R", "--files-only", "--include", "manifest.json", root],
    env: rclone,
  });
  const path = newestEarlierManifest(listing.split(/\r?\n/), stamp);
  if (!path) return null;
  const text = await runOne({
    name: `rclone cat ${path}`,
    command: "rclone",
    args: ["cat", `${root}${path}`],
    env: rclone,
  });
  return parseManifest(JSON.parse(text)).media?.objects ?? null;
}

/** Copies new and changed photos into `media/current/`, moving replaced and removed ones aside. */
async function copyMedia(
  env: BackupEnv,
  stamp: string,
  rclone: NodeJS.ProcessEnv,
): Promise<MediaCount> {
  const source = `storage:${MEDIA_BUCKET}`;
  const current = `r2:${env.r2.bucket}/media/current`;
  const { count } = await rcloneSize(source, rclone);
  const guard = mediaGuard(count, await previousMediaCount(env, stamp, rclone));
  if (guard === "empty") throw new Error("the product-media bucket is empty; nothing was synced");
  if (guard === "dropped") {
    throw new Error(
      `the product-media bucket shrank by 20% or more (${count} objects); nothing was synced`,
    );
  }
  await runOne({
    name: "rclone sync media",
    command: "rclone",
    args: [
      "sync",
      source,
      current,
      "--backup-dir",
      `r2:${env.r2.bucket}/media/removed/${stamp}`,
      "--check-first",
      "--max-delete",
      String(MAX_DELETE),
    ],
    env: rclone,
  });
  const after = await rcloneSize(current, rclone);
  return { objects: after.count, bytes: after.bytes };
}

async function main() {
  loadEnv();
  const started = new Date();
  // Before anything else: a dump must never be encrypted to the wrong keys (AC-4).
  const recipients = parseRecipients(process.env.BACKUP_AGE_RECIPIENTS);
  if (!recipients.ok) {
    console.error(
      `BACKUP_AGE_RECIPIENTS must hold exactly 2 different age public keys, one per line (${recipients.error}). Nothing was dumped.`,
    );
    process.exitCode = 1;
    return;
  }
  const env = backupEnv();
  const stamp = backupStamp(started);
  const prefix = backupPrefix(stamp, env.eventName);
  const rclone = rcloneEnv(env.r2, env.storage);
  const pgDump = await toolVersion("pg_dump", ["--version"]);
  if (!pgDump) throw new Error("pg_dump is not on the PATH");

  // Public keys only, but kept out of the repo and gone when the run ends.
  const work = mkdtempSync(join(tmpdir(), "skf-backup-"));
  try {
    const recipientsFile = join(work, "recipients.txt");
    writeFileSync(recipientsFile, `${recipients.data.join("\n")}\n`);

    const { counts, sizes } = await dumpInSnapshot(env, recipientsFile, prefix, rclone);

    let media: MediaCount | null = null;
    try {
      media = await copyMedia(env, stamp, rclone);
    } catch (error) {
      // The dump is still good: keep it, write the manifest, then fail the job (AC-5).
      console.error(`Media copy failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const manifest = buildManifest(counts, media, { takenAt: started, gitSha: env.gitSha, pgDump });
    await runOne(
      {
        name: "rclone rcat manifest.json",
        command: "rclone",
        args: ["rcat", `r2:${env.r2.bucket}/${prefix}manifest.json`],
        env: rclone,
      },
      `${JSON.stringify(manifest, null, 2)}\n`,
    );

    const files = Object.entries(sizes).map(([file, bytes]) => `${file} ${bytes} bytes`);
    const photos = media ? `media ${media.objects} objects, ${media.bytes} bytes` : "media FAILED";
    console.log(
      `Backup ${prefix}: ${Object.keys(manifest.tables).length} tables, ${totalRows(manifest)} rows; ${files.join(", ")}; ${photos}.`,
    );
    if (!media) process.exitCode = 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
