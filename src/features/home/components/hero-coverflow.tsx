"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { ChevronBack, ChevronNext } from "@/components/icons/directional";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Ltr } from "@/components/ltr";
import { Button, ButtonLink } from "@/components/ui/button";
import type { CardProduct } from "@/features/catalog/card-view";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  changesSide,
  circleSteps,
  COVERFLOW_SWIPE,
  coverflowPlacement,
  stepForKey,
  swipeStep,
  type CoverflowPlacement,
  type CoverflowVisible,
  type Dir,
} from "../home-rules";
import { tokenEasing, tokenMs, useReducedMotion } from "../motion";
import { SectionJump } from "./section-jump";

// The centre card's width at each breakpoint (spec 0030 AC-13), the largest picture above the fold.
const SIZES = "(min-width: 1024px) 300px, (min-width: 768px) 260px, 220px";
const tones = [1, 2, 3, 4] as const;
// From lg two neighbours show on each side (AC-4); read once per step for the crossing fade.
const lgQuery = "(width >= 64rem)";

/** The physical direction of the inline end, from the element's computed direction. */
const dirOf = (element: Element): Dir => (getComputedStyle(element).direction === "rtl" ? -1 : 1);

/** A placement as the custom properties one breakpoint set reads (`--cf-*` or `--cf-lg-*`). */
function placementVars(prefix: string, placed: CoverflowPlacement) {
  return {
    [`${prefix}-x`]: placed.x,
    [`${prefix}-r`]: placed.angle,
    [`${prefix}-s`]: placed.scale,
    [`${prefix}-o`]: placed.opacity,
    [`${prefix}-t`]: placed.tint,
    [`${prefix}-z`]: placed.z,
    [`${prefix}-v`]: placed.hidden ? "hidden" : "visible",
    [`${prefix}-pe`]: placed.hidden ? "none" : "auto",
  };
}

/** A placement in px for the Web Animations API, where custom properties are not reliable. */
function placedPx(placed: CoverflowPlacement, cardPx: number) {
  return {
    transform: `translateX(${placed.x * cardPx}px) rotateY(${placed.angle}deg) scale(${placed.scale})`,
    opacity: placed.opacity,
  };
}

// The words under the centre card always reserve two name lines and one price line (AC-5), so the
// dots and the buttons never move between a short and a long name.
const NAME_LINES = "min-h-[calc(2_*_var(--fs-lead)_*_var(--lh-compact))]";
const PRICE_LINE = "min-h-[calc(var(--fs-lead)_*_var(--lh-compact))]";

// Every card is placed for both widths by the custom properties on it (AC-7): the `--cf-*` set
// below lg, the `--cf-lg-*` set from lg, picked here by the `lg:` variants, so the server markup
// is right at every width. `--cf-dir` (1, or -1 in right to left) turns the inline move into a
// physical one. Depth comes from the transform, the opacity, and the tint only: no shadow.
const CARD = cn(
  "absolute start-[calc(50%_-_var(--coverflow-card)_/_2)] top-0 w-(--coverflow-card) origin-[50%_calc(var(--coverflow-card)_*_0.625)]",
  "[--o:var(--cf-o)] [--pe:var(--cf-pe)] [--r:var(--cf-r)] [--s:var(--cf-s)] [--t:var(--cf-t)] [--v:var(--cf-v)] [--x:var(--cf-x)] [--z:var(--cf-z)]",
  "lg:[--o:var(--cf-lg-o)] lg:[--pe:var(--cf-lg-pe)] lg:[--r:var(--cf-lg-r)] lg:[--s:var(--cf-lg-s)] lg:[--t:var(--cf-lg-t)] lg:[--v:var(--cf-lg-v)] lg:[--x:var(--cf-lg-x)] lg:[--z:var(--cf-lg-z)]",
  "[pointer-events:var(--pe)] [visibility:var(--v)] z-(--z) transform-[translateX(calc(var(--coverflow-card)_*_var(--x)_*_var(--cf-dir)))_rotateY(calc(var(--r)_*_var(--cf-dir)_*_1deg))_scale(var(--s))] opacity-(--o)",
  "transition-[transform,opacity,visibility] duration-(--dur-carousel-move) ease-(--ease-carousel) motion-reduce:transition-none",
);

function Picture({
  product,
  index,
  crossing,
}: {
  readonly product: CardProduct;
  readonly index: number;
  readonly crossing: boolean;
}) {
  const t = useTranslations("Catalog");
  return (
    <div className="relative aspect-4/5 overflow-hidden rounded-card bg-product-1">
      {product.imageKey ? (
        <Image
          src={product.imageKey}
          alt=""
          fill
          sizes={SIZES}
          loading={index === 0 ? "eager" : "lazy"}
          fetchPriority={index === 0 ? "high" : undefined}
          draggable={false}
          className={cn("object-contain", !product.inStock && "opacity-45")}
        />
      ) : (
        <ImagePlaceholder
          tone={tones[index % tones.length]}
          className={cn("absolute inset-0", !product.inStock && "opacity-45")}
        />
      )}
      {/* The depth tint (AC-4; white since spec 0032 AC-7): white over the picture, as deep as the card's place says. On a
          crossing step it jumps with its card instead of sliding. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-white opacity-(--t) transition-opacity duration-(--dur-carousel-move) ease-(--ease-carousel) motion-reduce:transition-none"
        style={crossing ? { transition: "none" } : undefined}
      />
      {!product.inStock ? (
        <span className="absolute start-2 top-2 rounded-chip bg-ink px-2 py-1 type-caption font-extrabold text-white">
          {t("outOfStock")}
        </span>
      ) : null}
    </div>
  );
}

/** The centre card's name and price (AC-5; spec 0008 AC-12 price rules). */
function Words({ product }: { readonly product: CardProduct }) {
  const t = useTranslations("Catalog");
  const price =
    product.listPrice === null ? null : product.pricesDiffer ? (
      t.rich("from", {
        price: formatPrice(product.listPrice),
        ltr: (chunks) => <Ltr>{chunks}</Ltr>,
      })
    ) : (
      <Ltr>{formatPrice(product.listPrice)}</Ltr>
    );
  return (
    <span className="mt-2.5 block">
      <span className={cn("line-clamp-2 type-lead text-ink", NAME_LINES)}>{product.name}</span>
      <span
        className={cn("block type-lead", PRICE_LINE, product.inStock ? "text-ink" : "text-muted")}
        data-testid="hero-price"
      >
        {price}
      </span>
    </span>
  );
}

/**
 * The Home hero (spec 0030): the headline, then a coverflow of the featured products, the dots, and
 * the two buttons, on the white hero surface (spec 0032 AC-5). Below md a rounded card with a 1px border and the
 * page's side margins; from md a white band across the screen, edged at the bottom, with its content in the centred content box. The coverflow
 * moves one product per step, by a swipe, a tap on a side card, the arrows (from lg), the arrow
 * keys, or a dot; it loops and never moves by itself. One product shows alone with no controls.
 */
export function HeroCoverflow({
  products,
  whatsappNumber,
  jumpTo,
}: {
  readonly products: readonly CardProduct[];
  readonly whatsappNumber: string;
  readonly jumpTo: "categories" | null;
}) {
  const t = useTranslations("Home");
  const shell = useTranslations("Shell");
  const count = products.length;
  // One product shows alone: no arrows, dots, live text, or swipe (AC-9).
  const moves = count > 1;
  const reduced = useReducedMotion();
  // `from` is the centre before the last step, so a render knows which cards cross (AC-7).
  const [at, setAt] = useState({ centre: 0, from: 0 });
  const { centre, from } = at;
  const listRef = useRef<HTMLUListElement>(null);
  const swipeFrom = useRef<{ readonly x: number; readonly y: number } | null>(null);
  const swiped = useRef(false);
  const refocus = useRef(false);

  const step = (by: number) => {
    if (!moves || by === 0) return;
    // Focus on the centre link follows the new centre after the step (AC-5).
    const list = listRef.current;
    refocus.current = !!list && list.contains(document.activeElement);
    setAt((now) => ({ centre: (now.centre + by + count) % count, from: now.centre }));
  };

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || from === centre) return;
    if (refocus.current) {
      refocus.current = false;
      list.querySelector("a")?.focus({ preventScroll: true });
    }
    if (reduced) return;
    // The crossing cards already sit on their new side with no transition; play the fade, with
    // the card width in px because custom properties inside keyframes are not reliable everywhere.
    const dir = dirOf(list);
    const visible: CoverflowVisible = window.matchMedia(lgQuery).matches ? 2 : 1;
    const cardPx = parseFloat(getComputedStyle(list).getPropertyValue("--coverflow-card"));
    if (!cardPx) return;
    Array.from(list.children).forEach((item, index) => {
      const before = circleSteps(index, from, count);
      const after = circleSteps(index, centre, count);
      if (!changesSide(before, after)) return;
      item.getAnimations().forEach((animation) => animation.cancel());
      const out = placedPx(coverflowPlacement(before, visible, dir), cardPx);
      const back = placedPx(coverflowPlacement(after, visible, dir), cardPx);
      item.animate(
        [
          { ...out, visibility: "visible" },
          { ...out, opacity: 0, visibility: "visible", offset: 0.5 },
          { ...back, opacity: 0, offset: 0.5 },
          back,
        ],
        { duration: tokenMs(item, "--dur-carousel-move"), easing: tokenEasing(item) },
      );
    });
  }, [centre, from, count, reduced]);

  const startSwipe = (event: PointerEvent<HTMLDivElement>) => {
    swiped.current = false;
    swipeFrom.current = { x: event.clientX, y: event.clientY };
  };
  const endSwipe = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeFrom.current;
    swipeFrom.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // A drag is not a tap: the click that follows is cancelled, so a drag that starts on the
    // centre link never opens it and one that starts on a side card never steps twice (AC-6).
    if (Math.abs(dx) >= COVERFLOW_SWIPE.tap) swiped.current = true;
    step(swipeStep(dx, dy, dirOf(event.currentTarget)));
  };
  const cancelSwipe = () => {
    swipeFrom.current = null;
  };
  const guardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!swiped.current) return;
    swiped.current = false;
    event.preventDefault();
    event.stopPropagation();
  };
  // With focus anywhere inside the hero, the arrow keys name a side of the screen (AC-6).
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const by = stepForKey(event, dirOf(event.currentTarget));
    if (by === null) return;
    event.preventDefault();
    step(by);
  };

  const total = formatNumber(count);
  // The arrows (AC-6): from lg, at the content box's edges, level with the middle of the image.
  const arrow =
    "absolute top-[calc(var(--coverflow-card)_*_0.625)] z-20 hidden -translate-y-1/2 rounded-full border-control-border bg-white text-ink hover:bg-page lg:inline-flex";

  return (
    <section
      aria-labelledby="hero-title"
      data-testid="home-hero"
      onKeyDown={moves ? onKeyDown : undefined}
      className="relative mx-(--page-pad) mt-3.5 overflow-hidden rounded-hero border border-border bg-white text-ink md:mx-0 md:mt-0 md:rounded-none md:border-x-0 md:border-t-0"
    >
      <div className="mx-auto flex w-full max-w-(--content-max) flex-col items-start px-5 pt-6.5 pb-5 md:px-(--page-pad) md:pt-8 md:pb-6 lg:items-center lg:pt-10 lg:pb-8 lg:text-center">
        <h1 id="hero-title" className="flex flex-col type-hero">
          <span>{t("heroLine1")}</span>
          <span className="w-fit rounded-btn bg-brand px-3 lg:self-center">{t("heroLine2")}</span>
        </h1>
        <p className="mt-2.5 type-body text-muted">{t("heroText")}</p>

        <div
          role="region"
          aria-roledescription="carousel"
          aria-label={t("coverflowLabel")}
          className="relative mt-5 w-full select-none"
          onPointerDown={moves ? startSwipe : undefined}
          onPointerUp={moves ? endSwipe : undefined}
          onPointerCancel={moves ? cancelSwipe : undefined}
          onClickCapture={moves ? guardClick : undefined}
        >
          {moves ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(arrow, "start-0")}
                aria-label={t("productPrev")}
                onClick={() => step(-1)}
              >
                <ChevronBack className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(arrow, "end-0")}
                aria-label={t("productNext")}
                onClick={() => step(1)}
              >
                <ChevronNext className="size-5" />
              </Button>
            </>
          ) : null}
          {/* An invisible centre card gives the box its height, so the hero never resizes while
              the cards move. */}
          <div aria-hidden className="invisible mx-auto w-(--coverflow-card)">
            <div className="aspect-4/5" />
            <div className={cn("mt-2.5", NAME_LINES)} />
            <div className={PRICE_LINE} />
          </div>
          <ul
            ref={listRef}
            data-testid="home-products"
            className="absolute inset-0 touch-pan-y [--cf-dir:1] perspective-(--coverflow-depth) rtl:[--cf-dir:-1]"
          >
            {products.map((product, index) => {
              const steps = circleSteps(index, centre, count);
              const centred = steps === 0;
              const crossing = changesSide(circleSteps(index, from, count), steps);
              const style = {
                ...placementVars("--cf", coverflowPlacement(steps, 1, 1)),
                ...placementVars("--cf-lg", coverflowPlacement(steps, 2, 1)),
                // It jumps to its new side and the fade plays instead of a slide (AC-7).
                ...(crossing && { transition: "none" }),
              } as CSSProperties;
              const label = t("slideLabel", { n: formatNumber(index + 1), count: total });
              return (
                <li
                  key={product.slug}
                  aria-hidden={centred ? undefined : true}
                  style={style}
                  className={CARD}
                >
                  {centred ? (
                    <div role="group" aria-roledescription="slide" aria-label={label}>
                      <Link
                        href={routes.product(product.slug)}
                        draggable={false}
                        className="block rounded-card"
                      >
                        <Picture product={product} index={index} crossing={crossing} />
                        <Words product={product} />
                      </Link>
                    </div>
                  ) : (
                    // A side slide shows the picture only; a tap brings it to the centre (AC-5, AC-6).
                    <div
                      role="group"
                      aria-roledescription="slide"
                      aria-label={label}
                      onClick={() => step(steps)}
                      className="cursor-pointer"
                    >
                      <Picture product={product} index={index} crossing={crossing} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {moves ? (
          <>
            {/* The dots (AC-8): one per product, named for it; a tap goes the shortest way round. */}
            <ul className="mt-3.5 flex items-center self-center" data-testid="hero-dots">
              {products.map((product, index) => (
                <li key={product.slug}>
                  <button
                    type="button"
                    className="flex size-11 cursor-pointer items-center justify-center rounded-btn"
                    aria-label={t("productDot", {
                      n: formatNumber(index + 1),
                      count: total,
                      name: product.name,
                    })}
                    aria-current={index === centre ? "true" : undefined}
                    onClick={() => step(circleSteps(index, centre, count))}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-2.5 rounded-full border transition-colors duration-(--dur-hover)",
                        index === centre ? "border-ink bg-brand" : "border-control-border",
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
            <p className="sr-only" aria-live="polite">
              {t("centredProduct", { name: products[centre].name })}
            </p>
          </>
        ) : null}

        {/* Side by side; on a phone too narrow for both (below 360) the second wraps under the first. */}
        <div className="mt-5 flex w-full gap-2.5 md:w-(--form-max) md:max-w-full narrow:flex-wrap">
          {jumpTo ? (
            <SectionJump section={jumpTo} className="flex-1">
              {t("shopNow")}
            </SectionJump>
          ) : null}
          <ButtonLink
            variant="whatsapp"
            size="lg"
            href={whatsappUrl(whatsappNumber, shell("whatsappMessages.consult"))}
            target="_blank"
            rel="noopener"
            className="flex-[1.25]"
          >
            <WhatsAppIcon />
            {t("heroWhatsapp")}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
