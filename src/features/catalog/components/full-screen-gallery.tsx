"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef } from "react";
import { ChevronBack, ChevronNext } from "@/components/icons/directional";
import { Ltr } from "@/components/ltr";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stepIndex, type GalleryItem } from "../product-view";
import { useStripPosition } from "./use-strip-position";

type Photo = Extract<GalleryItem, { kind: "photo" }>;

const control =
  "absolute flex size-11 cursor-pointer items-center justify-center rounded-full border border-ink bg-white text-ink";

// The full screen view (spec 0009 AC-12): the photos only, on black, at full width so the large
// source is used, with the browser's own pinch zoom. Esc and ✕ close it; focus stays inside and
// then returns to the photo button of the photo last seen, which the main strip then shows.
export function FullScreenGallery({
  name,
  photos,
  openAt,
  onClose,
  returnFocus,
}: {
  readonly name: string;
  readonly photos: readonly Photo[];
  /** The photo index pressed, or null while closed. */
  readonly openAt: number | null;
  readonly onClose: (lastSeen: number) => void;
  readonly returnFocus: (index: number) => HTMLElement | null;
}) {
  const t = useTranslations("Catalog");
  const lastSeen = useRef(openAt ?? 0);

  return (
    <DialogPrimitive.Root
      open={openAt !== null}
      onOpenChange={(open) => {
        if (!open) onClose(lastSeen.current);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          finalFocus={() => returnFocus(lastSeen.current)}
          className="fixed inset-0 z-(--z-sheet) flex flex-col bg-ink text-white"
          data-testid="full-screen-gallery"
        >
          <DialogPrimitive.Title className="sr-only">
            {t("galleryTitle", { name })}
          </DialogPrimitive.Title>
          {openAt !== null ? (
            <FullScreenStrip
              photos={photos}
              start={openAt}
              onSeen={(index) => {
                lastSeen.current = index;
              }}
            />
          ) : null}
          <DialogPrimitive.Close aria-label={t("close")} className={cn(control, "end-3 top-3")}>
            <X aria-hidden className="size-5.5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function FullScreenStrip({
  photos,
  start,
  onSeen,
}: {
  readonly photos: readonly Photo[];
  readonly start: number;
  readonly onSeen: (index: number) => void;
}) {
  const t = useTranslations("Catalog");
  const { strip, current, goTo, itemRef } = useStripPosition(photos.length, start);
  const count = photos.length;
  const shown = count > 1 ? current : 0;

  // Scrolled to the pressed photo before the first paint, so it opens on it (AC-12).
  useLayoutEffect(() => {
    goTo(start, "instant");
    // Only on open: `start` is fixed while the view is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    onSeen(shown);
  });

  return (
    <div className="relative flex-1">
      <div
        ref={strip}
        className="flex h-full touch-pan-x touch-pinch-zoom snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        {photos.map((photo, index) => (
          <div
            key={photo.key}
            ref={itemRef(index)}
            data-index={index}
            className="relative h-full w-full shrink-0 snap-center"
          >
            <Image src={photo.key} alt={photo.alt} fill sizes="100vw" className="object-contain" />
          </div>
        ))}
      </div>
      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label={t("previousPhoto")}
            onClick={() => goTo(stepIndex(current, -1, count))}
            className={cn(control, "start-3 top-1/2 -translate-y-1/2")}
          >
            <ChevronBack className="size-5.5" />
          </button>
          <button
            type="button"
            aria-label={t("nextPhoto")}
            onClick={() => goTo(stepIndex(current, 1, count))}
            className={cn(control, "end-3 top-1/2 -translate-y-1/2")}
          >
            <ChevronNext className="size-5.5" />
          </button>
          <div className="absolute start-0 end-0 bottom-4 flex justify-center">
            <span
              className="rounded-chip bg-white px-1.5 py-0.5 type-caption text-ink"
              data-testid="full-screen-counter"
            >
              <Ltr>{`${formatNumber(shown + 1)} / ${formatNumber(count)}`}</Ltr>
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
