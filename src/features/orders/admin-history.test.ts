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
});

// covers: AC-8 (spec 0022), AC-14 (spec 0014)
describe("FLAGGING_EVENTS", () => {
  it("flags new orders and cancels, never a price save", () => {
    expect(FLAGGING_EVENTS).toEqual(["created", "cancelled"]);
    expect(FLAGGING_EVENTS).not.toContain("line_price_changed");
  });
});
