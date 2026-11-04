import { describe, expect, it } from "vitest";
import { canUseDrafts } from "./access";
import { commitDraftQuantity } from "./quantity";
import {
  createDraftSchema,
  draftCustomerColumns,
  draftCustomerSchema,
  draftNameProblem,
  updateDraftLineSchema,
} from "./schemas";
import { parseDraftCustomer } from "./send-check";

// covers: AC-1, AC-4, AC-8, AC-10, AC-13 (spec 0020)

const ID = "6f1c2c8e-4d7a-4a5b-9a51-2f0e5d3c1b7a";

describe("commitDraftQuantity", () => {
  it("takes Arabic digits, clamps to 1 to 999, and saves empty as null", () => {
    expect(commitDraftQuantity("٣", null)).toBe(3);
    expect(commitDraftQuantity(" 12 ", 3)).toBe(12);
    expect(commitDraftQuantity("0", 3)).toBe(1);
    expect(commitDraftQuantity("5000", 3)).toBe(999);
    expect(commitDraftQuantity("", 3)).toBeNull();
  });

  it("keeps the last value for anything that is not a whole number", () => {
    expect(commitDraftQuantity("2.5", 4)).toBe(4);
    expect(commitDraftQuantity("abc", null)).toBeNull();
  });
});

describe("draft name", () => {
  it("tidies the name and accepts 2 to 40 characters", () => {
    expect(createDraftSchema.parse({ name: "  ali   /  mo " })).toEqual({ name: "ali / mo" });
  });

  it("says whether a refused name was too short or too long", () => {
    const short = createDraftSchema.safeParse({ name: " a " });
    const long = createDraftSchema.safeParse({ name: "x".repeat(41) });
    expect(!short.success && draftNameProblem(short.error)).toBe("too_short");
    expect(!long.success && draftNameProblem(long.error)).toBe("too_long");
  });
});

describe("updateDraftLineSchema", () => {
  it("accepts a product with its option, an option, or a quantity", () => {
    expect(
      updateDraftLineSchema.safeParse({ lineId: ID, productId: ID, variantId: null }).success,
    ).toBe(true);
    expect(updateDraftLineSchema.safeParse({ lineId: ID, variantId: ID }).success).toBe(true);
    expect(updateDraftLineSchema.safeParse({ lineId: ID, quantity: null }).success).toBe(true);
  });

  it("refuses a quantity outside 1 to 999 and a change of two things at once", () => {
    expect(updateDraftLineSchema.safeParse({ lineId: ID, quantity: 1000 }).success).toBe(false);
    expect(
      updateDraftLineSchema.safeParse({ lineId: ID, quantity: 1, variantId: ID }).success,
    ).toBe(false);
  });
});

describe("draft customer", () => {
  it("tidies and cuts the text, saving blank as null", () => {
    const parsed = draftCustomerSchema.parse({
      draftId: ID,
      customerName: "  محمد   علي ",
      notes: "   ",
      address: "ش".repeat(400),
    });
    expect(parsed.customerName).toBe("محمد علي");
    expect(parsed.notes).toBeNull();
    expect(Array.from(parsed.address ?? "")).toHaveLength(300);
  });

  it("writes the E.164 form only with the phone", () => {
    expect(draftCustomerColumns({ draftId: ID, city: "رام الله" })).toEqual({ city: "رام الله" });
    expect(draftCustomerColumns({ draftId: ID, customerPhone: "0599 123 456" })).toEqual({
      customerPhone: "0599 123 456",
      customerPhoneE164: "+970599123456",
    });
    expect(draftCustomerColumns({ draftId: ID, customerPhone: "123" })).toMatchObject({
      customerPhoneE164: null,
    });
  });
});

describe("parseDraftCustomer", () => {
  const filled = {
    customerName: "محمد علي",
    customerPhone: "0599123456",
    fulfilment: "pickup" as const,
    deliveryZoneId: null,
    city: null,
    address: null,
    notes: null,
  };

  it("parses a filled pickup card with the draft id as the key", () => {
    const parsed = parseDraftCustomer(filled, ID, 3_000);
    expect(parsed.ok && parsed.input).toMatchObject({
      idempotencyKey: ID,
      expectedTotal: 3_000,
      fulfilment: "pickup",
      phone: { e164: "+970599123456" },
    });
  });

  it("reports no fulfilment as required, with the other errors", () => {
    const parsed = parseDraftCustomer({ ...filled, fulfilment: null, customerPhone: null }, ID, 0);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.fieldErrors.fulfilment).toEqual({ code: "required" });
    expect(!parsed.ok && parsed.fieldErrors.phone).toBeDefined();
  });

  it("checks the delivery fields only for delivery", () => {
    const parsed = parseDraftCustomer({ ...filled, fulfilment: "delivery" }, ID, 0);
    expect(!parsed.ok && Object.keys(parsed.fieldErrors).sort()).toEqual([
      "address",
      "city",
      "zoneId",
    ]);
  });
});

describe("canUseDrafts", () => {
  const profile = { fullName: null, phone: null, phoneE164: null, removalPending: false };

  it("lets only an electrician whose removal has not started in", () => {
    expect(canUseDrafts({ ...profile, role: "electrician" })).toBe(true);
    expect(canUseDrafts({ ...profile, role: "customer" })).toBe(false);
    expect(canUseDrafts({ ...profile, role: "admin" })).toBe(false);
    expect(canUseDrafts({ ...profile, role: "electrician", removalPending: true })).toBe(false);
    expect(canUseDrafts(null)).toBe(false);
  });
});
