"use client";

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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { AdminSub } from "../../category-rules";
import { deleteCategory, type DeleteCategoryResult } from "../../server/category-actions";

type Problem = Exclude<DeleteCategoryResult, { ok: true }>["error"];

// Delete confirm (spec 0008 AC-5): names the category; a category that gained a product or a sub
// meanwhile is refused with `not_empty` and nothing changes.
export function DeleteCategoryDialog({
  category,
  onClose,
}: {
  readonly category: AdminSub | null;
  readonly onClose: () => void;
}) {
  const t = useTranslations("AdminCategories");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setProblem(null);
    onClose();
  };

  const confirm = () => {
    if (!category) return;
    startTransition(async () => {
      try {
        const result = await deleteCategory({ id: category.id });
        if (result.ok) close();
        else setProblem(result.error);
      } catch {
        setProblem("failed");
      }
    });
  };

  return (
    <AlertDialog open={category !== null} onOpenChange={(open) => (open ? null : close())}>
      <AlertDialogContent data-testid="category-delete-dialog">
        <AlertDialogTitle>{t("deleteTitle", { name: category?.name ?? "" })}</AlertDialogTitle>
        <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
        {problem ? (
          <Alert>
            <AlertDescription>{t(`errors.${problem}`)}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogActions>
          <Button onClick={confirm} disabled={pending} data-testid="category-delete-confirm">
            {pending ? t("deleting") : t("deleteConfirm")}
          </Button>
          <AlertDialogClose render={<Button variant="outline" />}>{t("keep")}</AlertDialogClose>
        </AlertDialogActions>
      </AlertDialogContent>
    </AlertDialog>
  );
}
