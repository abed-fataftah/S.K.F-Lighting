// The order history and who did what (spec 0014 AC-5, AC-6, AC-8). Pure: the page turns each
// entry into its `AdminOrders.*` line.
import type { OrderStatus } from "./status";

type ActorKind = "guest" | "customer" | "electrician" | "admin" | "system";

/** المتجر for the owner, العميل for anyone else (a guest, a customer, an electrician, the system). */
export function actorKey(kind: ActorKind): "actorShop" | "actorCustomer" {
  return kind === "admin" ? "actorShop" : "actorCustomer";
}

export type HistoryEvent = {
  readonly id: string;
  readonly type: "created" | "status_changed" | "cancelled";
  readonly actorKind: ActorKind;
  readonly toStatus: OrderStatus | null;
  readonly at: Date;
};

export type HistoryEntry =
  | { readonly id: string; readonly at: Date; readonly kind: "created" }
  | {
      readonly id: string;
      readonly at: Date;
      readonly kind: "moved";
      readonly actor: ReturnType<typeof actorKey>;
      readonly status: OrderStatus;
    }
  | {
      readonly id: string;
      readonly at: Date;
      readonly kind: "cancelled";
      readonly actor: ReturnType<typeof actorKey>;
    };

/** The lines in the order given (oldest first); a move or cancel with no `to_status` is skipped. */
export function historyEntries(events: readonly HistoryEvent[]): readonly HistoryEntry[] {
  return events.flatMap((event): HistoryEntry[] => {
    const { id, at } = event;
    if (event.type === "created") return [{ id, at, kind: "created" }];
    if (event.toStatus === null) return [];
    const actor = actorKey(event.actorKind);
    return event.type === "cancelled"
      ? [{ id, at, kind: "cancelled", actor }]
      : [{ id, at, kind: "moved", actor, status: event.toStatus }];
  });
}
