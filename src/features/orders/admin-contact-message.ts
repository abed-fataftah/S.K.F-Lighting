// "مراسلة العميل" (spec 0014 AC-7): the owner's WhatsApp message to the customer about their
// order. Pure: the text comes in as a translator over `AdminOrders.contactMessage`. It carries
// the name, the plain order number, and the status, never a price or an address.
import { tidyText } from "@/lib/arabic";

export type ContactMessageTranslate = (
  key: "contactMessage",
  values: Readonly<{ name: string; number: string; status: string }>,
) => string;

export type ContactMessageOrder = {
  readonly name: string;
  readonly number: string;
  /** The AC-1 label of the order's status. */
  readonly statusLabel: string;
};

export function adminContactMessage(
  order: ContactMessageOrder,
  t: ContactMessageTranslate,
): string {
  // tidyText drops line breaks and direction marks, so a saved name or number cannot break the
  // message or flip its reading order.
  return t("contactMessage", {
    name: tidyText(order.name),
    number: tidyText(order.number),
    status: order.statusLabel,
  });
}
