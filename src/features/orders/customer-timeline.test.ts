import { describe, expect, it } from "vitest";
import { currentStep, customerTimeline } from "./customer-timeline";
import { ORDER_STATUSES } from "./status";

// covers: AC-9 (spec 0015)

const states = (timeline: ReturnType<typeof customerTimeline>) =>
  timeline.kind === "path" ? timeline.steps.map((step) => `${step.status}:${step.state}`) : [];

describe("customerTimeline", () => {
  it.each([
    ["new", ["new:current", "preparing:upcoming", "ready:upcoming", "delivered:upcoming"]],
    ["confirmed", ["new:current", "preparing:upcoming", "ready:upcoming", "delivered:upcoming"]],
    ["preparing", ["new:done", "preparing:current", "ready:upcoming", "delivered:upcoming"]],
    ["ready", ["new:done", "preparing:done", "ready:current", "delivered:upcoming"]],
    ["delivered", ["new:done", "preparing:done", "ready:done", "delivered:current"]],
  ] as const)("walks the pickup path at %s", (status, expected) => {
    expect(states(customerTimeline("pickup", status))).toEqual(expected);
  });

  it.each([
    [
      "new",
      [
        "new:current",
        "preparing:upcoming",
        "ready:upcoming",
        "out_for_delivery:upcoming",
        "delivered:upcoming",
      ],
    ],
    [
      "ready",
      [
        "new:done",
        "preparing:done",
        "ready:current",
        "out_for_delivery:upcoming",
        "delivered:upcoming",
      ],
    ],
    [
      "out_for_delivery",
      [
        "new:done",
        "preparing:done",
        "ready:done",
        "out_for_delivery:current",
        "delivered:upcoming",
      ],
    ],
    [
      "delivered",
      ["new:done", "preparing:done", "ready:done", "out_for_delivery:done", "delivered:current"],
    ],
  ] as const)("walks the delivery path at %s", (status, expected) => {
    expect(states(customerTimeline("delivery", status))).toEqual(expected);
  });

  it("shows ready as current for a pickup order at out_for_delivery", () => {
    expect(states(customerTimeline("pickup", "out_for_delivery"))).toEqual([
      "new:done",
      "preparing:done",
      "ready:current",
      "delivered:upcoming",
    ]);
  });

  it.each(["pickup", "delivery"] as const)("is one cancelled line on %s", (fulfilment) => {
    expect(customerTimeline(fulfilment, "cancelled")).toEqual({ kind: "cancelled" });
  });

  it("has exactly one current step for every status that is not cancelled", () => {
    for (const fulfilment of ["pickup", "delivery"] as const) {
      for (const status of ORDER_STATUSES.filter((s) => s !== "cancelled")) {
        const timeline = customerTimeline(fulfilment, status);
        if (timeline.kind !== "path") throw new Error("expected a path");
        expect(timeline.steps.filter((step) => step.state === "current")).toHaveLength(1);
      }
    }
  });
});

describe("currentStep", () => {
  it("names the current step", () => {
    const timeline = customerTimeline("delivery", "preparing");
    if (timeline.kind !== "path") throw new Error("expected a path");
    expect(currentStep(timeline.steps)).toBe("preparing");
  });
});
