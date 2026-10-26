"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronBack, ChevronNext } from "@/components/icons/directional";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HomeBanner } from "../server/home";

const SIZES = "(max-width: 480px) 100vw, 480px";

function BannerPicture({
  banner,
  first,
}: {
  readonly banner: HomeBanner;
  readonly first: boolean;
}) {
  const picture = (
    <Image
      src={banner.imageKey}
      alt={banner.alt}
      fill
      sizes={SIZES}
      loading={first ? "eager" : "lazy"}
      fetchPriority={first ? "high" : undefined}
      className="object-cover"
    />
  );
  const frame = "relative block aspect-video overflow-hidden rounded-card bg-fill-muted";
  // A banner with no live target is a plain picture; a live one is a link named by its picture.
  return banner.href ? (
    <Link href={banner.href} className={frame} data-testid="banner-link">
      {picture}
    </Link>
  ) : (
    <div className={frame}>{picture}</div>
  );
}

/** Which slide is in view: the scroll offset over one slide width (negative in right to left). */
const slideAt = (track: HTMLElement) =>
  track.clientWidth ? Math.round(Math.abs(track.scrollLeft) / track.clientWidth) : 0;

// The owner's banners on Home (spec 0011 AC-2). One banner shows alone. Two to five form a swipe
// carousel on CSS scroll snap: one per view, a previous and next pair that stops at either end,
// and one dot per banner. It never moves by itself. Slides out of view are inert, so the keyboard
// reaches only the shown banner's link.
export function BannerCarousel({ banners }: { readonly banners: readonly HomeBanner[] }) {
  const t = useTranslations("Home");
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const count = banners.length;

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => setCurrent(slideAt(element));
    element.addEventListener("scroll", update, { passive: true });
    return () => element.removeEventListener("scroll", update);
  }, []);

  if (count === 1) {
    return (
      <div className="px-(--page-pad)" data-testid="home-banners">
        <BannerPicture banner={banners[0]} first />
      </div>
    );
  }

  const go = (index: number) => {
    const element = track.current;
    if (!element) return;
    const to = Math.min(count - 1, Math.max(0, index));
    const rtl = getComputedStyle(element).direction === "rtl";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({
      left: (rtl ? -1 : 1) * to * element.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
    setCurrent(to);
  };

  const n = (i: number) => formatNumber(i + 1);
  const total = formatNumber(count);
  const arrow = (label: string, to: number, disabled: boolean, icon: ReactNode) => (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full"
      aria-label={label}
      disabled={disabled}
      focusableWhenDisabled
      onClick={() => go(to)}
    >
      {icon}
    </Button>
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("bannersLabel")}
      className="flex flex-col gap-2 px-(--page-pad)"
      data-testid="home-banners"
    >
      <div
        ref={track}
        className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain rounded-card"
      >
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            role="group"
            aria-roledescription="slide"
            aria-label={t("slideLabel", { n: n(index), count: total })}
            inert={index !== current}
            className="w-full shrink-0 snap-center"
          >
            <BannerPicture banner={banner} first={index === 0} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        {arrow(t("bannerPrev"), current - 1, current === 0, <ChevronBack className="size-5" />)}
        <ul className="flex items-center">
          {banners.map((banner, index) => (
            <li key={banner.id}>
              <button
                type="button"
                className="flex size-11 cursor-pointer items-center justify-center"
                aria-label={t("bannerDot", { n: n(index), count: total })}
                aria-current={index === current ? "true" : undefined}
                onClick={() => go(index)}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 rounded-full border border-ink",
                    index === current ? "bg-ink" : "bg-white",
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
        {arrow(
          t("bannerNext"),
          current + 1,
          current === count - 1,
          <ChevronNext className="size-5" />,
        )}
      </div>
    </section>
  );
}
