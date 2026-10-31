import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

// Under the sign in forms (spec 0017 AC-1; docs/design/pages/sign-in.md): ordering stays open to
// guests.
export async function GuestCard() {
  const t = await getTranslations("Account");
  return (
    <Card data-testid="guest-card">
      <h2 className="type-lead">{t("guestTitle")}</h2>
      <p className="type-small text-muted">{t("guestText")}</p>
      <ButtonLink variant="outline" size="lg" render={<Link href={routes.cart} />}>
        {t("guestContinue")}
      </ButtonLink>
      <ButtonLink variant="outline" size="lg" render={<Link href={routes.orderTrack} />}>
        {t("guestTrack")}
      </ButtonLink>
    </Card>
  );
}
