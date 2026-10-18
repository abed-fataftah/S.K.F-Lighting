import "./globals.css";

// The real root layouts are `[locale]/layout.tsx` (storefront) and, later,
// `admin/layout.tsx` (dashboard). Each renders its own <html> with lang and dir.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return children;
}
