// Who may use quick order and drafts (spec 0020 AC-1): an electrician whose removal has not
// started. The role is read fresh from the database on every request (spec 0019).
import type { AccountProfile } from "@/features/accounts/server/profile";

export function canUseDrafts(profile: AccountProfile | null): boolean {
  return profile?.role === "electrician" && !profile.removalPending;
}
