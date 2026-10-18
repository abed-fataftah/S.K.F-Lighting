import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { hasLocalDb, withRollback } from "./testing";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("./direct");
const { findRlsProblems } = await import("./rls-check");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// covers: AC-2
describe.skipIf(!hasLocalDb)("RLS check", () => {
  it("passes on the migrated schema", async () => {
    expect(await findRlsProblems(db)).toEqual([]);
  });

  it("fails on a committed table without RLS, and new objects get no browser privileges", async () => {
    try {
      await db.execute(sql`create table public.__rls_probe (id int)`);
      await db.execute(
        sql`create function public.__rls_probe_fn() returns int language sql as 'select 1'`,
      );

      const problems = await findRlsProblems(db);

      expect(problems).toEqual([{ kind: "rls_disabled", object: "__rls_probe" }]);
    } finally {
      await db.execute(sql`drop table if exists public.__rls_probe`);
      await db.execute(sql`drop function if exists public.__rls_probe_fn()`);
    }
  });

  it.each(["anon", "authenticated"])("denies %s a select and the signup function", async (role) => {
    await withRollback(db, async (tx) => {
      await tx.execute(sql.raw(`set local role ${role}`));
      const select = await tx
        .transaction((sp) => sp.execute(sql`select 1 from public.orders limit 1`))
        .catch((error: unknown) => error);
      const call = await tx
        .transaction((sp) => sp.execute(sql`select public.handle_new_user()`))
        .catch((error: unknown) => error);

      const codeOf = (error: unknown) => (error as { cause?: { code?: string } }).cause?.code;
      expect(codeOf(select)).toBe("42501");
      expect(codeOf(call)).toBe("42501");
    });
  });
});
