import { Play, ShoppingCart, Search, Trash2, X, Check, ListFilter } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { ArrowBack, ArrowNext, ChevronBack, ChevronNext } from "@/components/icons/directional";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { LoadingStatus } from "@/components/loading-status";
import { Ltr } from "@/components/ltr";
import { QuantityStepper } from "@/components/quantity-stepper";
import { RadioCard } from "@/components/radio-card";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { formatDateTime, formatNumber, formatPhone } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { GallerySection, Labelled, SampleGroup } from "../gallery-section";
import { AppliedFiltersDemo, ErrorStateDemo } from "./controls-demo";

// Board samples (gallery only): numbers and codes are not words, so they stay here.
const samples = {
  orderNumber: "26-00123",
  phone: "+970599123456",
  code: "CH-2041",
  price: 125_000,
  refund: -5000,
  count: 1250,
  // A fixed instant, so the gallery reads 20/10/2026 · 4:45 م in every browser (spec 0005, AC-16).
  placedAt: new Date("2026-10-20T13:45:00Z"),
} as const;

// The custom controls, icons, and the WhatsApp link (AC-9, AC-10, AC-17).
export async function ControlsSection({ whatsappNumber }: { readonly whatsappNumber: string }) {
  const c = await getTranslations("DesignSystem.controls");

  return (
    <GallerySection id="controls" title={c("title")} text={c("text")}>
      <SampleGroup title={c("chipsGroup")}>
        <ToggleGroup aria-label={c("sizeLabel")} defaultValue={["60"]} className="p-1">
          <Chip value="40">{c("size40")}</Chip>
          <Chip value="60">{c("size60")}</Chip>
          <Chip value="80" disabled>
            {c("size80")}
          </Chip>
        </ToggleGroup>
      </SampleGroup>

      <SampleGroup title={c("appliedGroup")}>
        <AppliedFiltersDemo labels={[c("appliedGold"), c("appliedInStock")]} />
      </SampleGroup>

      <SampleGroup title={c("radioCardsGroup")}>
        <RadioGroup
          aria-label={c("radioCardsGroup")}
          defaultValue="pickup"
          className="max-w-(--page-max) gap-2.5"
        >
          <RadioCard value="pickup" title={c("pickupTitle")} description={c("pickupText")} />
          <RadioCard value="delivery" title={c("deliveryTitle")} description={c("deliveryText")} />
        </RadioGroup>
      </SampleGroup>

      <SampleGroup title={c("stepperGroup")}>
        <div className="flex flex-wrap gap-6">
          <Labelled label={c("stepperCart")}>
            <QuantityStepper defaultValue={1} />
          </Labelled>
          <Labelled label={c("stepperProduct")}>
            <QuantityStepper defaultValue={12} size="product" />
          </Labelled>
        </div>
      </SampleGroup>

      <SampleGroup title={c("emptyGroup")} className="bg-page">
        <EmptyState
          title={c("emptyTitle")}
          text={c("emptyText")}
          actions={<Button size="lg">{c("emptyAction")}</Button>}
        />
      </SampleGroup>

      <SampleGroup title={c("errorGroup")} className="bg-page">
        <ErrorStateDemo title={c("errorTitle")} whatsappNumber={whatsappNumber} />
      </SampleGroup>

      <SampleGroup title={c("loadingGroup")}>
        <LoadingStatus label={c("loadingLabel")} className="grid grid-cols-2 gap-2.5">
          {[1, 2].map((n) => (
            <div key={n} className="flex flex-col gap-2 rounded-card border border-border p-2">
              <Skeleton className="h-(--h-card-image) rounded-btn" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-11 rounded-btn" />
            </div>
          ))}
        </LoadingStatus>
      </SampleGroup>

      <SampleGroup title={c("placeholderGroup")}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {([1, 2, 3, 4] as const).map((tone) => (
            <Labelled key={tone} label={c("placeholderTone", { tone })} className="items-stretch">
              <ImagePlaceholder tone={tone} className="h-(--h-card-image) rounded-card" />
            </Labelled>
          ))}
        </div>
      </SampleGroup>

      <SampleGroup title={c("iconsGroup")}>
        <div className="flex flex-col gap-3">
          <Labelled label={c("iconsFlip")}>
            <span className="flex gap-3" data-testid="icons-flip">
              <ChevronNext className="size-6" />
              <ChevronBack className="size-6" />
              <ArrowNext className="size-6" />
              <ArrowBack className="size-6" />
            </span>
          </Labelled>
          <Labelled label={c("iconsFixed")}>
            <span className="flex gap-3" aria-hidden>
              <ShoppingCart className="size-6" />
              <Search className="size-6" />
              <WhatsAppIcon className="size-6" />
              <Trash2 className="size-6" />
              <Check className="size-6" />
              <X className="size-6" />
              <ListFilter className="size-6" />
              <Play className="size-6" />
            </span>
          </Labelled>
        </div>
      </SampleGroup>

      <SampleGroup title={c("ltrGroup")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" data-testid="formats-sample">
          <dt className="text-muted">{c("price")}</dt>
          <dd className="font-bold">
            <Ltr>{formatPrice(samples.price)}</Ltr>
          </dd>
          <dt className="text-muted">{c("refund")}</dt>
          <dd className="font-bold">
            <Ltr>{formatPrice(samples.refund)}</Ltr>
          </dd>
          <dt className="text-muted">{c("count")}</dt>
          <dd className="font-bold">{formatNumber(samples.count)}</dd>
          <dt className="text-muted">{c("placedAt")}</dt>
          <dd className="font-bold">
            <time dateTime={samples.placedAt.toISOString()}>
              {formatDateTime(samples.placedAt)}
            </time>
          </dd>
          <dt className="text-muted">{c("orderNumber")}</dt>
          <dd className="font-bold">
            <Ltr>{samples.orderNumber}</Ltr>
          </dd>
          <dt className="text-muted">{c("phone")}</dt>
          <dd className="font-bold">
            <Ltr>{formatPhone(samples.phone)}</Ltr>
          </dd>
          <dt className="text-muted">{c("code")}</dt>
          <dd className="font-bold">
            <Ltr>{samples.code}</Ltr>
          </dd>
        </dl>
      </SampleGroup>
    </GallerySection>
  );
}
