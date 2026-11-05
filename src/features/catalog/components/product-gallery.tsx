"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ChevronBack, ChevronNext } from "@/components/icons/directional";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Ltr } from "@/components/ltr";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import supabaseImageLoader from "@/image-loader";
import { stepIndex, type GalleryItem } from "../product-view";
import { FullScreenGallery } from "./full-screen-gallery";
import { useStripPosition } from "./use-strip-position";

const POSTER_WIDTH = 828;

const arrow =
  "absolute top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-ink bg-white text-ink";

// The product gallery (spec 0009 AC-10, AC-11; pages/product.md item 2): a swipeable scroll snap
// strip of the photos and then the video, looping arrows, a counter, and thumbnails. Each photo
// opens the full screen view (AC-12). Out of stock: the strip at 45% with the black label (AC-7).
export function ProductGallery({
  items,
  name,
  inStock,
  videoSrc,
}: {
  readonly items: readonly GalleryItem[];
  readonly name: string;
  readonly inStock: boolean;
  readonly videoSrc: string | null;
}) {
  const t = useTranslations("Catalog");
  const { strip, current, goTo, itemRef } = useStripPosition(items.length);
  const video = useRef<HTMLVideoElement>(null);
  const photoButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const [zoomFrom, setZoomFrom] = useState<number | null>(null);
  const photos = items.filter((item) => item.kind === "photo");
  const firstPhoto = photos[0] ?? null;
  const count = items.length;

  // Leaving the video pauses it (AC-11).
  useEffect(() => {
    if (items[current]?.kind !== "video") video.current?.pause();
  }, [current, items]);

  const closeZoom = (lastSeen: number) => {
    setZoomFrom(null);
    goTo(lastSeen, "instant");
  };

  const label = inStock ? null : (
    <span className="absolute start-3 top-3 rounded-chip bg-ink px-2 py-1 type-caption font-extrabold text-white">
      {t("outOfStock")}
    </span>
  );

  if (count === 0) {
    return (
      <div className="relative">
        <ImagePlaceholder
          className={cn("h-(--h-gallery) rounded-card", !inStock && "opacity-45")}
        />
        {label}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="product-gallery">
      <div className="relative">
        <div
          ref={strip}
          className={cn(
            "flex h-(--h-gallery) snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-card bg-product-1",
            !inStock && "opacity-45",
          )}
        >
          {items.map((item, index) => (
            <div
              key={item.key}
              ref={itemRef(index)}
              data-index={index}
              className="relative h-full w-full shrink-0 snap-center"
            >
              {item.kind === "photo" ? (
                <button
                  type="button"
                  ref={(element) => {
                    photoButtons.current[item.n - 1] = element;
                  }}
                  aria-label={t("zoomPhoto", { n: formatNumber(item.n) })}
                  onClick={() => setZoomFrom(item.n - 1)}
                  className="relative block size-full cursor-zoom-in"
                  data-testid="gallery-photo"
                >
                  <Image
                    src={item.key}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 480px) 448px, 100vw"
                    className="object-contain"
                    {...(index === 0 ? { loading: "eager", fetchPriority: "high" } : {})}
                  />
                </button>
              ) : (
                <video
                  ref={video}
                  controls
                  playsInline
                  preload="none"
                  aria-label={t("video")}
                  poster={
                    firstPhoto
                      ? supabaseImageLoader({ src: firstPhoto.key, width: POSTER_WIDTH })
                      : undefined
                  }
                  className="size-full object-contain"
                  data-testid="gallery-video"
                >
                  {videoSrc ? <source src={videoSrc} type="video/mp4" /> : null}
                </video>
              )}
            </div>
          ))}
        </div>
        {label}
        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label={t("previousPhoto")}
              onClick={() => goTo(stepIndex(current, -1, count))}
              className={cn(arrow, "start-2.5")}
            >
              <ChevronBack className="size-5.5" />
            </button>
            <button
              type="button"
              aria-label={t("nextPhoto")}
              onClick={() => goTo(stepIndex(current, 1, count))}
              className={cn(arrow, "end-2.5")}
            >
              <ChevronNext className="size-5.5" />
            </button>
            <span
              className="absolute end-2.5 bottom-2.5 rounded-chip bg-ink px-1.5 py-0.5 type-caption text-white"
              data-testid="gallery-counter"
            >
              <Ltr>{`${formatNumber(current + 1)} / ${formatNumber(count)}`}</Ltr>
            </span>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" data-testid="gallery-thumbnails">
          {items.map((item, index) => {
            const thumb = item.kind === "photo" ? item : firstPhoto;
            return (
              <button
                key={item.key}
                type="button"
                aria-label={
                  item.kind === "photo" ? t("photoLabel", { n: formatNumber(item.n) }) : t("video")
                }
                aria-pressed={index === current}
                onClick={() => goTo(index)}
                className={cn(
                  "relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-btn bg-product-1",
                  index === current ? "border-2 border-yellow" : "border border-control-border",
                )}
              >
                {thumb ? (
                  <Image
                    src={thumb.key}
                    alt=""
                    width={64}
                    height={64}
                    className="size-full object-cover"
                  />
                ) : (
                  <ImagePlaceholder className="size-full" />
                )}
                {item.kind === "video" ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center bg-ink/50 text-white"
                  >
                    <Play className="size-5" fill="currentColor" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {photos.length ? (
        <FullScreenGallery
          name={name}
          photos={photos}
          openAt={zoomFrom}
          onClose={closeZoom}
          returnFocus={(index) => photoButtons.current[index] ?? null}
        />
      ) : null}
    </div>
  );
}
