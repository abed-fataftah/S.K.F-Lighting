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
import { Card } from "@/components/ui/card";
import { removeCustomer } from "../server/admin-actions";

type Problem = "has_open_orders" | "has_balance" | "removal_unfinished" | "failed";

const asProblem = (error: string): Problem =>
  error === "has_open_orders" || error === "has_balance" || error === "removal_unfinished"
    ? error
    : "failed";

// "حذف الحساب" (spec 0019 AC-11): outline buttons with a bin icon (the design keeps red for form
// errors only), and a confirm dialog saying plainly what goes and what stays. On
// success the action moves to the list with its notice; a half done removal refreshes this page
// into the pending state (AC-12), and every other refusal stays in the dialog.
export function RemoveCard({
  profileId,
  name,
}: {
  readonly profileId: string;
  readonly name: string | null;
}) {
  const t = useTranslations("AdminCustomers");
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) setProblem(null);
  };

  const confirm = () => {
    startTransition(async () => {
      try {
        const result = await removeCustomer({ profileId });
        setProblem(asProblem(result.error));
      } catch {
        setProblem("failed");
      }
    });
  };

  return (
    <Card data-testid="customer-remove-card">
      <h2 className="type-title-s">{t("removeCard")}</h2>
      <AlertDialog open={open} onOpenChange={change}>
        <AlertDialogTrigger
          render={<Button variant="outline" className="w-full" />}
          data-testid="customer-remove"
        >
          <Trash2 aria-hidden />
          {t("remove")}
        </AlertDialogTrigger>
        <AlertDialogContent data-testid="customer-remove-dialog">
          <AlertDialogTitle>
            {name ? t("removeTitle", { name }) : t("removeTitleNoName")}
          </AlertDialogTitle>
          <AlertDialogDescription render={<div />} className="flex flex-col gap-1">
            <p>{t("removeLoginLine")}</p>
            <p>{t("removeOrdersLine")}</p>
            <p className="font-bold">{t("removeFinalLine")}</p>
          </AlertDialogDescription>
          {problem ? (
            <Alert data-testid="customer-remove-problem">
              <AlertDescription>{t(problem)}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogActions>
            <Button
              variant="outline"
              onClick={confirm}
              disabled={pending}
              data-testid="customer-remove-confirm"
            >
              <Trash2 aria-hidden />
              {t("removeConfirm")}
            </Button>
            <AlertDialogClose render={<Button variant="outline" />} disabled={pending}>
              {t("back")}
            </AlertDialogClose>
          </AlertDialogActions>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
