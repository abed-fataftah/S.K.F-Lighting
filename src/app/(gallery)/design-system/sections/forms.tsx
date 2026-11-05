import { getTranslations } from "next-intl/server";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { GallerySection, Labelled, SampleGroup } from "../gallery-section";

// Inputs, textarea, and select in each state, plus the field error pattern (AC-7, AC-8).
export async function FormsSection() {
  const t = await getTranslations("DesignSystem");
  const f = await getTranslations("DesignSystem.forms");

  return (
    <GallerySection id="forms" title={f("title")} text={f("text")}>
      <SampleGroup title={f("inputGroup")}>
        <FieldGroup className="max-w-(--page-max)">
          <Labelled label={t("states.default")} className="items-stretch">
            <Field>
              <FieldLabel htmlFor="ds-name">{f("nameLabel")}</FieldLabel>
              <Input id="ds-name" autoComplete="name" />
            </Field>
          </Labelled>
          <Labelled label={t("states.focus")} className="items-stretch">
            <Field>
              <FieldLabel htmlFor="ds-phone">{f("phoneLabel")}</FieldLabel>
              <Input
                id="ds-phone"
                type="tel"
                autoComplete="tel"
                dir="ltr"
                data-preview="focus"
                aria-describedby="ds-phone-help"
              />
              <FieldDescription id="ds-phone-help">{f("phoneHelp")}</FieldDescription>
            </Field>
          </Labelled>
          <Labelled label={t("states.disabled")} className="items-stretch">
            <Field>
              <FieldLabel htmlFor="ds-number">{f("disabledLabel")}</FieldLabel>
              <Input id="ds-number" dir="ltr" defaultValue="26-00123" disabled />
            </Field>
          </Labelled>
        </FieldGroup>
      </SampleGroup>

      <SampleGroup title={f("errorGroup")}>
        <FieldGroup className="max-w-(--page-max)">
          <Field>
            <FieldLabel htmlFor="ds-phone-bad">{f("phoneLabel")}</FieldLabel>
            <Input
              id="ds-phone-bad"
              type="tel"
              dir="ltr"
              defaultValue="0599"
              aria-invalid="true"
              aria-describedby="ds-phone-bad-error"
            />
            <FieldError id="ds-phone-bad-error">{f("phoneError")}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="ds-qty-bad">{f("quantityLabel")}</FieldLabel>
            <Input
              id="ds-qty-bad"
              inputMode="numeric"
              aria-invalid="true"
              aria-describedby="ds-qty-bad-error"
            />
            <FieldError id="ds-qty-bad-error">{f("quantityError")}</FieldError>
          </Field>
        </FieldGroup>
      </SampleGroup>

      <SampleGroup title={f("textareaGroup")}>
        <FieldGroup className="max-w-(--page-max)">
          <Field>
            <FieldLabel htmlFor="ds-address">{f("addressLabel")}</FieldLabel>
            <Textarea id="ds-address" autoComplete="street-address" />
          </Field>
          <Field>
            <FieldLabel htmlFor="ds-notes">{f("notesLabel")}</FieldLabel>
            <Textarea id="ds-notes" disabled />
          </Field>
        </FieldGroup>
      </SampleGroup>

      <SampleGroup title={f("selectGroup")}>
        <FieldGroup className="max-w-(--page-max)">
          <Field>
            <FieldLabel htmlFor="ds-zone">{f("zoneLabel")}</FieldLabel>
            <NativeSelect id="ds-zone" defaultValue="west-bank">
              <NativeSelectOption value="west-bank">{f("zoneWestBank")}</NativeSelectOption>
              <NativeSelectOption value="48">{f("zone48")}</NativeSelectOption>
            </NativeSelect>
          </Field>
        </FieldGroup>
      </SampleGroup>
    </GallerySection>
  );
}
