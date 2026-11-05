// The order history and who did what (spec 0014 AC-5, AC-6, AC-8). Pure: the page turns each
// entry into its `AdminOrders.*` line.
import type { PaymentMethod } from "@/features/payments/ledger";
import type { ActorKind, OrderStatus } from "./status";

/** المتجر for the owner, العميل for anyone else (a guest, a customer, an electrician, the system). */
export function actorKey(kind: ActorKind): "actorShop" | "actorCustomer" {
  return kind === "admin" ? "actorShop" : "actorCustomer";
}

/**
 * Events that flag an order until it is opened: a new order, and a cancel by someone else (spec
 * 0014 AC-14). A price save (spec 0022 AC-8) and a payment (spec 0023 AC-10) are written seen and
 * never flag.
 */
export const FLAGGING_EVENTS = ["created", "cancelled"] as const;

export type HistoryEvent = {
  readonly id: string;
  readonly type:
    "created" | "status_changed" | "cancelled" | "line_price_changed" | "payment_recorded";
  readonly actorKind: ActorKind;
  readonly toStatus: OrderStatus | null;
  readonly data: Readonly<Record<string, unknown>>;
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
    }
  | {
      readonly id: string;
      readonly at: Date;
      readonly kind: "prices";
      readonly from: number;
      readonly to: number;
      readonly count: number;
      readonly note?: string;
    }
  | {
      readonly id: string;
      readonly at: Date;
      readonly kind: "payment";
      readonly entry: "payment" | "refund" | "reversal";
      readonly amount: number;
      readonly method: PaymentMethod;
    };

const amount = (value: unknown): number => (Number.isSafeInteger(value) ? (value as number) : 0);

const entryKind = (value: unknown): "payment" | "refund" | "reversal" =>
  value === "refund" || value === "reversal" ? value : "payment";

/**
 * The lines in the order given (oldest first); a move or cancel with no `to_status` is skipped. A
 * price save (spec 0022 AC-8) and a payment, refund, or reversal (spec 0023 AC-10) show whatever
 * their `to_status`, from their `data`.
 */
export function historyEntries(events: readonly HistoryEvent[]): readonly HistoryEntry[] {
  return events.flatMap((event): HistoryEntry[] => {
    const { id, at } = event;
    if (event.type === "created") return [{ id, at, kind: "created" }];
    if (event.type === "line_price_changed") {
      const note = event.data.note;
      return [
        {
          id,
          at,
          kind: "prices",
          from: amount(event.data.fromTotal),
          to: amount(event.data.toTotal),
          count: amount(event.data.lineCount),
          ...(typeof note === "string" && note !== "" ? { note } : {}),
        },
      ];
    }
    if (event.type === "payment_recorded") {
      return [
        {
          id,
          at,
          kind: "payment",
          entry: entryKind(event.data.kind),
          amount: amount(event.data.amount),
          method: event.data.method === "cheque" ? "cheque" : "cash",
        },
      ];
    }
    if (event.toStatus === null) return [];
    const actor = actorKey(event.actorKind);
    return event.type === "cancelled"
      ? [{ id, at, kind: "cancelled", actor }]
      : [{ id, at, kind: "moved", actor, status: event.toStatus }];
  });
}
