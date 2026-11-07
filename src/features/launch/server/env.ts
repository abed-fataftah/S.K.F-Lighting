import "server-only";
import { z } from "zod";

// Script only settings (spec 0028): parsed once per script, never by the app's own env module, so
// the Worker never needs a backup variable to start. Errors name the variable, never its value.

const required = z.string({ error: "is not set" }).min(1, "is not set");
const s3Endpoint = z.url({
  protocol: /^https?$/,
  error: (issue) => (issue.input === undefined ? "is not set" : "must be an http(s) URL"),
});
// R2 bucket names: lower case letters, digits, and hyphens, 3 to 63 long.
const bucket = z
  .string({ error: "is not set" })
  .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "is not an R2 bucket name");

export type R2Remote = {
  readonly endpoint: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

export type StorageRemote = {
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

export type BackupEnv = {
  readonly databaseUrl: string;
  readonly r2: R2Remote;
  readonly storage: StorageRemote;
  /** `schedule` for the Sunday run; anything else is a hand run. */
  readonly eventName: string | undefined;
  readonly gitSha: string;
};

export type DrillEnv = {
  readonly databaseUrl: string;
  /** The read only token for the same bucket (spec 0028 security model). */
  readonly r2: R2Remote;
};

type Env = Readonly<Record<string, string | undefined>>;

const backupSchema = z.object({
  DATABASE_URL_DIRECT: required,
  R2_ENDPOINT: s3Endpoint,
  R2_BUCKET: bucket,
  R2_ACCESS_KEY_ID: required,
  R2_SECRET_ACCESS_KEY: required,
  SUPABASE_S3_ENDPOINT: s3Endpoint,
  SUPABASE_S3_REGION: required,
  SUPABASE_S3_ACCESS_KEY_ID: required,
  SUPABASE_S3_SECRET_ACCESS_KEY: required,
  GITHUB_EVENT_NAME: z.string().optional(),
  GITHUB_SHA: z.string().optional(),
});

const drillSchema = z.object({
  DATABASE_URL_DIRECT: required,
  R2_ENDPOINT: s3Endpoint,
  R2_BUCKET: bucket,
  DRILL_R2_ACCESS_KEY_ID: required,
  DRILL_R2_SECRET_ACCESS_KEY: required,
});

function parseOrExit<T>(schema: z.ZodType<T>, env: Env, keys: readonly string[]): T {
  // An empty value counts as unset.
  const input = Object.fromEntries(keys.map((key) => [key, env[key] || undefined]));
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const lines = parsed.error.issues.map((issue) => `  ${issue.path.join(".")} ${issue.message}`);
  throw new Error(`Missing or bad settings:\n${lines.join("\n")}`);
}

export function backupEnv(env: Env = process.env): BackupEnv {
  const e = parseOrExit(backupSchema, env, Object.keys(backupSchema.shape));
  return {
    databaseUrl: e.DATABASE_URL_DIRECT,
    r2: {
      endpoint: e.R2_ENDPOINT,
      bucket: e.R2_BUCKET,
      accessKeyId: e.R2_ACCESS_KEY_ID,
      secretAccessKey: e.R2_SECRET_ACCESS_KEY,
    },
    storage: {
      endpoint: e.SUPABASE_S3_ENDPOINT,
      region: e.SUPABASE_S3_REGION,
      accessKeyId: e.SUPABASE_S3_ACCESS_KEY_ID,
      secretAccessKey: e.SUPABASE_S3_SECRET_ACCESS_KEY,
    },
    eventName: e.GITHUB_EVENT_NAME,
    gitSha: e.GITHUB_SHA ?? "local",
  };
}

export function drillEnv(env: Env = process.env): DrillEnv {
  const e = parseOrExit(drillSchema, env, Object.keys(drillSchema.shape));
  return {
    databaseUrl: e.DATABASE_URL_DIRECT,
    r2: {
      endpoint: e.R2_ENDPOINT,
      bucket: e.R2_BUCKET,
      accessKeyId: e.DRILL_R2_ACCESS_KEY_ID,
      secretAccessKey: e.DRILL_R2_SECRET_ACCESS_KEY,
    },
  };
}
