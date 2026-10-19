import type { Viewport } from "next";
import "./globals.css";

// Every page reaches under the phone's notch and home indicator; the fixed shell
// parts pad themselves with env(safe-area-inset-*) (spec 0003).
export const viewport: Viewport = { viewportFit: "cover" };

// The real root layouts are `[locale]/layout.tsx` (storefront), `(gallery)/design-system/layout.tsx`,
// and, later, `admin/layout.tsx` (dashboard). Each renders <html> through HtmlDocument.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return children;
}
