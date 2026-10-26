import { Almarai } from "next/font/google";

// The one font of the shop (design.md section 3). Every layout puts `almarai.variable`
// on <html>; tokens.css reads it through --skf-font. The latin subset makes Western
// digits, ₪, and "S.K.F" render in Almarai too.
export const almarai = Almarai({
  weight: ["400", "700", "800"],
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-almarai",
  fallback: ["Segoe UI", "Tahoma", "Arial"],
});
