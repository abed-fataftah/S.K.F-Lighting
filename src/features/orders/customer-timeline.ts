// The customer's view of an order's status (spec 0015 AC-9): the steps of its fulfilment path,
// each done, current, or upcoming. Pure, built from the same `PATHS` as the dashboard moves.
import { PATHS, type Fulfilment, type OrderStatus, type WritableStatus } from "./status";

export type TimelineStep = {
  readonly status: Exclude<WritableStatus, "cancelled">;
  readonly state: "done" | "current" | "upcoming";
};

export type CustomerTimeline =
  | { readonly kind: "cancelled" }
  | { readonly kind: "path"; readonly steps: readonly TimelineStep[] };

/**
 * `confirmed` counts as `new`. A status off this path (a pickup order at `out_for_delivery`)
 * shows `ready` as current, so the customer still sees the order is waiting for them.
 */
export function customerTimeline(fulfilment: Fulfilment, status: OrderStatus): CustomerTimeline {
  if (status === "cancelled") return { kind: "cancelled" };
  const path = PATHS[fulfilment].filter(
    (step): step is TimelineStep["status"] => step !== "cancelled",
  );
  const shown = status === "confirmed" ? "new" : status;
  const found = path.indexOf(shown);
  const at = found >= 0 ? found : path.indexOf("ready");
  return {
    kind: "path",
    steps: path.map((step, index) => ({
      status: step,
      state: index < at ? "done" : index === at ? "current" : "upcoming",
    })),
  };
}

/** The current step of a timeline that is not cancelled. */
export function currentStep(steps: readonly TimelineStep[]): TimelineStep["status"] {
  return steps.find((step) => step.state === "current")?.status ?? steps[0].status;
}
