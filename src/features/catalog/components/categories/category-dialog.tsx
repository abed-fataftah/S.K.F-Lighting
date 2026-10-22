"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import type { FieldErrors } from "@/lib/form-errors";
import { useFieldErrorText } from "@/lib/use-field-error-text";
import type { AdminSub } from "../../category-rules";
import { CATEGORY_LIMITS, createCategorySchema, updateCategorySchema } from "../../schemas";
import { fieldErrorsOf } from "@/lib/form-errors";
import {
  createCategory,
  updateCategory,
  type CategoryFormError,
} from "../../server/category-actions";

/** What the dialog opens for: a new main, a new sub under `parent`, or an edit. */
export type CategoryDialogTarget =
  | {
      readonly kind: "add";
      readonly parent: {
        readonly id: string;
        readonly name: string;
        readonly isVisible: boolean;
      } | null;
    }
  | {
      readonly kind: "edit";
      readonly category: AdminSub;
      /** The category is a sub whose main is hidden. */
      readonly parentHidden: boolean;
    };

const FIELDS = ["name", "description"] as const;

// The one category dialog (spec 0008 AC-2, AC-3; O-23): name, description, and the "shown in the
// shop" switch. The same schema checks the form here and in the action. On an error, focus moves
// to the first field with a message (design.md section 7).
export function CategoryDialog({
  target,
  onClose,
}: {
  readonly target: CategoryDialogTarget | null;
  readonly onClose: () => void;
}) {
  const t = useTranslations("AdminCategories");
  const errorText = useFieldErrorText();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<CategoryFormError | null>(null);
  const [pending, startTransition] = useTransition();

  const editing = target?.kind === "edit" ? target.category : null;
  const parentHidden =
    target?.kind === "edit"
      ? target.parentHidden
      : target?.parent
        ? !target.parent.isVisible
        : false;
  const fieldId = (name: string) => `${id}-${name}`;

  const focusFirstError = (found: FieldErrors) => {
    const first = FIELDS.find((name) => found[name]);
    if (first)
      formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(fieldId(first))}`)?.focus();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form) as Record<string, string>;
    const local =
      target.kind === "edit"
        ? updateCategorySchema.safeParse(values)
        : createCategorySchema.safeParse(values);
    if (!local.success) {
      const found = fieldErrorsOf(local.error);
      setErrors(found);
      setProblem(null);
      focusFirstError(found);
      return;
    }
    startTransition(async () => {
      try {
        const result =
          target.kind === "edit" ? await updateCategory(form) : await createCategory(form);
        if (result.ok) {
          setErrors({});
          setProblem(null);
          onClose();
          return;
        }
        const found = result.fieldErrors ?? {};
        setErrors(found);
        setProblem(result.fieldErrors?.name ? null : result.error);
        focusFirstError(found);
      } catch {
        setProblem("failed");
      }
    });
  };

  const control = (name: (typeof FIELDS)[number]) => ({
    id: fieldId(name),
    name,
    "aria-invalid": errors[name] ? (true as const) : undefined,
    "aria-describedby": errors[name] ? `${fieldId(name)}-error` : `${fieldId(name)}-help`,
  });

  const title = editing
    ? t("editTitle", { name: editing.name })
    : target?.kind === "add" && target.parent
      ? t("addSubTitle", { name: target.parent.name })
      : t("addMainTitle");

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (open) return;
        setErrors({});
        setProblem(null);
        onClose();
      }}
    >
      <DialogContent data-testid="category-dialog">
        <DialogTitle>{title}</DialogTitle>
        {/* A new key per target resets the fields when the dialog opens for another category. */}
        <form
          key={
            editing?.id ?? (target?.kind === "add" ? `add-${target.parent?.id ?? "main"}` : "none")
          }
          ref={formRef}
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-3"
        >
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          {target?.kind === "add" && target.parent ? (
            <input type="hidden" name="parentId" value={target.parent.id} />
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={fieldId("name")}>{t("name")}</FieldLabel>
              <Input
                {...control("name")}
                defaultValue={editing?.name ?? ""}
                required
                autoComplete="off"
                maxLength={CATEGORY_LIMITS.nameMax * 2}
              />
              <FieldDescription id={`${fieldId("name")}-help`}>
                {t("nameHelp", {
                  min: formatNumber(CATEGORY_LIMITS.nameMin),
                  max: formatNumber(CATEGORY_LIMITS.nameMax),
                })}
              </FieldDescription>
              <FieldError id={`${fieldId("name")}-error`}>{errorText(errors.name)}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor={fieldId("description")}>{t("description")}</FieldLabel>
              <Textarea
                {...control("description")}
                defaultValue={editing?.description ?? ""}
                maxLength={CATEGORY_LIMITS.descriptionMax * 2}
              />
              <FieldDescription id={`${fieldId("description")}-help`}>
                {t("descriptionHelp", { max: formatNumber(CATEGORY_LIMITS.descriptionMax) })}
              </FieldDescription>
              <FieldError id={`${fieldId("description")}-error`}>
                {errorText(errors.description)}
              </FieldError>
            </Field>
            <Field>
              <div className="flex min-h-11 items-center justify-between gap-3">
                <span id={fieldId("visible")} className="font-bold">
                  {t("visible")}
                </span>
                <Switch
                  name="isVisible"
                  defaultChecked={editing?.isVisible ?? true}
                  aria-labelledby={fieldId("visible")}
                  aria-describedby={`${fieldId("visible")}-help`}
                />
              </div>
              <FieldDescription id={`${fieldId("visible")}-help`}>
                {t("visibleHelp")}
              </FieldDescription>
            </Field>
          </FieldGroup>
          {parentHidden ? (
            <Alert>
              <AlertDescription>{t("hiddenParentNote")}</AlertDescription>
            </Alert>
          ) : null}
          {problem ? (
            <Alert>
              <AlertDescription>{t(`errors.${problem}`)}</AlertDescription>
            </Alert>
          ) : null}
          <DialogActions>
            <Button type="submit" disabled={pending} data-testid="category-save">
              {pending ? t("saving") : t("save")}
            </Button>
            <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
