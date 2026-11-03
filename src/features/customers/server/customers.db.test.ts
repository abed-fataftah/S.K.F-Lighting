import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { normalizeForSearch } from "@/lib/arabic";
import { accountEvents, orders, profiles } from "@/server/db/schema";
import {
  expectViolation,
  hasLocalDb,
  insertSimpleProduct,
  withRollback,
} from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";
import { classifyCustomerSearch } from "../search";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { insertAdminUser, insertCustomerUser, insertTestOrder } =
  await import("@/features/orders/server/testing");
const { readAccountProfile } = await import("@/features/accounts/server/profile");
const queries = await import("./admin-queries");
const writes = await import("./account-writes");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// A far future year keeps these rows first in the list and away from real ones, in the rollback.
const at = (day: number) => new Date(`2097-03-${String(day).padStart(2, "0")}T08:00:00Z`);

async function account(
  tx: Transaction,
  email: string,
  opts: {
    readonly name?: string | null;
    readonly phone?: string | null;
    readonly phoneE164?: string | null;
    readonly day?: number;
  } = {},
) {
  const id = await insertCustomerUser(tx, email);
  await tx
    .update(profiles)
    .set({
      fullName: opts.name ?? null,
      phone: opts.phone ?? null,
      phoneE164: opts.phoneE164 ?? null,
      createdAt: at(opts.day ?? 1),
    })
    .where(eq(profiles.id, id));
  return id;
}

const ids = (rows: readonly { readonly id: string }[]) => rows.map((row) => row.id);

const search = (text: string) => {
  const kind = classifyCustomerSearch(text);
  if (kind.kind === "invalid") throw new Error(`invalid search ${text}`);
  return kind;
};

// covers: AC-1, AC-2 (spec 0019)
describe.skipIf(!hasLocalDb)("readAdminCustomers", () => {
  it("lists customers and electricians newest first, a tie by id, and never an admin", async () => {
    await withRollback(db, async (tx) => {
      const old = await account(tx, "c-old@example.test", { day: 1 });
      const tieA = await account(tx, "c-tie-a@example.test", { day: 2 });
      const tieB = await account(tx, "c-tie-b@example.test", { day: 2 });
      await tx.update(profiles).set({ role: "electrician" }).where(eq(profiles.id, tieA));
      const admin = await insertAdminUser(tx, "c-admin@example.test");
      await tx
        .update(profiles)
        .set({ createdAt: at(9) })
        .where(eq(profiles.id, admin));

      const { rows } = await queries.readAdminCustomers(tx, 1);
      const tie = [tieA, tieB].sort().reverse();
      expect(ids(rows).slice(0, 3)).toEqual([...tie, old]);
      expect(ids(rows)).not.toContain(admin);
      expect(rows.find((row) => row.id === tieA)?.role).toBe("electrician");
    });
  });

  it("counts orders that are not cancelled, and marks a pending removal", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-CUS-1");
      const me = await account(tx, "c-count@example.test", { day: 5 });
      await insertTestOrder(tx, { placedAt: at(1), variant, placedByUserId: me });
      await insertTestOrder(tx, {
        placedAt: at(2),
        variant,
        placedByUserId: me,
        status: "delivered",
      });
      await insertTestOrder(tx, {
        placedAt: at(3),
        variant,
        placedByUserId: me,
        status: "cancelled",
      });
      await tx.insert(accountEvents).values({ profileId: me, type: "removed" });

      const { rows } = await queries.readAdminCustomers(tx, 1);
      expect(rows[0]).toMatchObject({ id: me, orderCount: 2, removalPending: true });
    });
  });
});

// covers: AC-3 (spec 0019)
describe.skipIf(!hasLocalDb)("readCustomerSearch", () => {
  it("finds an email in any case, a phone typed in Arabic digits, and a folded name", async () => {
    await withRollback(db, async (tx) => {
      const sami = await account(tx, "sami.k@example.test", {
        name: "سامي خليل",
        phone: "0599123456",
        phoneE164: "+970599123456",
      });
      const fatima = await account(tx, "fatima@example.test", { name: "فاطمة أحمد" });
      const admin = await insertAdminUser(tx, "sami.owner@example.test");
      await tx
        .update(profiles)
        .set({ fullName: "سامي المالك", phoneE164: "+970599123456" })
        .where(eq(profiles.id, admin));

      expect(ids((await queries.readCustomerSearch(tx, search("SAMI.K@Example"))).rows)).toEqual([
        sami,
      ]);
      expect(ids((await queries.readCustomerSearch(tx, search("٠٥٩٩١٢٣٤٥٦"))).rows)).toEqual([
        sami,
      ]);
      expect(ids((await queries.readCustomerSearch(tx, search("فاطمه احمد"))).rows)).toEqual([
        fatima,
      ]);
      expect(ids((await queries.readCustomerSearch(tx, search("سامي"))).rows)).toContain(sami);
      expect(ids((await queries.readCustomerSearch(tx, search("سامي"))).rows)).not.toContain(admin);
    });
  });

  it("treats % and _ in an email search as plain characters", async () => {
    await withRollback(db, async (tx) => {
      await account(tx, "under_score@example.test");
      await account(tx, "underxscore@example.test");
      const found = await queries.readCustomerSearch(tx, search("under_score@"));
      expect(found.rows).toHaveLength(1);
      expect((await queries.readCustomerSearch(tx, search("%@example.test"))).rows).toHaveLength(0);
    });
  });

  it("shows 50 and says there are more", async () => {
    await withRollback(db, async (tx) => {
      for (let i = 0; i < 51; i++) await account(tx, `bulk-${i}@cap.example.test`);
      const found = await queries.readCustomerSearch(tx, search("@cap.example.test"));
      expect(found.rows).toHaveLength(50);
      expect(found.capped).toBe(true);
    });
  });

  it("folds names in SQL exactly as normalizeForSearch does", async () => {
    await withRollback(db, async (tx) => {
      const names = ["أحمد", "إسراء", "آمنة", "مُصطفى", "هيئة", "مؤمن", "Sami KHALIL", "ٱلزهراء"];
      for (const name of names) {
        const [row] = await tx.execute<{ folded: string }>(
          sql`select ${queries.searchNameSql(sql`${name}::text`)} as folded`,
        );
        expect(row.folded, name).toBe(normalizeForSearch(name));
      }
    });
  });
});

// covers: AC-4, AC-5 (spec 0019)
describe.skipIf(!hasLocalDb)("readAdminCustomer and readCustomerTotals", () => {
  it("reads the details with the email, and null for an admin, a missing id, or a bad id", async () => {
    await withRollback(db, async (tx) => {
      const me = await account(tx, "c-page@example.test", { name: "سامي" });
      const admin = await insertAdminUser(tx, "c-page-admin@example.test");

      expect(await queries.readAdminCustomer(tx, me)).toMatchObject({
        id: me,
        fullName: "سامي",
        email: "c-page@example.test",
        role: "customer",
        removalPending: false,
        totals: { orderCount: 0, spent: 0, owed: 0 },
      });
      expect(await queries.readAdminCustomer(tx, admin)).toBeNull();
      expect(await queries.readAdminCustomer(tx, crypto.randomUUID())).toBeNull();
      expect(await queries.readAdminCustomer(tx, "not-a-uuid")).toBeNull();
    });
  });

  it("sums delivered orders only, and what they still owe", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-CUS-2");
      const me = await account(tx, "c-totals@example.test");
      const place = (status: "new" | "delivered" | "cancelled") =>
        insertTestOrder(tx, { placedAt: at(1), variant, placedByUserId: me, status });
      await place("new");
      const paid = await place("delivered");
      const part = await place("delivered");
      const cancelled = await place("cancelled");
      await tx.update(orders).set({ amountPaid: 25_000 }).where(eq(orders.id, paid.id));
      await tx.update(orders).set({ amountPaid: 10_000 }).where(eq(orders.id, part.id));
      await tx.update(orders).set({ amountPaid: 5_000 }).where(eq(orders.id, cancelled.id));

      expect(await queries.readCustomerTotals(tx, me)).toEqual({
        orderCount: 3,
        spent: 50_000,
        owed: 15_000,
      });
    });
  });
});

const ACTOR = async (tx: Transaction) => insertAdminUser(tx, "actor@example.test");

// covers: AC-7, AC-17 (spec 0019)
describe.skipIf(!hasLocalDb)("changeCustomerRoleInDb", () => {
  it("switches the role and writes one event", async () => {
    await withRollback(db, async (tx) => {
      const actor = await ACTOR(tx);
      const me = await account(tx, "c-role@example.test");
      const input = { profileId: me, from: "customer", to: "electrician" } as const;

      expect(await writes.changeCustomerRoleInDb(tx, actor, input)).toEqual({
        ok: true,
        data: { role: "electrician" },
      });
      const [profile] = await tx.select().from(profiles).where(eq(profiles.id, me));
      expect(profile.role).toBe("electrician");
      const events = await tx.select().from(accountEvents).where(eq(accountEvents.profileId, me));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "role_changed",
        fromRole: "customer",
        toRole: "electrician",
        actorUserId: actor,
        fields: null,
      });
    });
  });

  it("refuses stale, an admin, a missing account, and a pending removal, writing nothing", async () => {
    await withRollback(db, async (tx) => {
      const actor = await ACTOR(tx);
      const me = await account(tx, "c-role-2@example.test");
      const pending = await account(tx, "c-role-3@example.test");
      await tx.insert(accountEvents).values({ profileId: pending, type: "removed" });
      const change = (profileId: string, from: "customer" | "electrician") =>
        writes.changeCustomerRoleInDb(tx, actor, {
          profileId,
          from,
          to: from === "customer" ? "electrician" : "customer",
        });

      expect(await change(me, "electrician")).toEqual({ ok: false, error: "stale" });
      expect(await change(actor, "customer")).toEqual({ ok: false, error: "not_found" });
      expect(await change(crypto.randomUUID(), "customer")).toEqual({
        ok: false,
        error: "not_found",
      });
      expect(await change(pending, "customer")).toEqual({ ok: false, error: "removal_pending" });
      const roleChanges = await tx
        .select()
        .from(accountEvents)
        .where(eq(accountEvents.type, "role_changed"));
      expect(roleChanges.filter((row) => [me, pending].includes(row.profileId))).toEqual([]);
    });
  });
});

// covers: AC-10 (spec 0019)
describe.skipIf(!hasLocalDb)("updateCustomerDetailsInDb", () => {
  const phone = (typed: string, e164: string) => ({ typed, e164 });

  it("writes nothing when nothing changed, then one field, then both", async () => {
    await withRollback(db, async (tx) => {
      const actor = await ACTOR(tx);
      const me = await account(tx, "c-edit@example.test", {
        name: "سامي",
        phone: "0599123456",
        phoneE164: "+970599123456",
      });
      const edit = (name: string, typed: string, e164: string) =>
        writes.updateCustomerDetailsInDb(tx, actor, {
          profileId: me,
          name,
          phone: phone(typed, e164),
        });

      expect(await edit("سامي", "0599123456", "+970599123456")).toEqual({
        ok: true,
        data: { changed: [] },
      });
      expect(await edit("سامي خليل", "0599123456", "+970599123456")).toEqual({
        ok: true,
        data: { changed: ["full_name"] },
      });
      expect(await edit("سامي", "0569000000", "+970569000000")).toEqual({
        ok: true,
        data: { changed: ["full_name", "phone"] },
      });

      const events = await tx
        .select({ fields: accountEvents.fields })
        .from(accountEvents)
        .where(eq(accountEvents.profileId, me))
        .orderBy(accountEvents.createdAt, accountEvents.id);
      expect(events.map((row) => [...(row.fields ?? [])].sort())).toEqual(
        expect.arrayContaining([["full_name"], ["full_name", "phone"]]),
      );
      expect(events).toHaveLength(2);
      const [profile] = await tx.select().from(profiles).where(eq(profiles.id, me));
      expect(profile).toMatchObject({
        fullName: "سامي",
        phone: "0569000000",
        phoneE164: "+970569000000",
      });
    });
  });

  it("refuses an admin and a pending removal", async () => {
    await withRollback(db, async (tx) => {
      const actor = await ACTOR(tx);
      const pending = await account(tx, "c-edit-2@example.test");
      await tx.insert(accountEvents).values({ profileId: pending, type: "removed" });
      const input = (profileId: string) => ({
        profileId,
        name: "سامي",
        phone: phone("0599123456", "+970599123456"),
      });
      expect(await writes.updateCustomerDetailsInDb(tx, actor, input(actor))).toEqual({
        ok: false,
        error: "not_found",
      });
      expect(await writes.updateCustomerDetailsInDb(tx, actor, input(pending))).toEqual({
        ok: false,
        error: "removal_pending",
      });
    });
  });
});

// covers: AC-11, AC-12 (spec 0019)
describe.skipIf(!hasLocalDb)("startCustomerRemovalInDb", () => {
  it("blocks on an open order, then on a balance", async () => {
    await withRollback(db, async (tx) => {
      const actor = await ACTOR(tx);
      const { variant } = await insertSimpleProduct(tx, "TEST-CUS-3");
      const me = await account(tx, "c-rm@example.test", { name: "سامي" });
      const order = await insertTestOrder(tx, { placedAt: at(1), variant, placedByUserId: me });

      expect(await writes.startCustomerRemovalInDb(tx, actor, me)).toEqual({
        ok: false,
        error: "has_open_orders",
      });
      await tx
        .update(orders)
        .set({ status: "delivered", deliveredAt: at(2), amountPaid: 1_000 })
        .where(eq(orders.id, order.id));
      expect(await writes.startCustomerRemovalInDb(tx, actor, me)).toEqual({
        ok: false,
        error: "has_balance",
      });
      expect(await writes.isRemovalPending(tx, me)).toBe(false);
    });
  });

  it("clears the name and phone with one event, and a second run skips the checks", async () => {
    await withRollback(db, async (tx) => {
      const actor = await ACTOR(tx);
      const { variant } = await insertSimpleProduct(tx, "TEST-CUS-4");
      const me = await account(tx, "c-rm-2@example.test", {
        name: "سامي",
        phone: "0599123456",
        phoneE164: "+970599123456",
      });

      expect(await writes.startCustomerRemovalInDb(tx, actor, me)).toEqual({
        ok: true,
        data: { alreadyPending: false },
      });
      const [profile] = await tx.select().from(profiles).where(eq(profiles.id, me));
      expect(profile).toMatchObject({ fullName: null, phone: null, phoneE164: null });

      // An order that arrived in between does not block the retry.
      await insertTestOrder(tx, { placedAt: at(3), variant, placedByUserId: me });
      expect(await writes.startCustomerRemovalInDb(tx, actor, me)).toEqual({
        ok: true,
        data: { alreadyPending: true },
      });
      const events = await tx.select().from(accountEvents).where(eq(accountEvents.profileId, me));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: "removed", fromRole: null, fields: null });
      expect(await writes.readRemovalState(tx, me)).toBe("pending");
      expect(await writes.readRemovalState(tx, actor)).toBe("not_pending");
      expect(await writes.readRemovalState(tx, crypto.randomUUID())).toBe("gone");
    });
  });

  it("shows the account as removal pending on the storefront", async () => {
    await withRollback(db, async (tx) => {
      const actor = await ACTOR(tx);
      const me = await account(tx, "c-rm-3@example.test");
      expect((await readAccountProfile(tx, me))?.removalPending).toBe(false);
      await writes.startCustomerRemovalInDb(tx, actor, me);
      expect((await readAccountProfile(tx, me))?.removalPending).toBe(true);
    });
  });
});

// covers: AC-13 (spec 0019)
describe.skipIf(!hasLocalDb)("readAccountEventRows", () => {
  it("reads newest first", async () => {
    await withRollback(db, async (tx) => {
      const me = await account(tx, "c-hist@example.test");
      await tx.insert(accountEvents).values([
        { profileId: me, type: "details_edited", fields: ["phone"], createdAt: at(1) },
        {
          profileId: me,
          type: "role_changed",
          fromRole: "customer",
          toRole: "electrician",
          createdAt: at(2),
        },
      ]);
      const rows = await queries.readAccountEventRows(tx, me);
      expect(rows.map((row) => row.type)).toEqual(["role_changed", "details_edited"]);
      expect(rows[1]).toMatchObject({ fields: ["phone"] });
    });
  });
});

// covers: AC-17 (spec 0019)
describe.skipIf(!hasLocalDb)("the account_events checks", () => {
  it("rejects rows that break the role and field rules", async () => {
    await withRollback(db, async (tx) => {
      const profileId = crypto.randomUUID();
      const insert = (values: Partial<typeof accountEvents.$inferInsert>) => (sp: Transaction) =>
        sp.insert(accountEvents).values({ profileId, type: "removed", ...values });

      await expectViolation(tx, "account_events_roles_check", insert({ type: "role_changed" }));
      await expectViolation(
        tx,
        "account_events_roles_check",
        insert({ type: "role_changed", fromRole: "customer" }),
      );
      await expectViolation(tx, "account_events_roles_check", insert({ toRole: "customer" }));
      await expectViolation(tx, "account_events_fields_check", insert({ type: "details_edited" }));
      await expectViolation(
        tx,
        "account_events_fields_check",
        insert({ type: "details_edited", fields: [] }),
      );
      await expectViolation(
        tx,
        "account_events_fields_check",
        insert({ type: "details_edited", fields: ["email"] }),
      );
      await expectViolation(tx, "account_events_fields_check", insert({ fields: ["phone"] }));
    });
  });
});
