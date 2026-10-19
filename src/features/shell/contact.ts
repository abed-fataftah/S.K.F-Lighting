// The footer's contact line (spec 0003, AC-15): a missing value hides its part, and both
// missing hides the line. Blank text counts as missing.
export type ShopContact = { readonly phone: string | null; readonly address: string | null };

export const noContact: ShopContact = { phone: null, address: null };

export function contactLine(contact: ShopContact): ShopContact | null {
  const phone = contact.phone?.trim() || null;
  const address = contact.address?.trim() || null;
  return phone || address ? { phone, address } : null;
}
