"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode, Ref } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HONEYPOT_FIELD } from "../schemas";

/**
 * The bot trap on register and reset (spec 0017 AC-3, AC-7), exactly as checkout's: out of view,
 * out of the tab order, hidden from screen readers, and inert.
 */
export function Honeypot({ form }: { readonly form: string }) {
  const t = useTranslations("Account");
  return (
    <div className="sr-only" inert aria-hidden="true">
      <label htmlFor={`${form}-trap`}>{t("honeypot")}</label>
      <input
        id={`${form}-trap`}
        type="text"
        name={HONEYPOT_FIELD}
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
}

/** An error with no field, above the button; it takes focus when it appears (AC-3). */
export function FormBanner({
  id,
  ref,
  children,
}: {
  readonly id: string;
  readonly ref: Ref<HTMLDivElement>;
  readonly children: ReactNode;
}) {
  return (
    <Alert id={id} ref={ref} tabIndex={-1} data-testid={id}>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/** A success line, announced politely. */
export function FormNotice({
  id,
  children,
}: {
  readonly id: string;
  readonly children: ReactNode;
}) {
  return (
    <p role="status" id={id} data-testid={id} className="flex items-center gap-2 font-bold">
      <CircleCheck aria-hidden className="size-5.5 shrink-0" />
      {children}
    </p>
  );
}
