"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { routes } from "@/lib/routes";
import { useFieldErrorText } from "@/lib/use-field-error-text";
import { productFieldOrder } from "../schemas";
import { createProduct, type ProductFormState } from "../server/actions";
import type { CategoryOption } from "../server/queries";

const fieldId = (field: string) => `product-${field}`;
const errorId = (field: string) => `product-${field}-error`;
const helpId = (field: string) => `product-${field}-help`;

// Add a product (spec 0004 AC-2): the four fields of slice 1 in the editor's look
// (docs/design/pages/admin-product-editor.md). Feature 7 replaces it with the full editor.
export function ProductForm({ categories }: { readonly categories: readonly CategoryOption[] }) {
  const t = useTranslations("AdminProducts");
  const errorText = useFieldErrorText();
  const [state, dispatch, pending] = useActionState(createProduct, null as ProductFormState);
  // "Add another" hides the success notice and gives a fresh, empty form.
  const [dismissed, setDismissed] = useState<ProductFormState>(null);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLHeadingElement>(null);

  const created = state?.ok && state !== dismissed ? state.data : null;
  const fieldErrors =
    state && !state.ok && state.error === "invalid" ? (state.fieldErrors ?? {}) : {};
  const banner =
    state && !state.ok && state.error !== "invalid" ? t(`errors.${state.error}`) : null;

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      noticeRef.current?.focus();
      return;
    }
    if (state.error !== "invalid" || !state.fieldErrors) return;
    const first = productFieldOrder.find((field) => state.fieldErrors?.[field]);
    if (first) formRef.current?.querySelector<HTMLElement>(`#${fieldId(first)}`)?.focus();
  }, [state]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    startTransition(() => dispatch(form));
  };

  const addAnother = () => {
    setDismissed(state);
    setFormKey((key) => key + 1);
  };

  const describedBy = (field: string, help?: boolean) =>
    fieldErrors[field] ? errorId(field) : help ? helpId(field) : undefined;
  const control = (field: string, help?: boolean) => ({
    id: fieldId(field),
    name: field,
    "aria-invalid": fieldErrors[field] ? (true as const) : undefined,
    "aria-describedby": describedBy(field, help),
  });
  const errorFor = (field: string) => (
    <FieldError id={errorId(field)}>{errorText(fieldErrors[field])}</FieldError>
  );

  if (created) {
    return (
      <Card className="max-w-(--admin-form-max)" role="status" data-testid="product-saved">
        <h2 ref={noticeRef} tabIndex={-1} className="flex items-center gap-2 type-title-s">
          <CircleCheck aria-hidden className="size-6" />
          {t("saved")}
        </h2>
        <p>{t("savedText", { name: created.name })}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink
            variant="outline"
            render={<Link href={routes.product(created.slug)} />}
            data-testid="product-view"
          >
            {t("view")}
          </ButtonLink>
          <Button onClick={addAnother}>{t("addAnother")}</Button>
        </div>
      </Card>
    );
  }

  return (
    <form
      key={formKey}
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="flex max-w-(--admin-form-max) flex-col gap-4"
    >
      <Card>
        <h2 className="type-title-s">{t("basics")}</h2>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={fieldId("name")}>{t("name")}</FieldLabel>
            <Input {...control("name")} required maxLength={240} />
            {errorFor("name")}
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("code")}>{t("code")}</FieldLabel>
            <Input
              {...control("code", true)}
              required
              dir="ltr"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={60}
            />
            <FieldDescription id={helpId("code")}>{t("codeHelp")}</FieldDescription>
            {errorFor("code")}
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("categoryId")}>{t("category")}</FieldLabel>
            <NativeSelect {...control("categoryId")} defaultValue="">
              <NativeSelectOption value="">{t("categoryPlaceholder")}</NativeSelectOption>
              {categories.map((category) => (
                <NativeSelectOption key={category.id} value={category.id}>
                  {category.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {errorFor("categoryId")}
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("newCategoryName")}>{t("newCategory")}</FieldLabel>
            <Input {...control("newCategoryName", true)} maxLength={120} />
            <FieldDescription id={helpId("newCategoryName")}>
              {t("newCategoryHelp")}
            </FieldDescription>
            {errorFor("newCategoryName")}
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("price")}>{t("price")}</FieldLabel>
            <Input
              {...control("price", true)}
              required
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              maxLength={20}
            />
            <FieldDescription id={helpId("price")}>{t("priceHelp")}</FieldDescription>
            {errorFor("price")}
          </Field>
        </FieldGroup>
      </Card>
      {banner ? (
        <Alert id="product-banner">
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        aria-describedby={banner ? "product-banner" : undefined}
        className="self-start"
        data-testid="product-save"
      >
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
