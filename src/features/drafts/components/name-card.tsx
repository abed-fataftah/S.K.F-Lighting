"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { DRAFT_NAME_LIMITS } from "../schemas";
import { createDraft, renameDraft } from "../server/actions";
import { DeleteDraftDialog } from "./delete-draft-dialog";
import type { SaveQueue } from "./use-save-queue";

// The name card of the quick order page (spec 0020 AC-4, AC-5, AC-15): "اسم المسودة" with the
// open and new buttons, and on a saved draft the delete button too.

const NAME_ID = "draft-name";
const NAME_ERROR_ID = "draft-name-error";

type NameError = "too_short" | "too_long" | "name_taken" | "too_many_drafts" | "save_failed";

function nameErrorOf(result: { error: string; problem?: string }): NameError {
  if (result.error === "invalid") return result.problem === "too_long" ? "too_long" : "too_short";
  return result.error as NameError;
}

function NameCardShell({
  children,
  error,
  hint,
  actions,
}: {
  readonly children: ReactNode;
  readonly error: NameError | null;
  readonly hint?: string;
  readonly actions?: ReactNode;
}) {
  const t = useTranslations("QuickOrder");
  return (
    <Card>
      <Field>
        <FieldLabel htmlFor={NAME_ID}>{t("nameLabel")}</FieldLabel>
        {children}
        {hint && !error ? <FieldDescription id={`${NAME_ID}-hint`}>{hint}</FieldDescription> : null}
        <FieldError id={NAME_ERROR_ID}>{error ? t(`nameErrors.${error}`) : null}</FieldError>
      </Field>
      <div className="flex gap-2">
        <ButtonLink variant="outline" className="flex-1" render={<Link href={routes.drafts} />}>
          {t("openDraft")}
        </ButtonLink>
        <ButtonLink variant="outline" className="flex-1" render={<Link href={routes.quickOrder} />}>
          {t("newDraft")}
        </ButtonLink>
      </div>
      {actions}
    </Card>
  );
}

const fieldProps = (error: NameError | null, hint: boolean) => ({
  id: NAME_ID,
  autoComplete: "off",
  maxLength: DRAFT_NAME_LIMITS.max * 2,
  "aria-invalid": error ? (true as const) : undefined,
  "aria-describedby": error ? NAME_ERROR_ID : hint ? `${NAME_ID}-hint` : undefined,
  "data-testid": "draft-name",
});

/** AC-4: no draft yet. Enter, or leaving the field with text in it, creates it. */
export function NewDraftCard() {
  const t = useTranslations("QuickOrder");
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<NameError | null>(null);
  const creating = useRef(false);

  const create = async () => {
    if (creating.current || name.trim() === "") return;
    creating.current = true;
    const result = await createDraft({ name }).catch(() => null);
    creating.current = false;
    if (!result) return setError("save_failed");
    if (result.ok) {
      router.replace(routes.quickOrderDraft(result.data.draftId));
      return;
    }
    if (result.error === "forbidden") return router.replace(routes.account);
    setError(nameErrorOf(result));
  };

  return (
    <NameCardShell error={error} hint={t("nameHint")}>
      <Input
        {...fieldProps(error, true)}
        autoFocus
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        onBlur={create}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void create();
          }
        }}
      />
    </NameCardShell>
  );
}

/** AC-5: a saved draft. The name autosaves; a refused name stays with its error, unsaved. */
export function DraftNameCard({
  draftId,
  initialName,
  queue,
  onGone,
}: {
  readonly draftId: string;
  readonly initialName: string;
  readonly queue: SaveQueue;
  readonly onGone: (error: "forbidden" | "not_found") => void;
}) {
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [error, setError] = useState<NameError | null>(null);

  const save = (value: string) => ({
    key: "name",
    run: async () => {
      const result = await renameDraft({ draftId, name: value });
      if (result.ok) {
        setSavedName(result.data.name);
        setError(null);
        return "done" as const;
      }
      if (result.error === "save_failed") return "retry" as const;
      if (result.error === "forbidden" || result.error === "not_found") {
        onGone(result.error);
        return "done" as const;
      }
      setError(nameErrorOf(result));
      return "done" as const;
    },
  });

  return (
    <NameCardShell
      error={error}
      actions={<DeleteDraftDialog draftId={draftId} name={savedName} variant="button" />}
    >
      <Input
        {...fieldProps(error, false)}
        value={name}
        onChange={(event) => {
          const value = event.currentTarget.value;
          setName(value);
          queue.enqueueLater(save(value));
        }}
        onBlur={() => queue.flushField("name")}
      />
    </NameCardShell>
  );
}
