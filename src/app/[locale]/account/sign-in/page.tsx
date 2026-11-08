import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GuestCard } from "@/features/accounts/components/guest-card";
import { SignInTabs, type SignInTab } from "@/features/accounts/components/sign-in-tabs";
import { safeStorefrontNext } from "@/features/accounts/next-path";
import { getVerifiedUser } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("signIn"), robots: { index: false } };
}

const TABS: readonly SignInTab[] = ["login", "register", "reset"];

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

// Sign in, register, and reset (spec 0017 AC-1; docs/design/pages/sign-in.md). The first form
// comes from `?tab`; values outside the known set are ignored. A signed in visitor moves on. Asked
// of Supabase Auth, as the account pages do, so a session ended elsewhere (spec 0017 AC-8) stays
// here instead of bouncing back to the page that sent it.
export default async function SignInPage({ searchParams }: PageProps<"/[locale]/account/sign-in">) {
  const query = await searchParams;
  const rawNext = firstParam(query.next);
  if (await getVerifiedUser()) redirect(safeStorefrontNext(rawNext));

  const tabParam = firstParam(query.tab);
  const initialTab = TABS.find((tab) => tab === tabParam) ?? "login";
  // `next` travels on only when it is safe; the default (/account) needs no hidden field.
  const next = rawNext && safeStorefrontNext(rawNext) === rawNext ? rawNext : undefined;

  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-3 pb-8">
      <SignInTabs
        initialTab={initialTab}
        next={next}
        linkExpired={firstParam(query.error) === "link_expired"}
      />
      <GuestCard />
    </div>
  );
}
