import { describe, expect, it } from "vitest";
import {
  isAllowedMove,
  ORDER_STATUSES,
  ORDER_STATUSES_SHOWN,
  orderMoves,
  statusBadgeVariant,
} from "./status";

// covers: AC-1, AC-2 (spec 0014)

describe("orderMoves on the pickup path", () => {
  it("steps new, preparing, ready, delivered and never offers out for delivery", () => {
    expect(orderMoves("pickup", "new")).toEqual({
      next: "preparing",
      forward: ["ready", "delivered"],
      back: null,
      canCancel: true,
    });
    expect(orderMoves("pickup", "preparing")).toEqual({
      next: "ready",
      forward: ["delivered"],
      back: "new",
      canCancel: true,
    });
    expect(orderMoves("pickup", "ready")).toEqual({
      next: "delivered",
      forward: [],
      back: "preparing",
      canCancel: true,
    });
    for (const status of ORDER_STATUSES) {
      const moves = orderMoves("pickup", status);
      expect([moves.next, moves.back, ...moves.forward]).not.toContain("out_for_delivery");
    }
  });

  it("gives an off path status (pickup at out for delivery) only the cancel", () => {
    expect(orderMoves("pickup", "out_for_delivery")).toEqual({
      next: null,
      forward: [],
      back: null,
      canCancel: true,
    });
  });
});

describe("orderMoves on the delivery path", () => {
  it("passes out for delivery between ready and delivered", () => {
    expect(orderMoves("delivery", "new")).toEqual({
      next: "preparing",
      forward: ["ready", "out_for_delivery", "delivered"],
      back: null,
      canCancel: true,
    });
    expect(orderMoves("delivery", "ready")).toEqual({
      next: "out_for_delivery",
      forward: ["delivered"],
      back: "preparing",
      canCancel: true,
    });
    expect(orderMoves("delivery", "out_for_delivery")).toEqual({
      next: "delivered",
      forward: [],
      back: "ready",
      canCancel: true,
    });
  });
});

describe("final and legacy statuses", () => {
  it("gives delivered and cancelled nothing at all", () => {
    for (const fulfilment of ["pickup", "delivery"] as const) {
      for (const status of ["delivered", "cancelled"] as const) {
        expect(orderMoves(fulfilment, status)).toEqual({
          next: null,
          forward: [],
          back: null,
          canCancel: false,
        });
      }
    }
  });

  it("treats confirmed exactly like new", () => {
    expect(orderMoves("pickup", "confirmed")).toEqual(orderMoves("pickup", "new"));
    expect(orderMoves("delivery", "confirmed")).toEqual(orderMoves("delivery", "new"));
  });
});

describe("isAllowedMove", () => {
  it("allows next, a skip, and one step back", () => {
    expect(isAllowedMove("pickup", "new", "preparing")).toBe(true);
    expect(isAllowedMove("pickup", "new", "ready")).toBe(true);
    expect(isAllowedMove("delivery", "new", "delivered")).toBe(true);
    expect(isAllowedMove("pickup", "ready", "preparing")).toBe(true);
    expect(isAllowedMove("pickup", "confirmed", "preparing")).toBe(true);
  });

  it("refuses cancelled, two steps back, staying put, and any move out of a final state", () => {
    expect(isAllowedMove("pickup", "new", "cancelled")).toBe(false);
    expect(isAllowedMove("delivery", "out_for_delivery", "preparing")).toBe(false);
    expect(isAllowedMove("pickup", "ready", "ready")).toBe(false);
    expect(isAllowedMove("pickup", "preparing", "confirmed")).toBe(false);
    expect(isAllowedMove("pickup", "ready", "out_for_delivery")).toBe(false);
    for (const to of ORDER_STATUSES) {
      expect(isAllowedMove("delivery", "delivered", to)).toBe(false);
      expect(isAllowedMove("delivery", "cancelled", to)).toBe(false);
    }
  });
});

describe("statuses shown and their badges", () => {
  it("lists the six statuses in path order and leaves confirmed out", () => {
    expect(ORDER_STATUSES_SHOWN).toEqual([
      "new",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ]);
  });

  it("maps each status to its badge variant", () => {
    expect(ORDER_STATUSES.map(statusBadgeVariant)).toEqual([
      "new",
      "new",
      "proc",
      "proc",
      "proc",
      "ok",
      "off",
    ]);
  });
});
