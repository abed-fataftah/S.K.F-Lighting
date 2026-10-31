import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { signOutCustomer } from "../server/actions";

// "تسجيل الخروج" on /account (spec 0017 AC-11): this browser only, then the home page.
export async function SignOutButton() {
  const t = await getTranslations("Account");
  return (
    <form action={signOutCustomer}>
      <Button type="submit" variant="outline" size="lg" className="w-full" data-testid="sign-out">
        <LogOut aria-hidden />
        {t("signOut")}
      </Button>
    </form>
  );
}
