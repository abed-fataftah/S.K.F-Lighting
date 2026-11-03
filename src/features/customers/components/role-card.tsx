"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
import { otherRole, type AssignableRole } from "../roles";
import { changeCustomerRole } from "../server/admin-actions";
import { RoleBadge } from "./role-badge";

// "الدور" (spec 0019 AC-7): the current role and one switch, behind a confirm dialog. The page
// refreshes itself after the action; the dialog stays open with the message on an error, and a
// stale role also refreshes the page so the card shows where it really stands.
export function RoleCard({
  profileId,
  name,
  role,
}: {
  readonly profileId: string;
  readonly name: string | null;
  readonly role: AssignableRole;
}) {
  const t = useTranslations("AdminCustomers");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<"stale" | "failed" | null>(null);
  const [done, setDone] = useState<AssignableRole | null>(null);
  const [pending, startTransition] = useTransition();
  const to = otherRole(role);

  const change = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) setProblem(null);
  };

  const confirm = () => {
    setDone(null);
    startTransition(async () => {
      try {
        const result = await changeCustomerRole({ profileId, from: role, to });
        if (result.ok) {
          setOpen(false);
          setProblem(null);
          setDone(result.data.role);
        } else if (result.error === "stale") {
          setProblem("stale");
          startTransition(() => router.refresh());
        } else {
          setProblem("failed");
        }
      } catch {
        setProblem("failed");
      }
    });
  };

  return (
    <Card data-testid="customer-role-card">
      <h2 className="type-title-s">{t("roleCard")}</h2>
      <RoleBadge role={role} className="w-fit" data-testid="customer-role" />
      {done ? (
        <p role="status" className="flex items-center gap-2 font-bold" data-testid="role-done">
          <CircleCheck aria-hidden className="size-5.5 shrink-0" />
          {t(`roleDone.${done}`)}
        </p>
      ) : null}
      <AlertDialog open={open} onOpenChange={change}>
        <AlertDialogTrigger
          render={<Button variant="outline" className="w-full" />}
          data-testid="customer-role-change"
        >
          {to === "electrician" ? t("toElectrician") : t("toCustomer")}
        </AlertDialogTrigger>
        <AlertDialogContent data-testid="customer-role-dialog">
          <AlertDialogTitle>
            {t(`roleTitle.${to}`, { name: name ?? t("thisAccount") })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("roleText")}</AlertDialogDescription>
          {problem ? (
            <Alert data-testid="customer-role-problem">
              <AlertDescription>{t(problem)}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogActions>
            <Button onClick={confirm} disabled={pending} data-testid="customer-role-confirm">
              {t("confirm")}
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
