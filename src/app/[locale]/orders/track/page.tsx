import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrderLookupForm } from "@/features/orders/components/order-lookup-form";
import { parseOrderNumberInput } from "@/features/orders/order-number";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("orderTrack"), robots: { index: false } };
}

// The guest lookup (spec 0015 AC-1; docs/design/pages/order.md, board "Order lookup"). A
// `?number=` the parser accepts fills the number field, so a cold `/orders/<n>` lands here ready.
export default async function OrderTrackPage({
  searchParams,
}: PageProps<"/[locale]/orders/track">) {
  const [t, query] = await Promise.all([getTranslations("OrderLookup"), searchParams]);
  const number = typeof query.number === "string" ? parseOrderNumberInput(query.number) : null;

  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-5 pb-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-title-l">{t("title")}</h1>
        <p className="text-muted">{t("intro")}</p>
      </div>
      <OrderLookupForm initialNumber={number ?? ""} />
    </div>
  );
}
