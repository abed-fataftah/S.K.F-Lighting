import { Globe } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/ltr";
import { StateCard } from "@/components/state-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { StatsPeriod } from "../period";
import type { SectionResult } from "../server/queries";
import type { SourceCount } from "../shape";
import { SectionError } from "./section-error";

// Where visitors came from (spec 0027 AC-4): up to 10 sources by visits, the known ones under one
// name, any other site as its bare host. WhatsApp's app sends no referrer, so the note says why.
export async function SourcesSection({
  result,
  period,
}: {
  readonly result: Promise<SectionResult<readonly SourceCount[]>>;
  readonly period: StatsPeriod;
}) {
  const [t, sources] = await Promise.all([getTranslations("Stats"), result]);
  if (!sources.ok) {
    return (
      <SectionError
        title={t("sources")}
        retryHref={routes.admin.stats(period.preset)}
        testId="stats-sources-error"
      />
    );
  }

  return (
    <section
      className="flex min-w-0 flex-[1_1_22rem] flex-col gap-3"
      aria-labelledby="stats-sources-title"
      data-testid="stats-sources"
    >
      <h2 id="stats-sources-title" className="type-lead">
        {t("sources")}
      </h2>
      {sources.data.length === 0 ? (
        <StateCard icon={Globe} title={t("sourcesEmpty")} data-testid="stats-sources-empty" />
      ) : (
        <Table aria-labelledby="stats-sources-title">
          <TableHeader>
            <TableRow>
              <TableHead>{t("source")}</TableHead>
              <TableHead>{t("visits")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.data.map(({ label, visits }) => (
              <TableRow
                key={typeof label === "string" ? label : `host:${label.host}`}
                data-testid="stats-source-row"
              >
                <TableCell className="font-extrabold">
                  {typeof label === "string" ? t(`sourceNames.${label}`) : <Ltr>{label.host}</Ltr>}
                </TableCell>
                <TableCell>{formatNumber(visits)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="type-small text-muted">{t("whatsappNote")}</p>
    </section>
  );
}
