import { HtmlDocument } from "@/components/html-document";

// An address outside the storefront that no route matches (under /admin, /auth, /api). Font,
// tokens, and direction are in place. Storefront addresses, matched or not, show the designed card
// inside the shell instead ([locale]/[...rest]/page.tsx and [locale]/not-found.tsx).
export default function NotFound() {
  return (
    <HtmlDocument>
      <main className="flex min-h-dvh items-center justify-center p-4">
        <p className="type-title-s">الصفحة غير موجودة</p>
      </main>
    </HtmlDocument>
  );
}
