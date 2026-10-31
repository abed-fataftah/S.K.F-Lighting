import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/admin-auth/components/auth-card";
import { confirmRecovery } from "@/features/accounts/server/actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  // The token sits in this page's address, so it must never leave in a Referer header.
  return {
    title: t("confirmRecovery"),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

const firstParam = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

// Where the reset email's link lands (spec 0017 AC-8). Opening it uses nothing up: the token waits
// in this form, so a mail scanner or a link preview that fetches the page cannot burn it. Only
// "متابعة" (a POST) checks the token.
export default async function ConfirmRecoveryPage({ searchParams }: PageProps<"/auth/confirm">) {
  const [query, t] = await Promise.all([searchParams, getTranslations("Account")]);
  return (
    <AuthCard title={t("confirmTitle")} text={t("confirmText")}>
      <form action={confirmRecovery} className="flex flex-col">
        <input type="hidden" name="token_hash" value={firstParam(query.token_hash)} />
        <input type="hidden" name="type" value={firstParam(query.type)} />
        <Button type="submit" size="lg" data-testid="confirm-recovery">
          {t("confirmContinue")}
        </Button>
      </form>
    </AuthCard>
  );
}
