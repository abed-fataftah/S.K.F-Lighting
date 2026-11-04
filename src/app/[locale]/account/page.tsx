import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
// does not draw it. An electrician sees a badge under the title (spec 0019 AC-9) and the tools card
// with quick order and drafts (spec 0020 AC-2). A signed out visitor goes to sign in and comes back here.
export default async function AccountPage({ searchParams }: PageProps<"/[locale]/account">) {
  const [account, query, t] = await Promise.all([
    getAccountProfile(),
    searchParams,
    getTranslations("Account"),
  ]);
  if (!account) redirect(routes.signInWith({ next: routes.account }));

  const profile = account.profile;
  const passwordSet = query.notice === "password_set";

  // The owner started removing this account (spec 0019 AC-12): only the message and sign out.
  if (profile?.removalPending) {
    return (
      <div className="flex flex-col gap-3 px-(--page-pad) pt-3 pb-8">
        <h1 className="type-title-l">{t("accountTitle")}</h1>
        <Alert data-testid="account-removed">
          <AlertDescription>{t("accountRemoved")}</AlertDescription>
        </Alert>
        <SignOutButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-3 pb-8">
      <div className="flex flex-col items-start gap-1">
        <h1 className="type-title-l">{t("accountTitle")}</h1>
        {profile?.role === "electrician" ? (
          <Badge variant="new" data-testid="electrician-badge">
            {t("electricianBadge")}
          </Badge>
        ) : null}
        <ButtonLink
          variant="outline"
          render={<Link href={routes.accountOrders} />}
          data-testid="orders-link"
        >
          {t("ordersLink")}
        </ButtonLink>
      </div>
      {profile?.role === "electrician" ? (
        <Card data-testid="electrician-tools">
          <h2 className="type-lead">{t("electricianTools")}</h2>
          <div className="flex gap-2">
            <ButtonLink
              className="flex-1"
              render={<Link href={routes.quickOrder} />}
              data-testid="quick-order-link"
            >
              {t("quickOrderLink")}
            </ButtonLink>
            <ButtonLink
              className="flex-1"
              render={<Link href={routes.drafts} />}
              data-testid="drafts-link"
            >
              {t("draftsLink")}
            </ButtonLink>
          </div>
        </Card>
      ) : null}
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
