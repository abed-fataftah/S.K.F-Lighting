import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { SetPasswordForm } from "@/features/accounts/components/set-password-form";
import { hasFreshRecovery } from "@/features/accounts/server/recovery";
import { routes } from "@/lib/routes";
import { getClaims } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("resetPassword"), robots: { index: false } };
}

// The new password after a reset link (spec 0017 AC-8). `confirmRecovery` signed the visitor in;
// without a session there is nothing to set, so it goes to sign in. More than 10 minutes after the
// link, the change needs the current password on /account (AC-10).
export default async function ResetPasswordPage() {
  const userId = (await getClaims())?.sub;
  if (!userId) {
    redirect(routes.signInWith({ next: routes.accountResetPassword }));
  }
  if (!(await hasFreshRecovery(userId))) redirect(routes.account);
  const t = await getTranslations("Account");
  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-3 pb-8">
      <h1 className="type-title-l">{t("newPasswordTitle")}</h1>
      <Card>
        <SetPasswordForm />
      </Card>
    </div>
  );
}
