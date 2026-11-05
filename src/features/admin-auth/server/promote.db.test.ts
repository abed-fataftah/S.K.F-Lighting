import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { profiles } from "@/server/db/schema";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";
import { promoteMessage } from "./promote";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { promoteToAdmin } = await import("./promote");
const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// The handle_new_user trigger gives every auth user a `customer` profile.
async function insertAuthUser(tx: Transaction, email: string) {
  const [user] = await tx.execute<{ id: string }>(sql`
    insert into auth.users (id, aud, role, email)
    values (gen_random_uuid(), 'authenticated', 'authenticated', ${email})
    returning id`);
  return user.id;
}

const roleOf = async (tx: Transaction, id: string) =>
  (await tx.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, id)))[0]?.role;

// covers: AC-1 (spec 0004), `pnpm admin:promote`
describe.skipIf(!hasLocalDb)("promoteToAdmin on the local database", () => {
  it("makes the account an admin, matching the email in any case", async () => {
    await withRollback(db, async (tx) => {
      const id = await insertAuthUser(tx, "owner-promote@example.test");

      expect(await promoteToAdmin(tx, "  Owner-Promote@Example.test ")).toEqual({
        kind: "promoted",
        userId: id,
      });
      expect(await roleOf(tx, id)).toBe("admin");
    });
  });

  it("reports an email with no account", async () => {
    await withRollback(db, async (tx) => {
      expect(await promoteToAdmin(tx, "nobody-here@example.test")).toEqual({
        kind: "user_not_found",
      });
    });
  });

  it("reports an account with no profile row and changes nothing", async () => {
    await withRollback(db, async (tx) => {
      const id = await insertAuthUser(tx, "no-profile@example.test");
      await tx.delete(profiles).where(eq(profiles.id, id));

      expect(await promoteToAdmin(tx, "no-profile@example.test")).toEqual({
        kind: "profile_missing",
        userId: id,
      });
    });
  });
});

describe("promoteMessage", () => {
  it("tells the operator what to do next in each case", () => {
    expect(promoteMessage({ kind: "promoted", userId: "u" }, "a@b.c")).toContain("/admin/login");
    expect(promoteMessage({ kind: "user_not_found" }, "a@b.c")).toContain("Add user");
    expect(promoteMessage({ kind: "profile_missing", userId: "u" }, "a@b.c")).toContain(
      "handle_new_user",
    );
  });
});
