import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { SetPasswordForm } from "@/features/accounts/components/set-password-form";
import { routes } from "@/lib/routes";
import { getClaims } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("resetPassword"), robots: { index: false } };
}

// The new password after a reset link (spec 0017 AC-8). `confirmRecovery` signed the visitor in;
// without a session there is nothing to set, so it goes to sign in.
export default async function ResetPasswordPage() {
  if (!(await getClaims())?.sub) {
    redirect(routes.signInWith({ next: routes.accountResetPassword }));
  }
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
