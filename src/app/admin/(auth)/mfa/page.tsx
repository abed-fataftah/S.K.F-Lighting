import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/admin-auth/components/auth-card";
import { TotpEnroll } from "@/features/admin-auth/components/totp-enroll";
import { TotpForm } from "@/features/admin-auth/components/totp-form";
import { safeAdminNext, withNext } from "@/features/admin-auth/next-path";
import { routes } from "@/lib/routes";
import { getAdminAccess } from "@/server/auth/admin";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminAuth");
  return { title: t("mfaMeta") };
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

// Step two of dashboard sign in (spec 0004 AC-1): the code from an authenticator app, or setting
// one up when the owner has none verified yet. Only a signed in admin at `aal1` sees this page.
export default async function AdminMfaPage({ searchParams }: PageProps<"/admin/mfa">) {
  const next = firstParam((await searchParams).next);
  const access = await getAdminAccess();
  if (access.kind === "admin") redirect(safeAdminNext(next));
  if (access.kind !== "needs_mfa") redirect(withNext(routes.admin.login, next));

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp[0];
  const safeNext = next ? safeAdminNext(next) : undefined;
  const t = await getTranslations("AdminAuth");

  return factor ? (
    <AuthCard title={t("mfaTitle")} text={t("verifyText")}>
      <TotpForm factorId={factor.id} next={safeNext} />
    </AuthCard>
  ) : (
    <AuthCard title={t("enrollTitle")} text={t("enrollText")}>
      <TotpEnroll next={safeNext} />
    </AuthCard>
  );
}
