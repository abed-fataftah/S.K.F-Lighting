"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogActions,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { deleteDraft } from "../server/actions";

// Delete a draft (spec 0020 AC-15), from a drafts list card (an icon button) or the quick order
// name card (an outline button). Confirm deletes; already gone counts as done. Either way the
// electrician lands on the drafts list with "تم حذف المسودة.".
export function DeleteDraftDialog({
  draftId,
  name,
  variant,
}: {
  readonly draftId: string;
  readonly name: string;
  readonly variant: "icon" | "button";
}) {
  const t = useTranslations("Drafts");
  const tq = useTranslations("QuickOrder");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      setFailed(false);
      const result = await deleteDraft({ draftId }).catch(() => null);
      if (result?.ok) {
        setOpen(false);
        router.replace(routes.draftsWith("deleted"));
        router.refresh();
      } else if (result?.error === "forbidden") {
        router.replace(routes.account);
      } else {
        setFailed(true);
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          variant === "icon" ? (
            <Button
              variant="outline"
              size="icon"
              aria-label={t("deleteLabel", { name })}
              data-testid="delete-draft"
            />
          ) : (
            <Button variant="outline" data-testid="delete-draft" />
          )
        }
      >
        {variant === "icon" ? <Trash2 aria-hidden /> : tq("deleteDraft")}
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="delete-draft-dialog">
        <AlertDialogTitle>{t("deleteTitle", { name })}</AlertDialogTitle>
        <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
        {failed ? (
          <Alert>
            <AlertDescription>{t("deleteFailed")}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogActions>
          <Button onClick={confirm} disabled={pending} data-testid="delete-draft-confirm">
            {t("deleteConfirm")}
          </Button>
          <AlertDialogClose render={<Button variant="outline" />}>
            {t("deleteCancel")}
          </AlertDialogClose>
        </AlertDialogActions>
      </AlertDialogContent>
    </AlertDialog>
  );
}
