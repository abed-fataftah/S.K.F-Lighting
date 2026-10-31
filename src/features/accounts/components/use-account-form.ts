"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { FieldErrorCode, FieldErrors } from "@/lib/form-errors";

// The behaviour every account form shares (spec 0017 AC-3): field errors under their fields with
// focus on the first one, an error with no field in a box that takes focus, typed values kept
// after a refusal except passwords. The form submits through a transition, so React never resets it.

type Failure = {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: FieldErrors;
};
type State = { readonly ok: true } | Failure | null;

/** Action errors shown under a field instead of in the box, as `[field, code]`. */
export type ErrorFields = Readonly<Partial<Record<string, readonly [string, FieldErrorCode]>>>;

/** The errors with a message in `Account.errors`; anything else shows the generic one. */
const BANNER_ERRORS = [
  "email_taken",
  "too_many",
  "failed",
  "invalid_credentials",
  "owner_needs_runbook",
  "not_signed_in",
] as const;
export type BannerError = (typeof BANNER_ERRORS)[number];
const asBanner = (error: string): BannerError =>
  BANNER_ERRORS.find((known) => known === error) ?? "failed";

export const fieldId = (form: string, field: string) => `${form}-${field}`;
export const errorId = (form: string, field: string) => `${form}-${field}-error`;

export function useAccountForm<S extends State>(
  action: (previous: S, form: FormData) => Promise<S>,
  options: {
    readonly form: string;
    readonly order: readonly string[];
    readonly errorFields?: ErrorFields;
  },
) {
  const [state, dispatch, pending] = useActionState(
    action as (previous: Awaited<S>, form: FormData) => Promise<S>,
    null as Awaited<S>,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const failure = (state && !state.ok ? state : null) as Failure | null;
  const asField = failure ? options.errorFields?.[failure.error] : undefined;
  const fieldErrors: FieldErrors =
    failure?.error === "invalid"
      ? (failure.fieldErrors ?? {})
      : asField
        ? { [asField[0]]: { code: asField[1] } }
        : {};
  const bannerError =
    failure && failure.error !== "invalid" && !asField ? asBanner(failure.error) : null;

  useEffect(() => {
    const form = formRef.current;
    if (!form || !state) return;
    for (const input of form.querySelectorAll<HTMLInputElement>("input[type=password]")) {
      input.value = "";
    }
    if (state.ok) return;
    const first = options.order.find((field) => fieldErrors[field]);
    if (first) form.querySelector<HTMLElement>(`#${fieldId(options.form, first)}`)?.focus();
    else bannerRef.current?.focus();
    // Runs once per action result; the values it reads come from that same result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };

  return { state, pending, formRef, bannerRef, fieldErrors, bannerError, submit };
}
