import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { historyLine } from "../account-rules";
import type { AccountEventRow } from "../server/admin-queries";

// "سجل الحساب" (spec 0019 AC-13): what the owner changed on this account, newest first. The rows
// hold no name or phone, so the lines name only roles and fields.
export function AccountHistory({ events }: { readonly events: readonly AccountEventRow[] }) {
  const t = useTranslations("AdminCustomers");

  const say = (event: AccountEventRow) => {
    const line = historyLine(event);
    switch (line.key) {
      case "historyRoleChanged":
        return t(line.key, { from: t(`role.${line.from}`), to: t(`role.${line.to}`) });
      case "historyDetailsEdited":
        return t(line.key, { fields: t(`fields.${line.fields}`) });
      case "historyRemoved":
        return t(line.key);
    }
  };

  return (
    <Card data-testid="customer-history">
      <h2 className="type-title-s">{t("historyCard")}</h2>
      {events.length ? (
        <ol className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col" data-testid="customer-history-line">
              <span>{say(event)}</span>
              <time dateTime={event.createdAt.toISOString()} className="type-small text-muted">
                {formatDateTime(event.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted">{t("noHistory")}</p>
      )}
    </Card>
  );
}
