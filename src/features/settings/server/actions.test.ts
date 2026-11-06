import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-2, AC-5, AC-6, AC-11, AC-15 (spec 0025). The database calls are replaced by spies, so
// these tests prove what each action does around them: the admin check first, input checked before
// the database, and each refusal passed back as its own typed result.

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const requireAdmin = vi.fn();
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));
const getDb = vi.fn(async () => ({}));
vi.mock("@/server/db", () => ({ getDb }));

const saveShopContactInDb = vi.fn();
const saveZoneInDb = vi.fn();
const addZoneInDb = vi.fn();
const setZoneActiveInDb = vi.fn();
const savePolicyInDb = vi.fn();
vi.mock("./settings-db", () => ({
  saveShopContactInDb,
  saveZoneInDb,
  addZoneInDb,
  setZoneActiveInDb,
  savePolicyInDb,
}));

const { addZone, saveShopContact, savePolicyPage, saveZone, setZoneActive } =
  await import("./actions");

const ID = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const zone = { id: ID, name: "الضفة الغربية", shortName: "الضفة", fee: 2500, isActive: true };
const zoneInput = { name: "الضفة الغربية", shortName: "الضفة", feeShekels: "25" };
const policyInput = { slug: "returns", title: "سياسة الإرجاع", body: "## مدة\nنص", version: 3 };

beforeEach(() => {
  requireAdmin.mockResolvedValue({ ok: true, data: { userId: "admin" } });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("every settings action refuses a caller who is not an aal2 admin", () => {
  const calls = {
    saveShopContact: () => saveShopContact({ whatsappNumber: "970599123456" }),
    saveZone: () => saveZone({ id: ID, ...zoneInput }),
    addZone: () => addZone(zoneInput),
    setZoneActive: () => setZoneActive({ id: ID, isActive: false }),
    savePolicyPage: () => savePolicyPage(policyInput),
  };

  for (const [name, call] of Object.entries(calls)) {
    it(`${name} returns forbidden and touches nothing`, async () => {
      requireAdmin.mockResolvedValue({ ok: false, error: "forbidden" });
      await expect(call()).resolves.toEqual({ ok: false, error: "forbidden" });
      expect(getDb).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  }
});

describe("saveShopContact", () => {
  it("saves the digits only, and refreshes the settings page", async () => {
    saveShopContactInDb.mockImplementation(async (_db, data) => data);
    const result = await saveShopContact({
      whatsappNumber: "+970 599-123-456",
      contactPhone: "",
      address: "",
    });

    expect(result).toEqual({
      ok: true,
      data: { whatsappNumber: "970599123456", contactPhone: null, address: null },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings");
  });

  it("refuses a number without its country code before the database", async () => {
    const result = await saveShopContact({ whatsappNumber: "0599123456" });

    expect(result).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { whatsappNumber: { code: "whatsapp_country_code" } },
    });
    expect(saveShopContactInDb).not.toHaveBeenCalled();
  });

  it("logs no typed value when the write fails", async () => {
    saveShopContactInDb.mockRejectedValue(new Error("boom 970599123456"));
    await expect(saveShopContact({ whatsappNumber: "970599123456" })).resolves.toEqual({
      ok: false,
      error: "failed",
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("970599");
  });
});

describe("zones", () => {
  it("saves a fee in agorot", async () => {
    saveZoneInDb.mockResolvedValue({ kind: "saved", zone });
    await expect(saveZone({ id: ID, ...zoneInput })).resolves.toEqual({ ok: true, data: zone });
    expect(saveZoneInDb).toHaveBeenCalledWith(expect.anything(), {
      id: ID,
      name: "الضفة الغربية",
      shortName: "الضفة",
      fee: 2500,
    });
  });

  it("refuses a fee with a decimal before the database", async () => {
    const result = await saveZone({ id: ID, ...zoneInput, feeShekels: "12.5" });
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { feeShekels: { code: "fee_invalid" } },
    });
    expect(saveZoneInDb).not.toHaveBeenCalled();
  });

  it("passes back a name already used, a missing zone, and the 10 zone limit", async () => {
    saveZoneInDb.mockResolvedValue({ kind: "name_taken" });
    await expect(saveZone({ id: ID, ...zoneInput })).resolves.toEqual({
      ok: false,
      error: "name_taken",
    });
    setZoneActiveInDb.mockResolvedValue({ kind: "not_found" });
    await expect(setZoneActive({ id: ID, isActive: true })).resolves.toEqual({
      ok: false,
      error: "not_found",
    });
    addZoneInDb.mockResolvedValue({ kind: "zone_limit" });
    await expect(addZone(zoneInput)).resolves.toEqual({ ok: false, error: "zone_limit" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("savePolicyPage", () => {
  it("returns the new version and refreshes the hub and the editor", async () => {
    const updatedAt = new Date("2026-11-06T10:00:00Z");
    savePolicyInDb.mockResolvedValue({ kind: "saved", version: 4, updatedAt });

    await expect(savePolicyPage(policyInput)).resolves.toEqual({
      ok: true,
      data: { version: 4, updatedAt },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings/policies/returns");
  });

  it("passes back stale when the page was saved since it loaded", async () => {
    savePolicyInDb.mockResolvedValue({ kind: "stale" });
    await expect(savePolicyPage(policyInput)).resolves.toEqual({ ok: false, error: "stale" });
  });
});
