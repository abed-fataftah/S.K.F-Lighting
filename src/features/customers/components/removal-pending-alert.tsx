"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { finishCustomerRemoval } from "../server/admin-actions";

// An unfinished removal (spec 0019 AC-12): the login is still there, so "إكمال الحذف" runs the
// login delete again. Success moves to the list with its notice; running it twice is safe.
export function RemovalPendingAlert({ profileId }: { readonly profileId: string }) {
  const t = useTranslations("AdminCustomers");
  const [problem, setProblem] = useState<"removal_unfinished" | "failed" | null>(null);
  const [pending, startTransition] = useTransition();

  const finish = () => {
    setProblem(null);
    startTransition(async () => {
      try {
        const result = await finishCustomerRemoval({ profileId });
        setProblem(result.error === "removal_unfinished" ? result.error : "failed");
      } catch {
        setProblem("failed");
      }
    });
  };

  return (
    <Alert data-testid="customer-removal-pending-alert">
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{t("pendingAlert")}</p>
        {problem ? (
          <p role="alert" className="font-bold" data-testid="customer-finish-problem">
            {t(problem)}
          </p>
        ) : null}
        <Button onClick={finish} disabled={pending} data-testid="customer-finish-removal">
          {t("finishRemoval")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
