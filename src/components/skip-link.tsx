import { useTranslations } from "next-intl";

// The first tab stop on every page (design.md section 9). Hidden until focused,
// then shown as a yellow button at the top start corner. Targets <main id="main" tabIndex={-1}>.
export function SkipLink() {
  const t = useTranslations("Shell");

  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-(--z-sheet) focus:inline-flex focus:h-11 focus:items-center focus:rounded-btn focus:border focus:border-ink focus:bg-yellow focus:px-4 focus:type-body focus:font-extrabold focus:text-ink"
    >
      {t("skipToContent")}
    </a>
  );
}
