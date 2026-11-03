import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-1, AC-3, AC-7, AC-10, AC-11, AC-12, AC-15, AC-16 (spec 0019). The database functions
// and the Supabase login delete are test doubles, so these tests prove what each action checks
// before them, and what it logs, refreshes, and answers after.

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

class Redirect extends Error {
  constructor(readonly to: string) {
    super("NEXT_REDIRECT");
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));

const requireAdmin = vi.fn();
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));

const deleteAuthUser = vi.fn();
vi.mock("@/server/auth/supabase-admin", () => ({ deleteAuthUser }));

const getDb = vi.fn(async () => ({}));
vi.mock("@/server/db", () => ({ getDb }));

const changeCustomerRoleInDb = vi.fn();
const updateCustomerDetailsInDb = vi.fn();
const startCustomerRemovalInDb = vi.fn();
const readRemovalState = vi.fn();
vi.mock("./account-writes", () => ({
  changeCustomerRoleInDb,
  updateCustomerDetailsInDb,
  startCustomerRemovalInDb,
  readRemovalState,
}));

const readCustomerSearch = vi.fn();
vi.mock("./admin-queries", () => ({ readCustomerSearch }));

const actions = await import("./admin-actions");

const ID = "0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e";
const NAME = "سامي خليل";
const PHONE = "0599123456";

let logged: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  logged = [];
  const keep = (line: unknown) => void logged.push(String(line));
  vi.spyOn(console, "info").mockImplementation(keep);
  vi.spyOn(console, "warn").mockImplementation(keep);
  vi.spyOn(console, "error").mockImplementation(keep);
  requireAdmin.mockResolvedValue({ ok: true, data: { userId: "admin-1" } });
});

const redirectOf = (run: Promise<unknown>) =>
  run.then(
    () => null,
    (error: unknown) => (error instanceof Redirect ? error.to : Promise.reject(error)),
  );

describe("every customer action is admin only", () => {
  it("refuses a non admin and reads or writes nothing", async () => {
    requireAdmin.mockResolvedValue({ ok: false, error: "forbidden" });
    const forbidden = { ok: false, error: "forbidden" };

    expect(await actions.searchAdminCustomers({ text: NAME })).toEqual(forbidden);
    expect(
      await actions.changeCustomerRole({ profileId: ID, from: "customer", to: "electrician" }),
    ).toEqual(forbidden);
    expect(
      await actions.updateCustomerDetails({ profileId: ID, name: NAME, phone: PHONE }),
    ).toEqual(forbidden);
    expect(await actions.removeCustomer({ profileId: ID })).toEqual(forbidden);
    expect(await actions.finishCustomerRemoval({ profileId: ID })).toEqual(forbidden);
    expect(getDb).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
    expect(logged.filter((line) => line.includes('"code":"forbidden"'))).toHaveLength(5);
  });
});

describe("searchAdminCustomers", () => {
  it("logs only the kind, never the text", async () => {
    readCustomerSearch.mockResolvedValue({ rows: [], capped: false });
    expect(await actions.searchAdminCustomers({ text: "٠٥٩٩١٢٣٤٥٦" })).toEqual({
      ok: true,
      data: { rows: [], capped: false },
    });
    expect(readCustomerSearch).toHaveBeenCalledWith({}, { kind: "phone", e164: "+970599123456" });
    expect(logged).toEqual([JSON.stringify({ event: "admin_customer_search", kind: "phone" })]);
  });

  it("refuses partial digits without reading", async () => {
    expect(await actions.searchAdminCustomers({ text: "0599" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(readCustomerSearch).not.toHaveBeenCalled();
  });

  it("answers failed on a database error, with no text in the log", async () => {
    readCustomerSearch.mockRejectedValue(new Error("down"));
    expect(await actions.searchAdminCustomers({ text: "sami@example.test" })).toEqual({
      ok: false,
      error: "failed",
    });
    expect(logged.join()).not.toContain("sami");
  });
});

describe("changeCustomerRole", () => {
  it("refuses a bad role before the database", async () => {
    for (const input of [
      { profileId: ID, from: "customer", to: "admin" },
      { profileId: ID, from: "customer", to: "customer" },
      { profileId: "x", from: "customer", to: "electrician" },
    ]) {
      expect(await actions.changeCustomerRole(input)).toEqual({ ok: false, error: "invalid" });
    }
    expect(getDb).not.toHaveBeenCalled();
  });

  it("refreshes the list and the page, and logs the new role", async () => {
    changeCustomerRoleInDb.mockResolvedValue({ ok: true, data: { role: "electrician" } });
    const input = { profileId: ID, from: "customer", to: "electrician" };
    expect(await actions.changeCustomerRole(input)).toEqual({
      ok: true,
      data: { role: "electrician" },
    });
    expect(changeCustomerRoleInDb).toHaveBeenCalledWith({}, "admin-1", input);
    expect(revalidatePath.mock.calls.flat()).toEqual([
      "/admin/customers",
      `/admin/customers/${ID}`,
    ]);
    expect(logged).toEqual([
      JSON.stringify({ event: "admin_customer_role_changed", to: "electrician" }),
    ]);
  });

  it("passes stale through and logs the refusal", async () => {
    changeCustomerRoleInDb.mockResolvedValue({ ok: false, error: "stale" });
    expect(
      await actions.changeCustomerRole({ profileId: ID, from: "customer", to: "electrician" }),
    ).toEqual({ ok: false, error: "stale" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(logged).toEqual([
      JSON.stringify({ event: "admin_customer_refused", action: "role", code: "stale" }),
    ]);
  });
});

describe("updateCustomerDetails", () => {
  it("sends field errors back, with nothing typed in them", async () => {
    const result = await actions.updateCustomerDetails({ profileId: ID, name: "", phone: "0222" });
    expect(result).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { name: { code: "too_short" }, phone: { code: "phone_mobile" } },
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("logs the changed fields only, and nothing for no change", async () => {
    updateCustomerDetailsInDb.mockResolvedValueOnce({ ok: true, data: { changed: ["phone"] } });
    await actions.updateCustomerDetails({ profileId: ID, name: NAME, phone: PHONE });
    expect(logged).toEqual([
      JSON.stringify({ event: "admin_customer_details_edited", fields: ["phone"] }),
    ]);

    logged = [];
    updateCustomerDetailsInDb.mockResolvedValueOnce({ ok: true, data: { changed: [] } });
    expect(
      await actions.updateCustomerDetails({ profileId: ID, name: NAME, phone: PHONE }),
    ).toEqual({ ok: true, data: { changed: [] } });
    expect(logged).toEqual([]);
    expect(logged.join()).not.toContain(PHONE);
  });
});

describe("removeCustomer", () => {
  it("stops at a block and never deletes the login", async () => {
    startCustomerRemovalInDb.mockResolvedValue({ ok: false, error: "has_balance" });
    expect(await actions.removeCustomer({ profileId: ID })).toEqual({
      ok: false,
      error: "has_balance",
    });
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("deletes the login after step 1 and lands on the list with the notice", async () => {
    startCustomerRemovalInDb.mockResolvedValue({ ok: true, data: { alreadyPending: false } });
    deleteAuthUser.mockResolvedValue({ ok: true });
    expect(await redirectOf(actions.removeCustomer({ profileId: ID }))).toBe(
      "/admin/customers?notice=removed",
    );
    expect(deleteAuthUser).toHaveBeenCalledWith(ID);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/customers");
    expect(logged).toEqual([JSON.stringify({ event: "admin_customer_removed" })]);
  });

  it("leaves the removal pending when the login delete fails", async () => {
    startCustomerRemovalInDb.mockResolvedValue({ ok: true, data: { alreadyPending: false } });
    deleteAuthUser.mockResolvedValue({ ok: false, code: "unexpected_failure" });
    expect(await actions.removeCustomer({ profileId: ID })).toEqual({
      ok: false,
      error: "removal_unfinished",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/customers/${ID}`);
    expect(logged).toEqual([
      JSON.stringify({ event: "admin_customer_removal_failed", code: "unexpected_failure" }),
    ]);
  });

  it("answers failed when step 1 hits a database error, and deletes nothing", async () => {
    startCustomerRemovalInDb.mockRejectedValue(new Error("down"));
    expect(await actions.removeCustomer({ profileId: ID })).toEqual({
      ok: false,
      error: "failed",
    });
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });
});

describe("finishCustomerRemoval", () => {
  it("counts an account already gone as done", async () => {
    readRemovalState.mockResolvedValue("gone");
    expect(await redirectOf(actions.finishCustomerRemoval({ profileId: ID }))).toBe(
      "/admin/customers?notice=removed",
    );
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("refuses an account with no removal started", async () => {
    readRemovalState.mockResolvedValue("not_pending");
    expect(await actions.finishCustomerRemoval({ profileId: ID })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("retries the login delete for a pending removal", async () => {
    readRemovalState.mockResolvedValue("pending");
    deleteAuthUser.mockResolvedValueOnce({ ok: false, code: "unknown" });
    expect(await actions.finishCustomerRemoval({ profileId: ID })).toEqual({
      ok: false,
      error: "removal_unfinished",
    });
    deleteAuthUser.mockResolvedValueOnce({ ok: true });
    expect(await redirectOf(actions.finishCustomerRemoval({ profileId: ID }))).toBe(
      "/admin/customers?notice=removed",
    );
  });
});
