import { describe, expect, it } from "vitest";
import { actorKey, historyEntries } from "./admin-history";

// covers: AC-5, AC-6, AC-8 (spec 0014)

const at = new Date("2026-10-28T09:00:00Z");

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
        { id: "1", type: "created", actorKind: "guest", toStatus: null, at },
        { id: "2", type: "status_changed", actorKind: "admin", toStatus: "preparing", at },
        { id: "3", type: "cancelled", actorKind: "customer", toStatus: "cancelled", at },
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
        { id: "1", type: "status_changed", actorKind: "admin", toStatus: null, at },
        { id: "2", type: "cancelled", actorKind: "admin", toStatus: null, at },
      ]),
    ).toEqual([]);
  });
});
