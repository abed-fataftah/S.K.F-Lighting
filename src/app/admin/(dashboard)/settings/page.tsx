import type { Metadata } from "next";
import { reportError } from "@/server/monitoring/report";
import { failureOf } from "@/server/monitoring/throttle";
import { getTranslations } from "next-intl/server";
import { ContactCard } from "@/features/settings/components/contact-card";
import { PoliciesCard } from "@/features/settings/components/policies-card";
import { SettingsError } from "@/features/settings/components/settings-error";
import { ZonesCard } from "@/features/settings/components/zones-card";
import { getSettingsPage } from "@/features/settings/server/queries";
import { pickWhatsappNumber } from "@/features/shell/server/shop-contact";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { withTimeLimit } from "@/server/db/time-limit";

const SETTINGS_READ_TIMEOUT_MS = 3000;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminSettings");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// The settings hub (spec 0025 AC-1; docs/design/pages/admin-settings.md, changed by the spec): one
// column of cards that each save on their own. The guard runs before the timed read, so its
// redirect is never mistaken for a failed read.
export default async function AdminSettingsPage() {
  await requireAdminPage(routes.admin.settings);
  const [t, result] = await Promise.all([
    getTranslations("AdminSettings"),
    withTimeLimit(getSettingsPage, SETTINGS_READ_TIMEOUT_MS),
  ]);
  if (!result.ok) {
    await reportError("settings_read_failed", failureOf(result));
  }

  return (
    <div className="flex max-w-(--admin-column-max) flex-col gap-4">
      <h1 className="type-display-s">{t("title")}</h1>
      {result.ok ? (
        <>
          <ContactCard
            contact={result.data.contact}
            numberInUse={pickWhatsappNumber(result.data.contact.whatsappNumber)}
          />
          <ZonesCard zones={result.data.zones} />
          <PoliciesCard policies={result.data.policies} />
        </>
      ) : (
        <SettingsError />
      )}
    </div>
  );
}
