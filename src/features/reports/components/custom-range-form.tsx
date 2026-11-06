import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { routes } from "@/lib/routes";
import type { ReportDays, ReportPeriodError, ReportPeriodErrors } from "../period";

const ERROR_KEYS = {
  from_invalid: "fromInvalid",
  to_invalid: "toInvalid",
  future: "future",
  from_after_to: "fromAfterTo",
  too_long: "tooLong",
} as const satisfies Record<ReportPeriodError, string>;

// The custom range (spec 0024 AC-3): a plain GET form back to the page, so it works without
// script. The typed days come back as they were, and an error shows under its own field while the
// page shows this month. Two 16rem fields never fit side by side on a phone, so each takes the row.
export function CustomRangeForm({
  typed,
  errors,
  today,
}: {
  readonly typed: ReportDays;
  readonly errors: ReportPeriodErrors;
  readonly today: string;
}) {
  const t = useTranslations("AdminReports");
  const fields = (["from", "to"] as const).map((name) => {
    const id = `reports-${name}`;
    const error = errors[name];
    return (
      <Field key={name} className="min-w-0 flex-[1_1_16rem]">
        <FieldLabel htmlFor={id}>{t(name)}</FieldLabel>
        <Input
          id={id}
          name={name}
          type="date"
          max={today}
          defaultValue={typed[name]}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error ? (
          <FieldError id={`${id}-error`}>{t(`errors.${ERROR_KEYS[error]}`)}</FieldError>
        ) : null}
      </Field>
    );
  });

  return (
    // Keyed on the typed days: a chip is a client navigation, and the uncontrolled fields must
    // start again from the new values.
    <form
      key={`${typed.from}|${typed.to}`}
      method="get"
      action={routes.admin.reports}
      aria-label={t("customLabel")}
      className="flex flex-wrap items-start gap-3"
      data-testid="reports-custom-form"
    >
      <input type="hidden" name="range" value="custom" />
      {fields}
      {/* Lined up with the inputs, under the labels. */}
      <Button type="submit" className="mt-7" data-testid="reports-show">
        {t("show")}
      </Button>
    </form>
  );
}
