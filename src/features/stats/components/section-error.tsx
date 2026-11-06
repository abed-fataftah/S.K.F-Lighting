import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { StateCard } from "@/components/state-card";
import { ButtonLink } from "@/components/ui/button";

// One section that failed or took too long (spec 0027 AC-7). The retry is a plain link to the
// same address, not a Next link, so it really loads the page again; the other sections stay.
export function SectionError({
  title,
  retryHref,
  testId,
}: {
  readonly title: string;
  readonly retryHref: string;
  readonly testId: string;
}) {
  const t = useTranslations("Stats");

  return (
    <section aria-label={title} className="flex min-w-0 flex-[1_1_22rem] flex-col">
      <StateCard
        role="alert"
        icon={CircleAlert}
        title={t("sectionError")}
        text={title}
        data-testid={testId}
        actions={
          <ButtonLink variant="outline" size="lg" href={retryHref}>
            {t("retry")}
          </ButtonLink>
        }
      />
    </section>
  );
}
