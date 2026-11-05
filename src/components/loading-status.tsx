import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

// Loading (design.md section 7): skeletons shaped like the real content, announced once
// with a visually hidden sentence. Pass the skeleton as children.
export function LoadingStatus({
  label,
  children,
  className,
}: {
  /** Overrides the default "جارٍ التحميل...", e.g. "جارٍ تحميل المنتجات". */
  readonly label?: string;
  readonly children?: ReactNode;
  readonly className?: string;
}) {
  const t = useTranslations("Shell");

  return (
    <div role="status" data-slot="loading-status" className={className}>
      <span className="sr-only">{label ?? t("loading")}</span>
      {children}
    </div>
  );
}
