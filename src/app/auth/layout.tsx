import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { HtmlDocument } from "@/components/html-document";
import { SkipLink } from "@/components/skip-link";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// The root layout of the auth callbacks (spec 0017 AC-8): outside locale routing like the
// dashboard, so it renders <html> itself, Arabic and right to left, never indexed.
export default function AuthRootLayout({ children }: LayoutProps<"/auth">) {
  return (
    <HtmlDocument>
      <NextIntlClientProvider>
        <SkipLink />
        {children}
      </NextIntlClientProvider>
    </HtmlDocument>
  );
}
