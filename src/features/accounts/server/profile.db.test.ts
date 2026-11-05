import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { profiles } from "@/server/db/schema";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { readAccountProfile, savePhoneAfterSignUp, updateProfileInDb } = await import("./profile");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

const PHONE = { typed: "0599 123 456", e164: "+970599123456" };

// As Supabase's sign up writes it: the trigger makes the profile from this metadata.
async function signUpRow(tx: Transaction, email: string, metadata: Record<string, string>) {
  const [user] = await tx.execute<{ id: string }>(sql`
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (gen_random_uuid(), 'authenticated', 'authenticated', ${email}, ${JSON.stringify(metadata)}::jsonb)
    returning id`);
  return user.id;
}

const rowOf = async (tx: Transaction, id: string) =>
  (await tx.select().from(profiles).where(eq(profiles.id, id)))[0];

// covers: AC-2, AC-4, AC-9, AC-17 (spec 0017)
describe.skipIf(!hasLocalDb)("account profile on the local database", () => {
  it("gives a new account a customer profile named from its metadata, whatever role is sent", async () => {
    await withRollback(db, async (tx) => {
      const id = await signUpRow(tx, "acc-role@example.test", {
        full_name: "أحمد يوسف",
        role: "admin",
      });
      expect(await readAccountProfile(tx, id)).toEqual({
        fullName: "أحمد يوسف",
        phone: null,
        phoneE164: null,
        role: "customer",
      });
    });
  });

  it("writes the phone in both forms on the profile the trigger made, keeping the name", async () => {
    await withRollback(db, async (tx) => {
      const id = await signUpRow(tx, "acc-phone@example.test", { full_name: "سارة علي" });
      await savePhoneAfterSignUp(tx, id, { fullName: "اسم آخر", phone: PHONE });
      expect(await rowOf(tx, id)).toMatchObject({
        fullName: "سارة علي",
        phone: "0599 123 456",
        phoneE164: "+970599123456",
        role: "customer",
      });
    });
  });

  it("makes the profile row when it is missing", async () => {
    await withRollback(db, async (tx) => {
      const id = await signUpRow(tx, "acc-missing@example.test", { full_name: "سارة علي" });
      await tx.delete(profiles).where(eq(profiles.id, id));
      expect(await readAccountProfile(tx, id)).toBeNull();

      await savePhoneAfterSignUp(tx, id, { fullName: "سارة علي", phone: PHONE });
      expect(await rowOf(tx, id)).toMatchObject({
        fullName: "سارة علي",
        phoneE164: "+970599123456",
        role: "customer",
      });
    });
  });

  it("updates the name and both phone columns together, and never the role", async () => {
    await withRollback(db, async (tx) => {
      const id = await signUpRow(tx, "acc-update@example.test", { full_name: "سارة علي" });
      await tx.update(profiles).set({ role: "electrician" }).where(eq(profiles.id, id));

      await updateProfileInDb(tx, id, {
        name: "سارة محمود",
        phone: { typed: "+970 568 000 111", e164: "+970568000111" },
      });
      expect(await readAccountProfile(tx, id)).toEqual({
        fullName: "سارة محمود",
        phone: "+970 568 000 111",
        phoneE164: "+970568000111",
        role: "electrician",
      });
    });
  });

  it("reads null for a user with no profile", async () => {
    await withRollback(db, async (tx) => {
      expect(await readAccountProfile(tx, "00000000-0000-4000-8000-000000000000")).toBeNull();
    });
  });
});
