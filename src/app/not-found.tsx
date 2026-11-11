import { HtmlDocument } from "@/components/html-document";

// An address no route matches. Font, tokens, and direction are in place; a storefront page that
// calls notFound() shows the designed card inside the shell instead ([locale]/not-found.tsx).
export default function NotFound() {
  return (
    <HtmlDocument>
      <main className="flex min-h-dvh items-center justify-center p-4">
        <p className="type-title-s">الصفحة غير موجودة</p>
      </main>
    </HtmlDocument>
  );
}
