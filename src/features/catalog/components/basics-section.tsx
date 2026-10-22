"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { CategoryChoice } from "../server/admin-queries";
import { useEditorField, type SectionProps } from "./editor-fields";

const DESCRIPTION_MAX = 4000;

// Name, code, category, and description (spec 0006 AC-2, AC-13; spec 0008 AC-17). The code is fixed
// once the product exists; the sub select lists the children of the chosen main and is off when it
// has none. Categories are made on the categories page: a hidden one is marked, choosing one that
// is not shown warns that the product will not show, and "إدارة الأقسام" leaves through the
// unsaved changes guard.
export function BasicsSection({
  state,
  setState,
  errors,
  disabled,
  categories,
  codeFixed,
  onLeave,
}: SectionProps & {
  readonly categories: readonly CategoryChoice[];
  readonly codeFixed: boolean;
  /** Goes to `href`, asking first when there are unsaved changes. */
  readonly onLeave: (href: string) => void;
}) {
  const t = useTranslations("AdminProducts");
  const { control, errorFor, helpId } = useEditorField(errors);
  const set = (patch: Partial<typeof state>) => setState((current) => ({ ...current, ...patch }));
  const main = categories.find((choice) => choice.id === state.mainCategoryId);
  const subs = main?.children ?? [];
  const sub = subs.find((choice) => choice.id === state.subCategoryId);
  // Shown means it and its main are visible (spec 0008 AC-6).
  const notShown = !!main && (!main.isVisible || (!!sub && !sub.isVisible));
  const optionName = (choice: { readonly name: string; readonly isVisible: boolean }) =>
    choice.isVisible ? choice.name : t("hiddenOption", { name: choice.name });
  const manage = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onLeave(routes.admin.categories);
  };
  const manageLink = (
    <Link
      href={routes.admin.categories}
      onClick={manage}
      className="inline-flex min-h-11 items-center font-bold underline underline-offset-4"
      data-testid="manage-categories"
    >
      {t("manageCategories")}
    </Link>
  );

  return (
    <Card>
      <h2 className="type-title-s">{t("basics")}</h2>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={control("name").id}>{t("name")}</FieldLabel>
          <Input
            {...control("name")}
            value={state.name}
            onChange={(event) => set({ name: event.target.value })}
            disabled={disabled}
            required
            maxLength={240}
          />
          {errorFor("name")}
        </Field>
        <Field>
          <FieldLabel htmlFor={control("code").id}>{t("codeLabel")}</FieldLabel>
          <Input
            {...control("code", { help: true })}
            value={state.code}
            onChange={(event) => set({ code: event.target.value })}
            readOnly={codeFixed}
            disabled={disabled}
            required
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={60}
            className={codeFixed ? "bg-page" : undefined}
          />
          <FieldDescription id={helpId("code")}>
            {codeFixed ? t("codeFixed") : t("codeHelp")}
          </FieldDescription>
          {errorFor("code")}
        </Field>
        {categories.length === 0 ? (
          <Alert data-testid="no-categories">
            <AlertDescription className="flex flex-col items-start gap-1">
              <span id={control("categoryId").id} tabIndex={-1}>
                {t("noCategories")}
              </span>
              {disabled ? null : manageLink}
            </AlertDescription>
            {errorFor("categoryId")}
          </Alert>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-3">
              <Field className="min-w-0 flex-[1_1_14rem]">
                <FieldLabel htmlFor={control("categoryId").id}>{t("mainCategory")}</FieldLabel>
                <NativeSelect
                  {...control("categoryId")}
                  value={state.mainCategoryId}
                  onChange={(event) =>
                    set({ mainCategoryId: event.target.value, subCategoryId: "" })
                  }
                  disabled={disabled}
                >
                  <NativeSelectOption value="">{t("mainPlaceholder")}</NativeSelectOption>
                  {categories.map((choice) => (
                    <NativeSelectOption key={choice.id} value={choice.id}>
                      {optionName(choice)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errorFor("categoryId")}
              </Field>
              <Field className="min-w-0 flex-[1_1_14rem]">
                <FieldLabel htmlFor={control("subCategoryId").id}>{t("subCategory")}</FieldLabel>
                <NativeSelect
                  {...control("subCategoryId", { help: !subs.length && !!state.mainCategoryId })}
                  value={state.subCategoryId}
                  onChange={(event) => set({ subCategoryId: event.target.value })}
                  disabled={disabled || subs.length === 0}
                >
                  <NativeSelectOption value="">{t("subNone")}</NativeSelectOption>
                  {subs.map((choice) => (
                    <NativeSelectOption key={choice.id} value={choice.id}>
                      {optionName(choice)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {!subs.length && state.mainCategoryId ? (
                  <FieldDescription id={helpId("subCategoryId")}>
                    {t("subHelpNone")}
                  </FieldDescription>
                ) : null}
                {errorFor("subCategoryId")}
              </Field>
            </div>
            {notShown ? (
              <p className="type-small font-bold" data-testid="hidden-category-warning">
                {t("hiddenCategoryWarning")}
              </p>
            ) : null}
            {disabled ? null : manageLink}
          </div>
        )}
        <Field>
          <FieldLabel htmlFor={control("description").id}>{t("description")}</FieldLabel>
          <Textarea
            {...control("description", { help: true })}
            value={state.description}
            onChange={(event) => set({ description: event.target.value })}
            disabled={disabled}
            maxLength={DESCRIPTION_MAX * 2}
          />
          <FieldDescription id={helpId("description")}>
            {t("descriptionHelp", { max: formatNumber(DESCRIPTION_MAX) })}
          </FieldDescription>
          {errorFor("description")}
        </Field>
      </FieldGroup>
    </Card>
  );
}
