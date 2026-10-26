// Every WhatsApp button opens wa.me with a prefilled Arabic message (design.md section 7).
// The number is digits with the country code (O-24); anything else in it is dropped.
export function whatsappUrl(number: string, text: string): string {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
