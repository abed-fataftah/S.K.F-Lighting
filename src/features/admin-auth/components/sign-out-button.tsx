import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOut } from "../server/actions";

// Ends the owner's session (spec 0004 AC-1). Sits on the black sidebar, under "عرض المتجر".
export async function SignOutButton() {
  const t = await getTranslations("AdminShell");
  return (
    <form action={signOut} className="pt-2.5">
      <button
        type="submit"
        className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-btn type-body font-bold text-white underline"
        data-testid="admin-sign-out"
      >
        <LogOut aria-hidden className="size-5" />
        {t("signOut")}
      </button>
    </form>
  );
}
