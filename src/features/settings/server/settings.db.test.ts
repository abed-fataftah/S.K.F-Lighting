import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import { deliveryZones, pages } from "@/server/db/schema";

// covers: AC-5, AC-6, AC-11 (spec 0025), on the local database, every test rolled back.

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { addZoneInDb, readZones, savePolicyInDb, saveZoneInDb, setZoneActiveInDb } =
  await import("./settings-db");
const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

describe.skipIf(!hasLocalDb)("settings writes on the local database", () => {
  it("adds zones at the end of the list, and refuses the 11th", async () => {
    await withRollback(db, async (tx) => {
      const before = await readZones(tx);
      for (let n = before.length + 1; n <= 10; n++) {
        const outcome = await addZoneInDb(tx, {
          name: `منطقة ${n}`,
          shortName: `م${n}`,
          fee: 1000,
        });
        expect(outcome.kind).toBe("saved");
      }
      const zones = await readZones(tx);
      expect(zones).toHaveLength(10);
      expect(zones.at(-1)).toMatchObject({ name: "منطقة 10", isActive: true });

      await expect(
        addZoneInDb(tx, { name: "منطقة 11", shortName: "م11", fee: 1000 }),
      ).resolves.toEqual({ kind: "zone_limit" });
      expect(await readZones(tx)).toHaveLength(10);
    });
  });

  it("gives name_taken for a name another zone uses, on save and on add", async () => {
    await withRollback(db, async (tx) => {
      const [first, second] = await readZones(tx);
      await expect(
        saveZoneInDb(tx, { id: second.id, name: first.name, shortName: "x", fee: 0 }),
      ).resolves.toEqual({ kind: "name_taken" });
      await expect(addZoneInDb(tx, { name: first.name, shortName: "x", fee: 0 })).resolves.toEqual({
        kind: "name_taken",
      });
    });
  });

  it("saves a fee and pauses a zone, and a missing zone is not_found", async () => {
    await withRollback(db, async (tx) => {
      const [zone] = await readZones(tx);
      const saved = await saveZoneInDb(tx, {
        id: zone.id,
        name: zone.name,
        shortName: "ض",
        fee: 2500,
      });
      expect(saved).toMatchObject({ kind: "saved", zone: { fee: 2500, shortName: "ض" } });
      const paused = await setZoneActiveInDb(tx, zone.id, false);
      expect(paused).toMatchObject({ kind: "saved", zone: { isActive: false } });
      const [row] = await tx.select().from(deliveryZones).where(eq(deliveryZones.id, zone.id));
      expect(row.isActive).toBe(false);

      const missing = "00000000-0000-4000-8000-000000000000";
      await expect(setZoneActiveInDb(tx, missing, true)).resolves.toEqual({ kind: "not_found" });
    });
  });

  it("bumps the version on save, and refuses an old version without writing", async () => {
    await withRollback(db, async (tx) => {
      const [page] = await tx.select().from(pages).where(eq(pages.slug, "terms"));
      const first = await savePolicyInDb(tx, {
        slug: "terms",
        title: "الشروط",
        body: "## جديد",
        version: page.version,
      });
      expect(first).toMatchObject({ kind: "saved", version: page.version + 1 });

      // A second tab that loaded the old version.
      await expect(
        savePolicyInDb(tx, { slug: "terms", title: "قديم", body: "قديم", version: page.version }),
      ).resolves.toEqual({ kind: "stale" });
      const [after] = await tx.select().from(pages).where(eq(pages.slug, "terms"));
      expect(after).toMatchObject({ title: "الشروط", body: "## جديد", version: page.version + 1 });

      // The same form saving again with the version the first save returned works.
      const second = await savePolicyInDb(tx, {
        slug: "terms",
        title: "الشروط",
        body: "## مرة ثانية",
        version: page.version + 1,
      });
      expect(second).toMatchObject({ kind: "saved", version: page.version + 2 });
    });
  });
});
