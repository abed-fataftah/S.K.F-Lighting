import "server-only";
import { redirect } from "next/navigation";
import {
  getAccountProfile,
  getVerifiedAccount,
  type Account,
} from "@/features/accounts/server/profile";
import { routes } from "@/lib/routes";
import { canUseDrafts } from "../access";

/**
 * The page check of spec 0020 AC-1: signed out goes to sign in and comes back to `next`; signed
 * in but not an electrician (no profile, another role, removal pending) goes to the account page.
 * Asked of Supabase Auth like the other account pages, so a session ended elsewhere (spec 0017
 * AC-8) no longer reads the drafts.
 */
export async function requireElectricianPage(next: string): Promise<Account> {
  const account = await getVerifiedAccount();
  if (!account) redirect(routes.signInWith({ next }));
  if (!canUseDrafts(account.profile)) redirect(routes.account);
  return account;
}

/** Spec 0021 AC-1: catalog pages offer "add to draft" to the same electricians, read per request. */
export async function canAddToDraft(): Promise<boolean> {
  const account = await getAccountProfile();
  return canUseDrafts(account?.profile ?? null);
}
