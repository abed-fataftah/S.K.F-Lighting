import { describe, expect, it } from "vitest";
import { FLAGGING_EVENTS, actorKey, historyEntries } from "./admin-history";

// covers: AC-5, AC-6, AC-8 (spec 0014)

const at = new Date("2026-10-28T09:00:00Z");
const data = {};

describe("actorKey", () => {
  it("names the shop only for the admin", () => {
    expect(actorKey("admin")).toBe("actorShop");
    for (const kind of ["guest", "customer", "electrician", "system"] as const) {
      expect(actorKey(kind)).toBe("actorCustomer");
    }
  });
});

describe("historyEntries", () => {
  it("keeps the order and turns each event into its line", () => {
    expect(
      historyEntries([
        { id: "1", type: "created", actorKind: "guest", toStatus: null, data, at },
        { id: "2", type: "status_changed", actorKind: "admin", toStatus: "preparing", data, at },
        { id: "3", type: "cancelled", actorKind: "customer", toStatus: "cancelled", data, at },
      ]),
    ).toEqual([
      { id: "1", at, kind: "created" },
      { id: "2", at, kind: "moved", actor: "actorShop", status: "preparing" },
      { id: "3", at, kind: "cancelled", actor: "actorCustomer" },
    ]);
  });

  it("skips a move or a cancel with no to_status", () => {
    expect(
      historyEntries([
        { id: "1", type: "status_changed", actorKind: "admin", toStatus: null, data, at },
        { id: "2", type: "cancelled", actorKind: "admin", toStatus: null, data, at },
      ]),
    ).toEqual([]);
  });

  // covers: AC-8 (spec 0022)
  it("turns a price save into a prices line, with its note, whatever its to_status", () => {
    expect(
      historyEntries([
        {
          id: "1",
          type: "line_price_changed",
          actorKind: "admin",
          toStatus: null,
          data: { lineCount: 2, fromTotal: 25_000, toTotal: 21_000, note: "مشروع كبير" },
          at,
        },
        {
          id: "2",
          type: "line_price_changed",
          actorKind: "admin",
          toStatus: "preparing",
          data: { lineCount: 1, fromTotal: 21_000, toTotal: 20_000 },
          at,
        },
      ]),
    ).toEqual([
      { id: "1", at, kind: "prices", from: 25_000, to: 21_000, count: 2, note: "مشروع كبير" },
      { id: "2", at, kind: "prices", from: 21_000, to: 20_000, count: 1 },
    ]);
  });

  it("reads a price save with broken data as zeros and no note", () => {
    expect(
      historyEntries([
        {
          id: "1",
          type: "line_price_changed",
          actorKind: "admin",
          toStatus: null,
          data: { lineCount: "2", fromTotal: 1.5, note: "" },
          at,
        },
      ]),
    ).toEqual([{ id: "1", at, kind: "prices", from: 0, to: 0, count: 0 }]);
  });

  // covers: AC-10 (spec 0023)
  it("turns each payment_recorded into a payment line by its kind and method", () => {
    const event = (id: string, eventData: Record<string, unknown>) =>
      ({
        id,
        type: "payment_recorded",
        actorKind: "admin",
        toStatus: null,
        data: eventData,
        at,
      }) as const;
    expect(
      historyEntries([
        event("1", {
          kind: "payment",
          method: "cash",
          amount: 10_000,
          fromPaid: 0,
          toPaid: 10_000,
        }),
        event("2", { kind: "refund", method: "cheque", amount: 4_000 }),
        event("3", { kind: "reversal", reverses: "x", method: "cheque", amount: 4_000 }),
        event("4", { kind: "other", method: "card", amount: "5" }),
      ]),
    ).toEqual([
      { id: "1", at, kind: "payment", entry: "payment", amount: 10_000, method: "cash" },
      { id: "2", at, kind: "payment", entry: "refund", amount: 4_000, method: "cheque" },
      { id: "3", at, kind: "payment", entry: "reversal", amount: 4_000, method: "cheque" },
      { id: "4", at, kind: "payment", entry: "payment", amount: 0, method: "cash" },
    ]);
  });
});

// covers: AC-8 (spec 0022), AC-14 (spec 0014)
describe("FLAGGING_EVENTS", () => {
  it("flags new orders and cancels, never a price save or a payment", () => {
    expect(FLAGGING_EVENTS).toEqual(["created", "cancelled"]);
    expect(FLAGGING_EVENTS).not.toContain("line_price_changed");
    expect(FLAGGING_EVENTS).not.toContain("payment_recorded");
  });
});
