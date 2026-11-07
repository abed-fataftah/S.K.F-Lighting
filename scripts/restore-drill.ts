// `pnpm backup:restore-drill --dir <folder> --identity <age key file>`: proves a weekly backup
// opens (spec 0028 AC-9, AC-10). Restores dump.age and auth.age into the LOCAL Supabase database
// only, then checks every row count against manifest.json, the RLS rules, and 3 photos in R2.
// Start from a fresh local database (`supabase db reset`, no seed). Afterwards the local database
// carries production's migration history: run `supabase db reset` before normal work, never
// `pnpm db:migrate` on it. Prints one PASS or FAIL line per check and exits non zero on any FAIL.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { compareCounts, parseManifest, totalRows } from "@/features/launch/manifest";
import { drillEnv, type DrillEnv } from "@/features/launch/server/env";
import {
  postgresMajor,
  rcloneEnv,
  runOne,
  runPipe,
  toolVersion,
} from "@/features/launch/server/tools";
import { getDirectDb } from "@/server/db/direct";
import { isLocalDatabaseUrl } from "@/server/db/local";
import { findRlsProblems } from "@/server/db/rls-check";

const FILES = ["dump.age", "auth.age", "manifest.json"] as const;
// The dump is made by the Postgres 17 client; an older pg_restore cannot read its archive.
const MIN_PG_RESTORE = 17;
const IMAGES_TO_CHECK = 3;

type Check = { readonly name: string; readonly pass: boolean; readonly detail: string };

const USAGE =
  "Usage: pnpm backup:restore-drill --dir <folder with dump.age, auth.age, manifest.json> --identity <age key file>";

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Names every tool the drill needs that is missing or too old (the runbook has the installs). */
async function missingTools(): Promise<readonly string[]> {
  const [pgRestore, age, rclone] = await Promise.all([
    toolVersion("pg_restore", ["--version"]),
    toolVersion("age", ["--version"]),
    toolVersion("rclone", ["version"]),
  ]);
  const major = postgresMajor(pgRestore);
  return [
    ...(major === null
      ? ["pg_restore (PostgreSQL 17 or newer)"]
      : major < MIN_PG_RESTORE
        ? [`pg_restore 17 or newer (found ${major})`]
        : []),
    ...(age ? [] : ["age"]),
    ...(rclone ? [] : ["rclone"]),
  ];
}

async function decrypt(identity: string, from: string, to: string) {
  const name = from.endsWith("auth.age") ? "auth.age" : "dump.age";
  const { exits } = await runPipe([
    { name: `age -d ${name}`, command: "age", args: ["-d", "-i", identity, "-o", to, from] },
  ]);
  if (exits[0]?.code !== 0) {
    throw new Error(`Could not decrypt ${name}: is --identity a key this backup was encrypted to?`);
  }
}

/** The three step restore (AC-9): empty the sign in rows, load them with no triggers, then the data. */
async function restore(databaseUrl: string, authFile: string, dumpFile: string): Promise<number> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    // Also empties auth.identities and, through the foreign key, public.profiles.
    await sql`truncate auth.users cascade`;
  } finally {
    await sql.end();
  }
  // One session with replica role: handle_new_user does not fire and make a second profile.
  await runOne({
    name: "pg_restore auth.age",
    command: "pg_restore",
    args: [
      "--data-only",
      "--disable-triggers",
      "--exit-on-error",
      `--dbname=${databaseUrl}`,
      authFile,
    ],
    env: { ...process.env, PGOPTIONS: "-c session_replication_role=replica" },
  });
  // Exit on error stays off: warnings are counted, and the count checks decide pass or fail.
  const { exits } = await runPipe([
    {
      name: "pg_restore dump.age",
      command: "pg_restore",
      args: [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "-n",
        "public",
        "-n",
        "drizzle",
        `--dbname=${databaseUrl}`,
        dumpFile,
      ],
    },
  ]);
  const result = exits[0]!;
  if (result.code === null) throw new Error("pg_restore dump.age did not run");
  return result.stderr.split(/\r?\n/).filter((line) => /^pg_restore: (error|warning):/.test(line))
    .length;
}

/** The restored row count of each manifest table; null for a table that is not there. */
async function restoredCounts(
  databaseUrl: string,
  tables: readonly string[],
): Promise<Record<string, number | null>> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const counts: Record<string, number | null> = {};
    for (const table of tables) {
      const [schema, name] = table.split(".") as [string, string];
      const [{ found }] = await sql<{ found: boolean }[]>`
        select to_regclass(${`"${schema}"."${name}"`}) is not null as found`;
      if (!found) {
        counts[table] = null;
        continue;
      }
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n from ${sql(schema)}.${sql(name)}`;
      counts[table] = n;
    }
    return counts;
  } finally {
    await sql.end();
  }
}

async function rlsCheck(): Promise<Check> {
  const db = getDirectDb();
  try {
    const problems = await findRlsProblems(db);
    return problems.length === 0
      ? {
          name: "RLS",
          pass: true,
          detail: "every public table has RLS, browser roles have nothing",
        }
      : {
          name: "RLS",
          pass: false,
          detail: problems
            .map((p) => `${p.kind} ${p.object}${p.role ? ` (${p.role})` : ""}`)
            .join("; "),
        };
  } finally {
    await db.$client.end();
  }
}

/** The first 3 product photos of the restored database, looked up in `media/current/` (AC-10). */
async function imageCheck(env: DrillEnv, databaseUrl: string): Promise<Check> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const keys = await sql<{ storage_key: string }[]>`
    select storage_key from public.product_media where kind = 'image'
    order by id limit ${IMAGES_TO_CHECK}`.finally(() => sql.end());
  if (keys.length === 0) {
    return {
      name: "photos",
      pass: false,
      detail: "the restored database has no product photos to look up",
    };
  }
  const rclone = rcloneEnv(env.r2);
  const missing: string[] = [];
  for (const { storage_key: key } of keys) {
    const listed = await runOne({
      name: `rclone lsf ${key}`,
      command: "rclone",
      args: ["lsf", `r2:${env.r2.bucket}/media/current/${key}`],
      env: rclone,
    }).catch(() => "");
    if (!listed.trim()) missing.push(key);
  }
  return missing.length === 0
    ? {
        name: "photos",
        pass: true,
        detail: `${keys.length} restored photos found in media/current/`,
      }
    : { name: "photos", pass: false, detail: `missing in media/current/: ${missing.join(", ")}` };
}

async function main() {
  const { values } = parseArgs({
    options: { dir: { type: "string" }, identity: { type: "string" } },
  });
  if (!values.dir || !values.identity) refuse(USAGE);

  if (!process.env.DATABASE_URL_DIRECT && existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
  if (!isLocalDatabaseUrl(process.env.DATABASE_URL_DIRECT)) {
    refuse(
      "Refusing to restore: DATABASE_URL_DIRECT must point at the local Supabase database " +
        "(localhost or 127.0.0.1, port 54322). Nothing was changed.",
    );
  }

  const missing = await missingTools();
  if (missing.length > 0) {
    refuse(
      `Missing on the PATH: ${missing.join(", ")}. See docs/runbooks/go-live.md, "Tools on Windows".`,
    );
  }

  const env = drillEnv();
  const dir = resolve(values.dir);
  const absent = FILES.filter((file) => !existsSync(join(dir, file)));
  if (absent.length > 0) refuse(`Not in ${dir}: ${absent.join(", ")}.`);
  if (!existsSync(values.identity)) refuse("The --identity file does not exist.");
  const manifest = parseManifest(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")));

  // Decrypted dumps hold customer data: they live in the OS temp folder only while the drill runs.
  const work = mkdtempSync(join(tmpdir(), "skf-drill-"));
  const checks: Check[] = [];
  try {
    const authFile = join(work, "auth.dump");
    const dumpFile = join(work, "public.dump");
    await decrypt(values.identity, join(dir, "auth.age"), authFile);
    await decrypt(values.identity, join(dir, "dump.age"), dumpFile);

    const warnings = await restore(env.databaseUrl, authFile, dumpFile);
    console.log(
      `pg_restore: ${warnings} warning or error lines while restoring public and drizzle (counted, not fatal).`,
    );

    const restored = await restoredCounts(env.databaseUrl, Object.keys(manifest.tables));
    const mismatches = compareCounts(manifest, restored);
    checks.push(
      mismatches.length === 0
        ? {
            name: "counts",
            pass: true,
            detail: `${Object.keys(manifest.tables).length} tables, ${totalRows(manifest)} rows, all match`,
          }
        : {
            name: "counts",
            pass: false,
            detail: mismatches
              .map((m) => `${m.table} expected ${m.expected}, got ${m.actual ?? "no table"}`)
              .join("; "),
          },
    );
    checks.push(await rlsCheck());
    checks.push(
      manifest.media === null
        ? {
            name: "photos",
            pass: false,
            detail: "skipped: the manifest says the photo copy failed",
          }
        : await imageCheck(env, env.databaseUrl),
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  console.log(`Restore drill of the backup taken ${manifest.takenAt} (commit ${manifest.gitSha}):`);
  for (const check of checks) {
    console.log(`  ${check.pass ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`);
  }
  if (checks.some((check) => !check.pass)) {
    process.exitCode = 1;
    return;
  }
  console.log(
    "Next, by hand: `pnpm dev`, open a real product page and a real order in the dashboard. " +
      "Then `supabase db reset` before going back to normal local work.",
  );
}

main().catch((error: unknown) => {
  console.error(`Restore drill failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
