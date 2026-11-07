import "server-only";
import { spawn } from "node:child_process";
import type { R2Remote, StorageRemote } from "./env";

// The outside tools the backup and the drill drive (spec 0028 AC-4, AC-9): `pg_dump`,
// `pg_restore`, `age`, and `rclone`. No shell: each process is spawned directly, and a pipe of
// several waits for every one of them, the Node form of `set -o pipefail`.

export type Stage = {
  /** Names the stage in an error, e.g. `pg_dump dump.age`. Never holds a secret. */
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
};

export type StageExit = {
  readonly name: string;
  /** null: the process never started (not on the PATH) or was stopped. */
  readonly code: number | null;
  /** True when it was stopped because another stage failed first. */
  readonly stopped: boolean;
  readonly stderr: string;
};

export type PipeResult = { readonly exits: readonly StageExit[]; readonly stdout: string };

const STDERR_KEEP = 256 * 1024;

/**
 * Runs `stages` as one pipe (`a | b | c`), writing `input` (if any) to the first, and resolves
 * once every process has exited. When one fails, the rest are stopped, so a stuck writer never
 * hangs the run.
 */
export function runPipe(stages: readonly Stage[], input?: string): Promise<PipeResult> {
  const children = stages.map((stage) =>
    spawn(stage.command, stage.args, {
      env: stage.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    }),
  );
  const stderr = children.map(() => "");
  const exited = children.map(() => false);
  const stopped = children.map(() => false);
  const stopOthers = () =>
    children.forEach((child, i) => {
      if (exited[i]) return;
      stopped[i] = true;
      child.kill();
    });

  children.forEach((child, i) => {
    // A closed pipe after a failure is expected; the exit codes tell what went wrong.
    child.stdin.on("error", () => {});
    child.stdout.on("error", () => {});
    child.stderr.on("data", (chunk: Buffer) => {
      stderr[i] = (stderr[i] + chunk.toString("utf8")).slice(-STDERR_KEEP);
    });
    const next = children[i + 1];
    if (next) child.stdout.pipe(next.stdin);
  });

  const first = children[0];
  if (first) first.stdin.end(input ?? "");

  let stdout = "";
  const last = children.at(-1);
  last?.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });

  const exits = children.map(
    (child, i) =>
      new Promise<StageExit>((resolve) => {
        let done = false;
        const finish = (code: number | null) => {
          if (done) return;
          done = true;
          exited[i] = true;
          if (code !== 0) stopOthers();
          resolve({ name: stages[i]!.name, code, stopped: stopped[i]!, stderr: stderr[i]! });
        };
        child.on("error", () => finish(null));
        child.on("close", (code) => finish(code));
      }),
  );
  return Promise.all(exits).then((all) => ({ exits: all, stdout }));
}

/** The last line of a stage's error output, enough to act on, short enough for a log. */
const lastLine = (text: string) => text.trim().split(/\r?\n/).at(-1)?.slice(0, 300) ?? "";

/** Throws naming the stage that failed first: one that failed on its own, not one stopped after it. */
export function expectAllOk(result: PipeResult): PipeResult {
  const failures = result.exits.filter((exit) => exit.code !== 0);
  const failed = failures.find((exit) => !exit.stopped) ?? failures[0];
  if (!failed) return result;
  const how = failed.stopped
    ? "was stopped"
    : failed.code === null
      ? "did not run (is it on the PATH?)"
      : `exited ${failed.code}`;
  const detail = lastLine(failed.stderr);
  throw new Error(`${failed.name} ${how}${detail ? `: ${detail}` : ""}`);
}

/** One command, its output, and an error naming it when it fails. */
export async function runOne(stage: Stage, input?: string): Promise<string> {
  return expectAllOk(await runPipe([stage], input)).stdout;
}

/** `pg_dump (PostgreSQL) 17.6`, or null when the tool is not on the PATH. */
export async function toolVersion(
  command: string,
  args: readonly string[],
): Promise<string | null> {
  const { exits, stdout } = await runPipe([{ name: command, command, args }]);
  return exits[0]?.code === 0 ? stdout.trim().split(/\r?\n/)[0]!.trim() : null;
}

/** The major version in `pg_restore (PostgreSQL) 17.6`, or null. */
export function postgresMajor(version: string | null): number | null {
  const match = /\(PostgreSQL\)\s+(\d+)/.exec(version ?? "");
  return match ? Number(match[1]) : null;
}

// rclone reads remotes from RCLONE_CONFIG_<NAME>_<OPTION>, so no config file holds a key.
// `r2:` is the backup bucket, `storage:` is Supabase Storage's S3 endpoint.

export function rcloneEnv(r2: R2Remote, storage?: StorageRemote): NodeJS.ProcessEnv {
  return {
    ...process.env,
    RCLONE_CONFIG_R2_TYPE: "s3",
    RCLONE_CONFIG_R2_PROVIDER: "Cloudflare",
    RCLONE_CONFIG_R2_ENDPOINT: r2.endpoint,
    RCLONE_CONFIG_R2_REGION: "auto",
    RCLONE_CONFIG_R2_ACCESS_KEY_ID: r2.accessKeyId,
    RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: r2.secretAccessKey,
    // The token is scoped to one bucket and cannot create or check buckets.
    RCLONE_CONFIG_R2_NO_CHECK_BUCKET: "true",
    ...(storage && {
      RCLONE_CONFIG_STORAGE_TYPE: "s3",
      RCLONE_CONFIG_STORAGE_PROVIDER: "Other",
      RCLONE_CONFIG_STORAGE_ENDPOINT: storage.endpoint,
      RCLONE_CONFIG_STORAGE_REGION: storage.region,
      RCLONE_CONFIG_STORAGE_ACCESS_KEY_ID: storage.accessKeyId,
      RCLONE_CONFIG_STORAGE_SECRET_ACCESS_KEY: storage.secretAccessKey,
      RCLONE_CONFIG_STORAGE_FORCE_PATH_STYLE: "true",
    }),
  };
}

export type RcloneSize = { readonly count: number; readonly bytes: number };

/** `rclone size --json` of a remote path: how many objects, how many bytes. */
export async function rcloneSize(path: string, env: NodeJS.ProcessEnv): Promise<RcloneSize> {
  const out = await runOne({
    name: `rclone size ${path}`,
    command: "rclone",
    args: ["size", "--json", path],
    env,
  });
  const parsed = JSON.parse(out) as { count?: unknown; bytes?: unknown };
  if (typeof parsed.count !== "number" || typeof parsed.bytes !== "number") {
    throw new Error(`rclone size ${path} gave no count`);
  }
  return { count: parsed.count, bytes: parsed.bytes };
}
