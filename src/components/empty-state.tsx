import { PackageOpen, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { StateCard } from "@/components/state-card";

// Nothing to show yet: the empty card. Each page passes its own title, text, and buttons
// from its page file; the defaults are for places the boards do not draw.
export function EmptyState({
  icon = PackageOpen,
  title,
  text,
  actions,
  className,
}: {
  readonly icon?: LucideIcon;
  readonly title?: ReactNode;
  readonly text?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
}) {
  const t = useTranslations("Shell.empty");

  return (
    <StateCard
      data-slot="empty-state"
      icon={icon}
      title={title ?? t("title")}
      text={text ?? t("text")}
      actions={actions}
      className={className}
    />
  );
}
