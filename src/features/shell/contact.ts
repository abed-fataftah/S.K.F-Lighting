// The footer's contact line (spec 0003, AC-15): a missing value hides its part, and both
// missing hides the line. Blank text counts as missing. The same read carries the WhatsApp number
// (spec 0025 AC-3), which the line ignores.
export type ContactLine = { readonly phone: string | null; readonly address: string | null };

export type ShopContact = ContactLine & { readonly whatsappNumber: string | null };

export const noContact: ShopContact = { phone: null, address: null, whatsappNumber: null };

export function contactLine(contact: ContactLine): ContactLine | null {
  const phone = contact.phone?.trim() || null;
  const address = contact.address?.trim() || null;
  return phone || address ? { phone, address } : null;
}
