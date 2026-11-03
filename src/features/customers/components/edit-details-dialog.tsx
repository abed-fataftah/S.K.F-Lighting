"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { AccountField } from "@/features/accounts/components/account-field";
import { fieldId } from "@/features/accounts/components/use-account-form";
import { fieldOrder } from "@/features/accounts/schemas";
import { NAME_LIMITS } from "@/features/checkout/schemas";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import { customerDetailsSchema } from "../schemas";
import { updateCustomerDetails } from "../server/admin-actions";

const FORM = "customer-details";

// "تعديل البيانات" (spec 0019 AC-10): name and phone with the account form's own rules, checked
// here and again on the server, with focus on the first field in error. The page refreshes itself
// after a save; the dialog closes and the card says it saved.
export function EditDetailsDialog({
  profileId,
  name,
  phone,
}: {
  readonly profileId: string;
  readonly name: string | null;
  readonly phone: string | null;
}) {
  const t = useTranslations("AdminCustomers");
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: name ?? "", phone: phone ?? "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const focusFirstError = (found: FieldErrors) => {
    const first = fieldOrder.profile.find((field) => found[field]);
    if (first) document.getElementById(fieldId(FORM, first))?.focus();
  };

  const change = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (next) {
      setValues({ name: name ?? "", phone: phone ?? "" });
      setErrors({});
      setProblem(false);
      setSaved(false);
    }
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProblem(false);
    const input = { profileId, ...values };
    const parsed = customerDetailsSchema.safeParse(input);
    if (!parsed.success) {
      const found = fieldErrorsOf(parsed.error);
      setErrors(found);
      focusFirstError(found);
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const result = await updateCustomerDetails(input);
        if (result.ok) {
          setOpen(false);
          setSaved(true);
        } else if (result.error === "invalid" && "fieldErrors" in result) {
          setErrors(result.fieldErrors);
          focusFirstError(result.fieldErrors);
        } else {
          setProblem(true);
        }
      } catch {
        setProblem(true);
      }
    });
  };

  return (
    <>
      {saved ? (
        <p role="status" className="flex items-center gap-2 font-bold" data-testid="details-saved">
          <CircleCheck aria-hidden className="size-5.5 shrink-0" />
          {t("detailsSaved")}
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={change}>
        <DialogTrigger
          render={<Button variant="outline" className="w-full" />}
          data-testid="customer-edit"
        >
          {t("editDetails")}
        </DialogTrigger>
        <DialogContent data-testid="customer-edit-dialog">
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <form onSubmit={save} noValidate className="flex flex-col gap-4">
            <FieldGroup>
              <AccountField
                form={FORM}
                name="name"
                label={t("name")}
                autoComplete="off"
                value={values.name}
                onChange={(event) => setValues({ ...values, name: event.target.value })}
                maxLength={NAME_LIMITS.max * 2}
                required
                errors={errors}
              />
              <AccountField
                form={FORM}
                name="phone"
                label={t("phone")}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                dir="ltr"
                value={values.phone}
                onChange={(event) => setValues({ ...values, phone: event.target.value })}
                required
                errors={errors}
              />
            </FieldGroup>
            {problem ? (
              <Alert data-testid="customer-edit-problem">
                <AlertDescription>{t("failed")}</AlertDescription>
              </Alert>
            ) : null}
            <DialogActions>
              <Button type="submit" disabled={pending} data-testid="customer-edit-save">
                {pending ? t("saving") : t("save")}
              </Button>
              <DialogClose render={<Button variant="outline" />} disabled={pending}>
                {t("back")}
              </DialogClose>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
