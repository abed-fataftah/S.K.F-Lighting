import "server-only";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { readSettingsPage, type SettingsPageData } from "./settings-db";

/** What `/admin/settings` opens with; the guard runs here too, so a page that forgets it shows nothing. */
export async function getSettingsPage(): Promise<SettingsPageData> {
  await requireAdminPage(routes.admin.settings);
  return readSettingsPage(await getDb());
}
