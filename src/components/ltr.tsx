import type { ReactNode } from "react";

// Codes, order numbers, and phone numbers read left to right inside Arabic text,
// so 26-00123 never turns into 00123-26 (design.md section 8).
export function Ltr({ children }: { readonly children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}
