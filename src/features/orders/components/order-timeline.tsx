import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CustomerTimeline, TimelineStep } from "../customer-timeline";
import type { Fulfilment } from "../status";

/** The `OrderPage.steps` key of a step: `ready` reads by fulfilment (spec 0015 AC-9). */
export function stepKey(step: TimelineStep["status"], fulfilment: Fulfilment) {
  if (step !== "ready") return step;
  return fulfilment === "pickup" ? "readyPickup" : "readyDelivery";
}

const CIRCLE = {
  done: "border-ink bg-ink text-white",
  current: "border-2 border-ink bg-yellow text-ink",
  upcoming: "border-2 border-control-border bg-white",
} as const;

// The "حالة الطلب" card (spec 0015 AC-9; design.md section 6, Timeline): an ordered list of the
// order's path, or one line for a cancelled order: who cancelled it and when (spec 0016 AC-7), or
// "تم إلغاء هذا الطلب" when no time is recorded. The connector runs from 4px under a circle to
// 4px above the next one, so it never crosses a circle.
export function OrderTimeline({
  timeline,
  fulfilment,
  cancelled = null,
}: {
  readonly timeline: CustomerTimeline;
  readonly fulfilment: Fulfilment;
  readonly cancelled?: { readonly line: "byYou" | "byShop"; readonly at: Date } | null;
}) {
  const t = useTranslations("OrderPage");

  return (
    <Card data-testid="order-timeline">
      <h2 className="type-lead">{t("statusTitle")}</h2>
      {timeline.kind === "cancelled" ? (
        <p className="font-bold" data-testid="timeline-cancelled">
          {cancelled
            ? t.rich(cancelled.line === "byYou" ? "cancelledByYou" : "cancelledByShop", {
                date: formatDateTime(cancelled.at),
                time: (chunks) => <time dateTime={cancelled.at.toISOString()}>{chunks}</time>,
              })
            : t("cancelledNotice")}
        </p>
      ) : (
        <ol className="flex flex-col">
          {timeline.steps.map((step, index) => {
            const last = index === timeline.steps.length - 1;
            return (
              <li
                key={step.status}
                className="relative flex min-h-14 items-start gap-3"
                aria-current={step.state === "current" ? "step" : undefined}
                data-state={step.state}
                data-testid="timeline-step"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border",
                    CIRCLE[step.state],
                  )}
                >
                  {step.state === "done" ? <Check className="size-4" strokeWidth={3} /> : null}
                </span>
                {last ? null : (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute start-3.25 top-8 bottom-1 w-0.5",
                      step.state === "done" ? "bg-ink" : "bg-border",
                    )}
                  />
                )}
                <span className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className={step.state === "upcoming" ? "text-muted" : "font-bold"}>
                    {t(`steps.${stepKey(step.status, fulfilment)}`)}
                  </span>
                  {step.state === "current" ? <Badge variant="new">{t("current")}</Badge> : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
