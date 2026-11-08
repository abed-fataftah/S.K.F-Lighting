import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/lib/routes";

// covers: AC-1, AC-4, AC-5, AC-8, AC-9, AC-13, AC-15, AC-19 (spec 0020), AC-4, AC-8 (spec 0021).
// The account readers, the rate limit, and the database writers are spies, so these prove what each
// draft action checks before it writes, what it answers, and that its logs hold no typed value.

vi.mock("server-only", () => ({}));

class Redirected extends Error {
  constructor(readonly url: string) {
    super(url);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));

const getAccountProfile = vi.fn();
vi.mock("@/features/accounts/server/profile", () => ({ getAccountProfile }));

const getVerifiedUser = vi.fn();
vi.mock("@/server/auth/session", () => ({ getVerifiedUser }));

const orderRateCheck = vi.fn();
vi.mock("@/features/checkout/server/rate-limit", () => ({ orderRateCheck }));

const rememberPlacedOrder = vi.fn(async () => {});
vi.mock("@/features/checkout/server/placed", () => ({ rememberPlacedOrder }));

const reportError = vi.fn(async () => {});
vi.mock("@/server/monitoring/report", () => ({ reportError }));

const DB = { db: true };
const getDb = vi.fn(async () => DB);
vi.mock("@/server/db", () => ({ getDb }));

const createDraftInDb = vi.fn();
const renameDraftInDb = vi.fn();
const deleteDraftInDb = vi.fn();
const saveDraftCustomerInDb = vi.fn();
vi.mock("./drafts-db", () => ({
  createDraftInDb,
  renameDraftInDb,
  deleteDraftInDb,
  saveDraftCustomerInDb,
}));

const addDraftLineInDb = vi.fn();
const updateDraftLineInDb = vi.fn();
const removeDraftLineInDb = vi.fn();
const restoreDraftLineInDb = vi.fn();
vi.mock("./lines-db", () => ({
  addDraftLineInDb,
  updateDraftLineInDb,
  removeDraftLineInDb,
  restoreDraftLineInDb,
}));

const addToDraftInDb = vi.fn();
const readDraftPickerData = vi.fn();
vi.mock("./add-from-catalog", () => ({ addToDraftInDb, readDraftPickerData }));

const sendDraftInDb = vi.fn();
vi.mock("./send", () => ({ sendDraftInDb }));

const actions = await import("./actions");

const USER_ID = "5b0c7f1e-2d3a-4c5b-8e9f-0a1b2c3d4e5f";
const DRAFT_ID = "3f6c1a52-8e1b-4c1e-9a55-2b1f0e7d9c11";
const LINE_ID = "7a2d9e40-1b3c-4d5e-8f60-718293a4b5c6";
const PRODUCT_ID = "0c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5";
const VARIANT_ID = "9e8d7c6b-5a49-4382-9716-05f4e3d2c1b0";
const DRAFT_NAME = "بيت أبو علي";
const CUSTOMER = "سامي خليل";
const PHONE = "0599123456";

const account = (role: "customer" | "electrician" | "admin", removalPending = false) => ({
  userId: USER_ID,
  email: null,
  profile: { fullName: "كهربائي", phone: null, phoneE164: null, role, removalPending },
});

const line = { id: LINE_ID, position: 1 };

let logged: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  logged = [];
  getAccountProfile.mockResolvedValue(account("electrician"));
  getVerifiedUser.mockResolvedValue({ id: USER_ID });
  orderRateCheck.mockResolvedValue("ok");
  const keep = (entry: unknown) => void logged.push(String(entry));
  vi.spyOn(console, "warn").mockImplementation(keep);
  vi.spyOn(console, "info").mockImplementation(keep);
  vi.spyOn(console, "error").mockImplementation(keep);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const redirectOf = async (run: Promise<unknown>) => {
  const error = await run.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(Redirected);
  return (error as Redirected).url;
};

// Every action, called with input that would pass its schema.
const calls: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
  ["createDraft", () => actions.createDraft({ name: DRAFT_NAME })],
  ["renameDraft", () => actions.renameDraft({ draftId: DRAFT_ID, name: DRAFT_NAME })],
  ["deleteDraft", () => actions.deleteDraft({ draftId: DRAFT_ID })],
  ["addDraftLine", () => actions.addDraftLine({ draftId: DRAFT_ID })],
  ["updateDraftLine", () => actions.updateDraftLine({ lineId: LINE_ID, quantity: 3 })],
  ["removeDraftLine", () => actions.removeDraftLine({ lineId: LINE_ID })],
  [
    "restoreDraftLine",
    () =>
      actions.restoreDraftLine({
        draftId: DRAFT_ID,
        productId: null,
        variantId: null,
        quantity: null,
        sort: 0,
      }),
  ],
  [
    "saveDraftCustomer",
    () =>
      actions.saveDraftCustomer({
        draftId: DRAFT_ID,
        customerName: CUSTOMER,
        customerPhone: PHONE,
        fulfilment: "pickup",
        deliveryZoneId: null,
      }),
  ],
  ["readDraftPicker", () => actions.readDraftPicker({ productId: PRODUCT_ID })],
  [
    "addToDraft",
    () =>
      actions.addToDraft({
        productId: PRODUCT_ID,
        variantId: VARIANT_ID,
        quantity: 2,
        target: { draftId: DRAFT_ID },
      }),
  ],
  ["sendDraft", () => actions.sendDraft({ draftId: DRAFT_ID, expectedTotal: 12500 })],
];

describe("who may call the draft actions (AC-1)", () => {
  it.each([
    ["signed out", null],
    ["a customer", account("customer")],
    ["the owner", account("admin")],
    ["an electrician whose removal started", account("electrician", true)],
    ["an account with no profile row", { ...account("electrician"), profile: null }],
  ])("refuses %s on every action before the database", async (_who, signedIn) => {
    getAccountProfile.mockResolvedValue(signedIn);

    for (const [name, call] of calls) {
      await expect(call(), name).resolves.toEqual({ ok: false, error: "forbidden" });
    }
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("createDraft (AC-4)", () => {
  it("creates the draft and logs only the event", async () => {
    createDraftInDb.mockResolvedValue({ kind: "created", draftId: DRAFT_ID });

    const result = await actions.createDraft({ name: `  ${DRAFT_NAME}  ` });

    expect(result).toEqual({ ok: true, data: { draftId: DRAFT_ID } });
    expect(createDraftInDb).toHaveBeenCalledWith(DB, USER_ID, DRAFT_NAME);
    expect(logged).toEqual([JSON.stringify({ event: "draft_created" })]);
  });

  it("says a name was too short without reaching the database", async () => {
    const result = await actions.createDraft({ name: "a" });

    expect(result).toEqual({ ok: false, error: "invalid", problem: "too_short" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it.each(["name_taken", "too_many_drafts"])("passes on %s from the database", async (kind) => {
    createDraftInDb.mockResolvedValue({ kind });

    await expect(actions.createDraft({ name: DRAFT_NAME })).resolves.toEqual({
      ok: false,
      error: kind,
    });
    expect(logged.join("\n")).not.toContain(DRAFT_NAME);
  });
});

describe("renameDraft (AC-5)", () => {
  it("answers not_found for a draft id that is not a uuid, before the name", async () => {
    const result = await actions.renameDraft({ draftId: "not-an-id", name: "a" });

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("says a name was too long", async () => {
    const result = await actions.renameDraft({ draftId: DRAFT_ID, name: "س".repeat(41) });

    expect(result).toMatchObject({ ok: false, error: "invalid", problem: "too_long" });
  });

  it("returns the tidied name the database stored", async () => {
    renameDraftInDb.mockResolvedValue({ kind: "renamed", name: DRAFT_NAME });

    await expect(actions.renameDraft({ draftId: DRAFT_ID, name: DRAFT_NAME })).resolves.toEqual({
      ok: true,
      data: { name: DRAFT_NAME },
    });
  });
});

describe("deleteDraft (AC-15)", () => {
  it("counts a malformed id as already gone", async () => {
    await expect(actions.deleteDraft({ draftId: "gone" })).resolves.toEqual({ ok: true, data: {} });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("logs draft_deleted only when a draft was really deleted", async () => {
    deleteDraftInDb.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await actions.deleteDraft({ draftId: DRAFT_ID });
    await actions.deleteDraft({ draftId: DRAFT_ID });

    expect(logged).toEqual([JSON.stringify({ event: "draft_deleted" })]);
  });
});

describe("line actions (AC-8, AC-9)", () => {
  it("returns the saved line", async () => {
    updateDraftLineInDb.mockResolvedValue({ kind: "ok", line });

    await expect(actions.updateDraftLine({ lineId: LINE_ID, quantity: 3 })).resolves.toEqual({
      ok: true,
      data: { line },
    });
  });

  it("names the line that already holds the option", async () => {
    updateDraftLineInDb.mockResolvedValue({ kind: "duplicate", position: 1 });

    const result = await actions.updateDraftLine({ lineId: LINE_ID, variantId: VARIANT_ID });

    expect(result).toEqual({ ok: false, error: "duplicate", position: 1 });
  });

  it("refuses a quantity past 999 or two changes at once as invalid", async () => {
    await expect(actions.updateDraftLine({ lineId: LINE_ID, quantity: 1000 })).resolves.toEqual({
      ok: false,
      error: "invalid",
    });
    await expect(
      actions.updateDraftLine({ lineId: LINE_ID, variantId: VARIANT_ID, quantity: 2 } as never),
    ).resolves.toEqual({ ok: false, error: "invalid" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("passes on too_many_lines when the draft has 30", async () => {
    addDraftLineInDb.mockResolvedValue({ kind: "too_many_lines" });

    await expect(actions.addDraftLine({ draftId: DRAFT_ID })).resolves.toEqual({
      ok: false,
      error: "too_many_lines",
    });
  });

  it("answers not_found when the line to remove is not the user's", async () => {
    removeDraftLineInDb.mockResolvedValue(false);

    await expect(actions.removeDraftLine({ lineId: LINE_ID })).resolves.toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("saveDraftCustomer (AC-10, AC-19)", () => {
  it("never logs what the customer fields hold when the draft is gone", async () => {
    saveDraftCustomerInDb.mockResolvedValue("not_found");

    const [, save] = calls.find(([name]) => name === "saveDraftCustomer")!;
    await expect(save()).resolves.toEqual({ ok: false, error: "not_found" });

    expect(logged.join("\n")).not.toMatch(new RegExp(`${CUSTOMER}|${PHONE}`));
  });
});

describe("a database failure (AC-12)", () => {
  it("answers save_failed and reports the action name only", async () => {
    updateDraftLineInDb.mockRejectedValue(new Error("connection reset"));

    const result = await actions.updateDraftLine({ lineId: LINE_ID, quantity: 3 });

    expect(result).toEqual({ ok: false, error: "save_failed" });
    expect(reportError).toHaveBeenCalledWith(
      "draft_save_failed",
      expect.objectContaining({ message: "connection reset" }),
      { action: "updateDraftLine" },
    );
  });

  it("reports a failed picker read as draft_picker_failed", async () => {
    readDraftPickerData.mockRejectedValue(new Error("timeout"));

    const result = await actions.readDraftPicker({ productId: PRODUCT_ID });

    expect(result).toEqual({ ok: false, error: "save_failed" });
    expect(reportError).toHaveBeenCalledWith("draft_picker_failed", expect.any(Error));
  });

  it("never reports an expected refusal", async () => {
    createDraftInDb.mockResolvedValue({ kind: "name_taken" });

    await actions.createDraft({ name: DRAFT_NAME });
    await actions.createDraft({ name: "a" });

    expect(reportError).not.toHaveBeenCalled();
  });
});

describe("addToDraft (spec 0021 AC-8, AC-9)", () => {
  const add = (target: object, quantity = 2) =>
    actions.addToDraft({ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity, target } as never);

  it("returns where the item went and logs whether it merged, not the draft name", async () => {
    addToDraftInDb.mockResolvedValue({
      kind: "added",
      draftId: DRAFT_ID,
      draftName: DRAFT_NAME,
      position: 2,
      quantity: 5,
      merged: true,
      newDraft: false,
    });

    const result = await add({ draftId: DRAFT_ID });

    expect(result).toEqual({
      ok: true,
      data: { draftId: DRAFT_ID, draftName: DRAFT_NAME, position: 2, quantity: 5, merged: true },
    });
    expect(logged).toEqual([
      JSON.stringify({ event: "draft_item_added", merged: true, newDraft: false }),
    ]);
  });

  it("names the problem of a refused new draft name", async () => {
    const result = await add({ newDraftName: "a" });

    expect(result).toMatchObject({ ok: false, error: "invalid", problem: "too_short" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("gives the line and its quantity when the sum would pass 999", async () => {
    addToDraftInDb.mockResolvedValue({ kind: "quantity_over", position: 3, current: 998 });

    const result = await add({ draftId: DRAFT_ID });

    expect(result).toEqual({ ok: false, error: "quantity_over", position: 3, current: 998 });
  });
});

describe("sendDraft (AC-13, AC-16)", () => {
  const send = (expectedTotal = 12500) => actions.sendDraft({ draftId: DRAFT_ID, expectedTotal });

  it("refuses when Supabase Auth no longer knows the session", async () => {
    getVerifiedUser.mockResolvedValue(null);

    await expect(send()).resolves.toEqual({ ok: false, error: "forbidden" });
    expect(sendDraftInDb).not.toHaveBeenCalled();
  });

  it("refuses when the verified user is not the one in the claims", async () => {
    getVerifiedUser.mockResolvedValue({ id: "11111111-2222-4333-8444-555555555555" });

    await expect(send()).resolves.toEqual({ ok: false, error: "forbidden" });
    expect(sendDraftInDb).not.toHaveBeenCalled();
  });

  it("refuses a negative expected total as not_found, before the rate limit", async () => {
    await expect(send(-1)).resolves.toMatchObject({ ok: false, error: "not_found" });
    expect(orderRateCheck).not.toHaveBeenCalled();
  });

  it("stops at checkout's rate limit and writes nothing", async () => {
    orderRateCheck.mockResolvedValue("limited");

    await expect(send()).resolves.toMatchObject({ ok: false, error: "rate_limited" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns each line's problem when the draft is incomplete", async () => {
    const problems = [{ position: 2, problem: "quantity" }];
    sendDraftInDb.mockResolvedValue({ kind: "incomplete", problems });

    await expect(send()).resolves.toEqual({ ok: false, error: "incomplete", problems });
  });

  it("returns the field errors and logs only the field names", async () => {
    const fieldErrors = { customerPhone: { code: "phone_mobile" } };
    sendDraftInDb.mockResolvedValue({ kind: "invalid", fieldErrors });

    const result = await send();

    expect(result).toEqual({ ok: false, error: "invalid", fieldErrors });
    expect(logged).toEqual([
      JSON.stringify({ event: "draft_refused", error: "invalid", fields: ["customerPhone"] }),
    ]);
  });

  it.each(["empty", "not_sellable", "zone_invalid", "price_changed", "not_found"])(
    "passes on %s with nothing remembered",
    async (kind) => {
      sendDraftInDb.mockResolvedValue({ kind });

      await expect(send()).resolves.toEqual({ ok: false, error: kind });
      expect(rememberPlacedOrder).not.toHaveBeenCalled();
    },
  );

  it("opens W5 with the WhatsApp step, keeping the storefront cart", async () => {
    sendDraftInDb.mockResolvedValue({
      kind: "placed",
      orderId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      orderNumber: "SKF-1042",
      lineCount: 3,
      total: 12500,
    });

    const url = await redirectOf(send());

    expect(url).toBe(`${routes.checkoutDone("SKF-1042")}?wa=1`);
    expect(sendDraftInDb).toHaveBeenCalledWith(DB, {
      userId: USER_ID,
      draftId: DRAFT_ID,
      expectedTotal: 12500,
      placedAt: expect.any(Date),
    });
    expect(rememberPlacedOrder).toHaveBeenCalledWith("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", {
      clearCart: false,
    });
    expect(logged).toEqual([
      JSON.stringify({ event: "draft_sent", orderNumber: "SKF-1042", lineCount: 3, total: 12500 }),
    ]);
  });

  it("opens the same W5 for a replayed send without logging a second order", async () => {
    sendDraftInDb.mockResolvedValue({
      kind: "replayed",
      orderId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      orderNumber: "SKF-1042",
    });

    await expect(redirectOf(send())).resolves.toBe(`${routes.checkoutDone("SKF-1042")}?wa=1`);
    expect(logged).toEqual([]);
  });

  it("answers save_failed when the write throws", async () => {
    sendDraftInDb.mockRejectedValue(new Error("deadlock"));

    await expect(send()).resolves.toEqual({ ok: false, error: "save_failed" });
    expect(reportError).toHaveBeenCalledWith("draft_save_failed", expect.any(Error), {
      action: "sendDraft",
    });
  });
});
