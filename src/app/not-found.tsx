import { HtmlDocument } from "@/components/html-document";

// Font, tokens, and direction are in place; the designed content (pages/not-found.md)
// waits for its own feature.
export default function NotFound() {
  return (
    <HtmlDocument>
      <main className="flex min-h-dvh items-center justify-center p-4">
        <p className="type-title-s">الصفحة غير موجودة</p>
      </main>
    </HtmlDocument>
  );
}
