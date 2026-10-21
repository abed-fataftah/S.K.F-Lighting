"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import type { CategoryChoice } from "../server/admin-queries";
import { useEditorField, type SectionProps } from "./editor-fields";

const DESCRIPTION_MAX = 4000;

// Name, code, category, and description (spec 0006 AC-2, AC-13, AC-18). The code is fixed once the
// product exists; the sub select lists the children of the chosen main and is off when it has none.
export function BasicsSection({
  state,
  setState,
  errors,
  disabled,
  categories,
  codeFixed,
}: SectionProps & {
  readonly categories: readonly CategoryChoice[];
  readonly codeFixed: boolean;
}) {
  const t = useTranslations("AdminProducts");
  const { control, errorFor, helpId } = useEditorField(errors);
  const set = (patch: Partial<typeof state>) => setState((current) => ({ ...current, ...patch }));
  const subs = categories.find((main) => main.id === state.mainCategoryId)?.children ?? [];

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
        <div className="flex flex-wrap gap-3">
          <Field className="min-w-0 flex-[1_1_14rem]">
            <FieldLabel htmlFor={control("categoryId").id}>{t("mainCategory")}</FieldLabel>
            <NativeSelect
              {...control("categoryId")}
              value={state.mainCategoryId}
              onChange={(event) => set({ mainCategoryId: event.target.value, subCategoryId: "" })}
              disabled={disabled}
            >
              <NativeSelectOption value="">{t("mainPlaceholder")}</NativeSelectOption>
              {categories.map((main) => (
                <NativeSelectOption key={main.id} value={main.id}>
                  {main.name}
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
              {subs.map((sub) => (
                <NativeSelectOption key={sub.id} value={sub.id}>
                  {sub.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {!subs.length && state.mainCategoryId ? (
              <FieldDescription id={helpId("subCategoryId")}>{t("subHelpNone")}</FieldDescription>
            ) : null}
            {errorFor("subCategoryId")}
          </Field>
        </div>
        {disabled ? null : (
          <Field>
            <FieldLabel htmlFor={control("newCategoryName").id}>{t("newCategory")}</FieldLabel>
            <Input
              {...control("newCategoryName", { help: true })}
              value={state.newCategoryName}
              onChange={(event) => set({ newCategoryName: event.target.value })}
              maxLength={120}
            />
            <FieldDescription id={helpId("newCategoryName")}>
              {t("newCategoryHelp")}
            </FieldDescription>
            {errorFor("newCategoryName")}
          </Field>
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
