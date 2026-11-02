import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChangePasswordForm } from "@/features/accounts/components/change-password-form";
import { ProfileForm } from "@/features/accounts/components/profile-form";
import { SignOutButton } from "@/features/accounts/components/sign-out-button";
import { getAccountProfile } from "@/features/accounts/server/profile";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("account"), robots: { index: false } };
}

// The account page (spec 0017 AC-9 to AC-11), built from the existing parts; the design package
// does not draw it. A signed out visitor goes to sign in and comes back here.
export default async function AccountPage({ searchParams }: PageProps<"/[locale]/account">) {
  const [account, query, t] = await Promise.all([
    getAccountProfile(),
    searchParams,
    getTranslations("Account"),
  ]);
  if (!account) redirect(routes.signInWith({ next: routes.account }));

  const profile = account.profile;
  const passwordSet = query.notice === "password_set";

  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-3 pb-8">
      <div className="flex flex-col items-start gap-1">
        <h1 className="type-title-l">{t("accountTitle")}</h1>
        <ButtonLink
          variant="outline"
          render={<Link href={routes.accountOrders} />}
          data-testid="orders-link"
        >
          {t("ordersLink")}
        </ButtonLink>
      </div>
      {passwordSet ? (
        <p role="status" className="flex items-center gap-2 font-bold" data-testid="password-set">
          <CircleCheck aria-hidden className="size-5.5 shrink-0" />
          {t("passwordSet")}
        </p>
      ) : null}
      {profile?.phoneE164 ? null : (
        <Alert data-testid="phone-missing">
          <AlertDescription>{t("phoneMissing")}</AlertDescription>
        </Alert>
      )}
      <Card>
        <h2 className="type-lead">{t("myDetails")}</h2>
        <ProfileForm
          email={account.email ?? ""}
          name={profile?.fullName ?? ""}
          phone={profile?.phone ?? ""}
        />
      </Card>
      <Card>
        <h2 className="type-lead">{t("changePasswordTitle")}</h2>
        <ChangePasswordForm />
      </Card>
      <SignOutButton />
    </div>
  );
}
