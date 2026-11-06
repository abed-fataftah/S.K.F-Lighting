"use client";

import { CircleCheck } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PolicySlug } from "@/features/policies/slugs";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import { routes } from "@/lib/routes";
import { useFieldErrorText } from "@/lib/use-field-error-text";
import { POLICY_BODY, POLICY_TITLE, savePolicySchema } from "../schemas";
import { savePolicyPage } from "../server/actions";
import { focusFirstError, SettingsField } from "./settings-field";

// The policy editor (spec 0025 AC-10, AC-11): title, Markdown body with a preview drawn by the
// live page's own `PolicyBody`, and a save that carries the version it loaded. A save refused as
// stale keeps the typed text. Leaving with unsaved changes asks the browser's own question; in
// app links are not intercepted.

// Loaded only when the preview opens, so the Markdown parser stays out of the first load.
const PolicyBody = dynamic(
  () => import("@/features/policies/components/policy-body").then((module) => module.PolicyBody),
  { loading: () => <Skeleton className="h-40 w-full" /> },
);

const FIELDS = ["title", "body"] as const;
const fieldId = (field: string) => `policy-${field}`;
type Notice = "saved" | "stale" | "not_found" | "failed" | null;

export function PolicyEditor({
  slug,
  title: loadedTitle,
  body: loadedBody,
  version: loadedVersion,
}: {
  readonly slug: PolicySlug;
  readonly title: string;
  readonly body: string;
  readonly version: number;
}) {
  const t = useTranslations("AdminSettings");
  const errorText = useFieldErrorText();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(loadedTitle);
  const [body, setBody] = useState(loadedBody);
  const [saved, setSaved] = useState({ title: loadedTitle, body: loadedBody });
  const [version, setVersion] = useState(loadedVersion);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  const dirty = title !== saved.title || body !== saved.body;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const showErrors = (found: FieldErrors) => {
    setErrors(found);
    setMode("edit");
    // The fields mount again when the preview closes; focus once they are back.
    requestAnimationFrame(() => focusFirstError(formRef.current, FIELDS, found, fieldId));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setNotice(null);
    const input = { slug, title, body, version };
    const parsed = savePolicySchema.safeParse(input);
    if (!parsed.success) return showErrors(fieldErrorsOf(parsed.error));
    setErrors({});
    startTransition(async () => {
      const result = await savePolicyPage(input);
      if (result.ok) {
        setVersion(result.data.version);
        setTitle(parsed.data.title);
        setBody(parsed.data.body);
        setSaved({ title: parsed.data.title, body: parsed.data.body });
        setNotice("saved");
      } else if (result.error === "invalid") showErrors(result.fieldErrors);
      else if (result.error === "forbidden") router.refresh();
      else setNotice(result.error);
    });
  };

  const alerts = { stale: t("stale"), not_found: t("pageNotFound"), failed: t("failed") };

  return (
    <div className="flex max-w-(--admin-column-max) flex-col gap-4">
      <Link href={routes.admin.settings} className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="type-display-s">{saved.title}</h1>
      <Card>
        <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
          <ToggleGroup
            aria-label={t("modeLabel")}
            value={[mode]}
            onValueChange={(next: unknown[]) => {
              const picked = next[0];
              if (picked === "edit" || picked === "preview") setMode(picked);
            }}
          >
            <ToggleGroupItem value="edit" data-testid="policy-mode-edit">
              {t("editMode")}
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" data-testid="policy-mode-preview">
              {t("preview")}
            </ToggleGroupItem>
          </ToggleGroup>
          {mode === "edit" ? (
            <>
              <SettingsField
                id={fieldId("title")}
                name="title"
                label={t("pageTitle")}
                value={title}
                error={errors.title}
                maxLength={POLICY_TITLE.max * 2}
                autoComplete="off"
                onChange={(event) => {
                  setTitle(event.currentTarget.value);
                  setNotice(null);
                }}
              />
              <Field>
                <FieldLabel htmlFor={fieldId("body")}>{t("pageBody")}</FieldLabel>
                <Textarea
                  id={fieldId("body")}
                  name="body"
                  dir="rtl"
                  value={body}
                  maxLength={POLICY_BODY.max * 2}
                  aria-invalid={errors.body ? true : undefined}
                  aria-describedby={
                    errors.body
                      ? `${fieldId("body")}-hint ${fieldId("body")}-error`
                      : `${fieldId("body")}-hint`
                  }
                  className="max-h-none min-h-80"
                  onChange={(event) => {
                    setBody(event.currentTarget.value);
                    setNotice(null);
                  }}
                  data-testid="policy-body-input"
                />
                <FieldDescription id={`${fieldId("body")}-hint`}>
                  {t("pageBodyHelp")}
                </FieldDescription>
                <FieldError id={`${fieldId("body")}-error`}>{errorText(errors.body)}</FieldError>
              </Field>
            </>
          ) : (
            <div className="flex flex-col gap-2.5" data-testid="policy-preview">
              <h2 className="type-title-s">{title}</h2>
              <PolicyBody markdown={body} />
            </div>
          )}
          {notice && notice !== "saved" ? (
            <Alert role="alert" data-testid={`policy-${notice}`}>
              <AlertDescription>{alerts[notice]}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={pending}
              focusableWhenDisabled
              aria-busy={pending || undefined}
              data-testid="policy-save"
            >
              {pending ? t("saving") : t("savePage")}
            </Button>
            <ButtonLink
              variant="outline"
              href={routes.policy(slug)}
              target="_blank"
              rel="noopener"
              data-testid="policy-view"
            >
              {t("viewPage")}
              <span className="sr-only">{t("opensInNewTab")}</span>
            </ButtonLink>
            <p role="status" className="flex items-center gap-1.5 font-bold">
              {notice === "saved" ? (
                <>
                  <CircleCheck aria-hidden className="size-5 text-whatsapp" />
                  {t("pageSaved")}
                </>
              ) : null}
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
