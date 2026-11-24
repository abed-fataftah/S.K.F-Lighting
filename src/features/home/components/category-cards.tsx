"use client";

import * as Sentry from "@sentry/nextjs";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { coverLoader } from "@/image-loader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CardProduct } from "@/features/catalog/card-view";
import { ProductCard } from "@/features/catalog/components/product-card";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  categoryCacheReducer,
  categoryPanelState,
  categoryTurn,
  firstCategory,
  HOME_LIMITS,
  indexForKey,
  needsFetch,
  seedCategoryCache,
  type CategoryCache,
  type Dir,
  type HomeCategory,
} from "../home-rules";
import { useReducedMotion } from "../motion";

// Home's category cards (spec 0031): a row of 3D photo cards that work as tabs, and under them the
// selected category's first eight products. The first category's eight come with the page; the
// others are fetched on press (or ahead of it, on a mouse hover or a focus) and kept for the
// component's lifetime. Nothing moves by itself.

// The card width at each breakpoint (AC-2), as `--category-card` sets it.
const SIZES = "(min-width: 1024px) 200px, (min-width: 768px) 180px, 140px";
// The card is 4:5 over the category's 1:1 upload crop (spec 0011), so Supabase cuts the photo to
// the card's shape at each width and the browser never enlarges it (scope feature 44).
const cardPhoto = coverLoader(4 / 5);
const tones = [1, 2, 3, 4] as const;
/** A key driven fetch waits this long after the last key, so holding an arrow never fires one
 * request per card (AC-3). */
const KEY_WAIT_MS = 150;
const PANEL_ID = "category-panel";
// From md the cards wrap into rows (AC-4).
const mdQuery = "(width >= 48rem)";
// The hover tilt runs only where a pointer can hover and motion is welcome (AC-5).
const hoverQuery = "(hover: hover)";

const tabId = (slug: string) => `category-tab-${slug}`;
const dirOf = (element: Element): Dir => (getComputedStyle(element).direction === "rtl" ? -1 : 1);
const clampUnit = (value: number) => Math.max(-1, Math.min(1, value));
const isHoverPointer = (event: PointerEvent) =>
  event.pointerType === "mouse" || event.pointerType === "pen";

/** One category's eight from the route; throws on any answer but a 200 with a products list. */
async function fetchCategoryProducts(slug: string): Promise<readonly CardProduct[]> {
  const response = await fetch(routes.api.homeCategoryProducts(slug));
  // The message names the status only, never the category (AC-8).
  if (!response.ok) throw new Error(`home_category_products_${response.status}`);
  const body: unknown = await response.json();
  const list = body && typeof body === "object" ? (body as { products?: unknown }).products : null;
  if (!Array.isArray(list)) throw new Error("home_category_products_malformed");
  return list as readonly CardProduct[];
}

// Each card's transform (AC-5): its own vanishing point, the rest turn toward the selected card
// (`--turn`, set per card, times `--cf-dir` so it is physical in both directions), plus the hover
// tilt (`--tilt-x`, `--tilt-y`, physical, written by the pointer handler), then the scale. Depth
// comes from the transform, the scale, and the tint only: no shadow, no blur, no gradient.
const CARD = cn(
  "group/tab relative block aspect-4/5 w-(--category-card) shrink-0 cursor-pointer snap-start overflow-hidden rounded-card border-2 border-transparent bg-product-1 text-start select-none aria-selected:border-brand",
  "[--sc:1] [--tilt-x:0] [--tilt-y:0] aria-selected:[--sc:var(--category-scale)]",
  "transform-[perspective(var(--coverflow-depth))_rotateY(calc(var(--turn)_*_var(--cf-dir)_*_var(--category-turn)_+_var(--tilt-y)_*_var(--category-tilt)))_rotateX(calc(var(--tilt-x)_*_var(--category-tilt)))_scale(var(--sc))]",
  "transition-[transform,border-color] duration-(--dur-carousel-move) ease-(--ease-carousel) data-tilt:duration-(--dur-hover) motion-reduce:transition-none",
);

function CategoryCard({
  category,
  index,
  selected,
  turn,
  onSelect,
  onFocus,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  tabRef,
}: {
  readonly category: HomeCategory;
  readonly index: number;
  readonly selected: boolean;
  readonly turn: number;
  readonly onSelect: () => void;
  readonly onFocus: () => void;
  readonly onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  readonly onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => void;
  readonly tabRef: (element: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={tabRef}
      type="button"
      role="tab"
      id={tabId(category.slug)}
      aria-selected={selected}
      aria-controls={PANEL_ID}
      tabIndex={selected ? 0 : -1}
      data-testid="home-category-card"
      style={{ "--turn": turn } as CSSProperties}
      className={CARD}
      onClick={onSelect}
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {category.imageKey ? (
        <Image
          src={category.imageKey}
          alt=""
          fill
          sizes={SIZES}
          loader={cardPhoto}
          draggable={false}
          className="object-cover"
        />
      ) : (
        <ImagePlaceholder tone={tones[index % tones.length]} className="absolute inset-0" />
      )}
      {/* The name band (AC-2): black, no gradient; the name in two lines at most, the line in one. */}
      <span className="absolute start-0 end-0 bottom-0 flex flex-col gap-0.5 bg-ink px-2.5 py-2">
        <span className="line-clamp-2 type-lead text-white">{category.name}</span>
        {category.line ? (
          <span className="truncate type-caption text-on-dark-muted">{category.line}</span>
        ) : null}
      </span>
      {/* The tint (AC-5): black over an unselected card, gone on the selected one and on hover. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-ink opacity-(--category-tint) transition-opacity duration-(--dur-carousel-move) ease-(--ease-carousel) group-hover/tab:opacity-0 group-aria-selected/tab:opacity-0 motion-reduce:transition-none"
      />
    </button>
  );
}

/** The grid's place holder while a category loads (AC-7): eight blocks in the card's shape. */
function GridSkeleton() {
  return (
    <ul
      aria-hidden
      data-testid="home-category-skeleton"
      className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      {Array.from({ length: HOME_LIMITS.categoryProducts }, (_, i) => (
        <li key={i} className="flex flex-col gap-2 rounded-card border border-border bg-white">
          <Skeleton className="h-(--h-card-image) rounded-none" />
          <div className="flex flex-col gap-2 px-3 pb-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-11 rounded-btn" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CategoryCards({
  categories,
  first,
  whatsappNumber,
  siteUrl,
  canAddToDraft,
}: {
  readonly categories: readonly HomeCategory[];
  /** The first category's eight, read with the page; null when that read failed. */
  readonly first: readonly CardProduct[] | null;
  readonly whatsappNumber: string;
  readonly siteUrl: string;
  /** Electricians get "add to draft" on each card (spec 0021 AC-1). */
  readonly canAddToDraft: boolean;
}) {
  const t = useTranslations("Home");
  const count = categories.length;
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState(0);
  // Component state, never module scope, which server requests would share (AC-7).
  const [cache, dispatch] = useReducer(categoryCacheReducer, null, () =>
    seedCategoryCache(firstCategory(categories), first),
  );
  // Cards per visual row: the whole list below md (one scrolling row, as the server renders it),
  // else the number that fit, measured on every resize (AC-5).
  const [perRow, setPerRow] = useState(count);

  const rowRef = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const cacheRef = useRef<CategoryCache>(cache);
  const inFlight = useRef(new Set<string>());
  const keyTimer = useRef<number | undefined>(undefined);
  const movedByKey = useRef(false);
  const revealSelected = useRef(false);
  const tiltFrame = useRef(0);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  /** Fetches a category once: an in flight request is shared, a cached answer sends nothing. */
  const load = useCallback((slug: string) => {
    if (inFlight.current.has(slug) || !needsFetch(cacheRef.current.get(slug))) return;
    inFlight.current.add(slug);
    dispatch({ type: "start", slug });
    fetchCategoryProducts(slug)
      .then(
        (products) => dispatch({ type: "done", slug, products }),
        (error: unknown) => {
          Sentry.captureException(error);
          dispatch({ type: "fail", slug });
        },
      )
      .finally(() => inFlight.current.delete(slug));
  }, []);

  // After the first grid paints, the two cards beside the selected one load in the background.
  useEffect(() => {
    if (count < 2) return;
    const timer = window.setTimeout(() => {
      for (const at of new Set([1 % count, count - 1])) {
        if (at !== 0) load(categories[at].slug);
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // Once per mount: the categories come with the page and never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => window.clearTimeout(keyTimer.current), []);

  // The visual rows from md, measured from where the cards sit (transforms never move offsetTop).
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      if (!window.matchMedia(mdQuery).matches) return setPerRow(count);
      const cards = Array.from(row.children) as HTMLElement[];
      const top = cards[0]?.offsetTop ?? 0;
      setPerRow(Math.max(1, cards.filter((card) => card.offsetTop === top).length));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [count]);

  // A selection made by the visitor scrolls its card into the phone row's view (AC-4).
  useEffect(() => {
    if (!revealSelected.current) return;
    revealSelected.current = false;
    const row = rowRef.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    tabs.current[selected]?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [selected, reduced]);

  const select = (index: number, via: "press" | "key") => {
    const slug = categories[index].slug;
    revealSelected.current = true;
    setSelected(index);
    window.clearTimeout(keyTimer.current);
    if (via === "press") load(slug);
    else keyTimer.current = window.setTimeout(() => load(slug), KEY_WAIT_MS);
  };

  // Arrow keys name a side of the screen; Home and End the ends; selection follows focus (AC-3).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const next = indexForKey(event.key, selected, count, dirOf(event.currentTarget));
    if (next === null) return;
    event.preventDefault();
    // The focus that follows is the key's own, so it waits with the key instead of prefetching.
    movedByKey.current = true;
    tabs.current[next]?.focus({ preventScroll: true });
    movedByKey.current = false;
    select(next, "key");
  };

  const tilt = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isHoverPointer(event) || reduced || !window.matchMedia(hoverQuery).matches) return;
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    // The edge under the pointer comes forward: right of centre turns the right edge toward the
    // viewer (a negative rotateY), below centre the bottom edge (a positive rotateX). Physical.
    const x = clampUnit(((event.clientX - box.left) / box.width) * 2 - 1);
    const y = clampUnit(((event.clientY - box.top) / box.height) * 2 - 1);
    cancelAnimationFrame(tiltFrame.current);
    tiltFrame.current = requestAnimationFrame(() => {
      card.dataset.tilt = "";
      card.style.setProperty("--tilt-y", String(-x));
      card.style.setProperty("--tilt-x", String(y));
    });
  };

  const untilt = (event: PointerEvent<HTMLButtonElement>) => {
    cancelAnimationFrame(tiltFrame.current);
    const card = event.currentTarget;
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
    delete card.dataset.tilt;
  };

  const current = categories[selected];
  const entry = cache.get(current.slug);
  const state = categoryPanelState(entry);
  const products = entry?.kind === "ready" ? entry.products : [];

  return (
    <div className="flex flex-col">
      <div
        ref={rowRef}
        role="tablist"
        aria-label={t("categoriesLabel")}
        data-testid="home-category-tabs"
        onKeyDown={onKeyDown}
        className={cn(
          // Below md one row that scrolls sideways inside the column; from md wrapped rows. The
          // padding keeps the selected card's scale, edge, and focus outline from being clipped.
          "flex touch-pan-x touch-pan-y snap-x snap-mandatory scroll-px-(--page-pad) [scrollbar-width:none] gap-3 overflow-x-auto overscroll-x-contain px-(--page-pad) py-[calc(var(--category-card)_*_0.1)] [&::-webkit-scrollbar]:hidden",
          "md:snap-none md:flex-wrap md:justify-center md:gap-4 md:overflow-visible",
          "[--cf-dir:1] rtl:[--cf-dir:-1]",
        )}
      >
        {categories.map((category, index) => (
          <CategoryCard
            key={category.slug}
            category={category}
            index={index}
            selected={index === selected}
            turn={categoryTurn(index, selected, perRow, 1)}
            tabRef={(element) => {
              tabs.current[index] = element;
            }}
            onSelect={() => select(index, "press")}
            onFocus={() => {
              if (!movedByKey.current) load(category.slug);
            }}
            onPointerEnter={(event) => {
              if (isHoverPointer(event)) load(category.slug);
            }}
            onPointerMove={tilt}
            onPointerLeave={untilt}
          />
        ))}
      </div>

      <section
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(current.slug)}
        aria-busy={state === "skeleton" ? true : undefined}
        tabIndex={0}
        data-testid="home-category-panel"
        className="flex flex-col gap-3 px-(--page-pad) pt-3 text-start"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="type-title-s" data-testid="home-category-heading">
            {current.name}
          </h3>
          <Link
            href={routes.category(current.slug)}
            className="inline-flex min-h-11 shrink-0 items-center type-small text-muted underline decoration-1 underline-offset-4 transition-colors duration-(--dur-hover) hover:text-ink hover:decoration-brand hover:decoration-2"
          >
            {t("viewAll")}
          </Link>
        </div>
        {state === "grid" ? (
          <ul
            data-testid="home-category-products"
            className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-4 lg:gap-4"
          >
            {products.map((product, index) => (
              <li key={product.slug} className="flex">
                <ProductCard
                  product={product}
                  index={index}
                  whatsappNumber={whatsappNumber}
                  siteUrl={siteUrl}
                  heading="h4"
                  canAddToDraft={canAddToDraft}
                />
              </li>
            ))}
          </ul>
        ) : state === "skeleton" ? (
          <GridSkeleton />
        ) : state === "notice" ? (
          <Alert data-testid="home-category-failed">
            <p>{t("productsFailed")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 self-start"
              onClick={() => load(current.slug)}
            >
              {t("retry")}
            </Button>
          </Alert>
        ) : (
          <p className="type-body text-muted">{t("categoryEmpty")}</p>
        )}
      </section>
    </div>
  );
}
