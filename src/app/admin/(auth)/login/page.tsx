import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/admin-auth/components/auth-card";
import { LoginForm } from "@/features/admin-auth/components/login-form";
import { safeAdminNext, withNext } from "@/features/admin-auth/next-path";
import { routes } from "@/lib/routes";
import { getAdminAccess } from "@/server/auth/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminAuth");
  return { title: t("loginMeta") };
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

// Step one of dashboard sign in (spec 0004 AC-1). An owner already past it moves on.
export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const next = firstParam((await searchParams).next);
  const access = await getAdminAccess();
  if (access.kind === "admin") redirect(safeAdminNext(next));
  if (access.kind === "needs_mfa") redirect(withNext(routes.admin.mfa, next));

  const t = await getTranslations("AdminAuth");
  return (
    <AuthCard title={t("loginTitle")}>
      <LoginForm next={next ? safeAdminNext(next) : undefined} />
    </AuthCard>
  );
}
