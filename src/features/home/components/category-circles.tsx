"use client";

import { Lamp, Pause, Play } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { ChevronBack, ChevronNext } from "@/components/icons/directional";
import { Button, ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { changesSide, circleSteps, HOME_LIMITS, type HomeCircle } from "../home-rules";

const AUTO_MS = 3500;
const SWIPE_PX = 40;

// The carousel's geometry from the Home board: the centred circle is 132 wide, its neighbours
// shrink to 72% and 50%, and the third one out fades to nothing. Offsets are along the line.
const SIZE = 132;
const GAP = 14;
const SCALES = [1, 0.72, 0.5, 0.3] as const;
const OPACITY = [1, 0.85, 0.6, 0] as const;
const OFFSETS = (() => {
  const near = SIZE / 2 + GAP + (SIZE * SCALES[1]) / 2;
  const far = near + (SIZE * SCALES[1]) / 2 + GAP + (SIZE * SCALES[2]) / 2;
  return [0, near, far, far + (SIZE * SCALES[2]) / 2 + GAP + 30] as const;
})();

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True under `prefers-reduced-motion: reduce`; true on the server, so nothing moves before it knows. */
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => true,
  );
}

function CirclePicture({
  circle,
  className,
}: {
  readonly circle: HomeCircle;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-fill-muted",
        className,
      )}
    >
      {circle.imageKey ? (
        <Image src={circle.imageKey} alt="" fill sizes="132px" className="object-cover" />
      ) : (
        <Lamp aria-hidden className="size-10 text-muted" strokeWidth={1.5} />
      )}
    </span>
  );
}

function CircleWords({ circle }: { readonly circle: HomeCircle }) {
  return (
    <>
      <span className="mt-2.5 block type-lead">{circle.name}</span>
      {circle.line ? <span className="block type-caption text-muted">{circle.line}</span> : null}
    </>
  );
}

/** A single circle: alone and centred, a plain link, no arrows and no movement (AC-4). */
function LoneCircle({ circle }: { readonly circle: HomeCircle }) {
  return (
    <div className="flex justify-center px-(--page-pad)" data-testid="home-circles">
      <Link href={routes.category(circle.slug)} className="block w-28 rounded-btn text-center">
        <CirclePicture circle={circle} />
        <CircleWords circle={circle} />
      </Link>
    </div>
  );
}

/** How far out a circle `steps` from the centre sits, capped where it has faded away. */
const awayFrom = (steps: number) => Math.min(Math.abs(steps), 3) as 0 | 1 | 2 | 3;

/** The move along the line in px, positive toward the inline end (`end` is -1 in right to left). */
function placed(steps: number, end: 1 | -1) {
  const away = awayFrom(steps);
  return {
    transform: `translateX(${end * Math.sign(steps) * OFFSETS[away]}px) scale(${SCALES[away]})`,
    opacity: OPACITY[away],
  };
}

/** A CSS time token ("0.7s" or "700ms") in milliseconds. */
function tokenMs(element: Element, token: string) {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  return value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000;
}

/**
 * Two or more circles (AC-4; pages/home.md interactions 1 to 3): loops, and moves on by itself
 * every 3.5 seconds until the first touch or any focus inside, never under reduced motion. The
 * pause button stops and starts it again (WCAG 2.2.2). The yellow button opens the centred one.
 * A circle that crosses to the other side on a step fades out and back in there instead of
 * sliding over the centre.
 */
function CircleCarousel({ circles }: { readonly circles: readonly HomeCircle[] }) {
  const t = useTranslations("Home");
  const count = circles.length;
  const reduced = useReducedMotion();
  // `from` is the centre before the last step, so a render knows which circles cross.
  const [at, setAt] = useState({ centre: 0, from: 0 });
  const [auto, setAuto] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const swipeFrom = useRef<number | null>(null);
  const moving = auto && !reduced;
  const { centre, from } = at;

  const step = (by: number) =>
    setAt((now) => ({ centre: (now.centre + by + count) % count, from: now.centre }));

  useEffect(() => {
    if (!moving) return;
    const timer = setInterval(
      () => setAt((now) => ({ centre: (now.centre + 1) % count, from: now.centre })),
      AUTO_MS,
    );
    return () => clearInterval(timer);
  }, [moving, count]);

  // The crossing circles already sit on their new side with no transition; play the fade.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || reduced || from === centre) return;
    const end = getComputedStyle(list).direction === "rtl" ? -1 : 1;
    Array.from(list.children).forEach((item, index) => {
      const before = circleSteps(index, from, count);
      const after = circleSteps(index, centre, count);
      if (!changesSide(before, after)) return;
      item.getAnimations().forEach((animation) => animation.cancel());
      const out = placed(before, end);
      const back = placed(after, end);
      item.animate(
        [
          { ...out, visibility: "visible" },
          { ...out, opacity: 0, visibility: "visible", offset: 0.5 },
          { ...back, opacity: 0, offset: 0.5 },
          back,
        ],
        {
          duration: tokenMs(item, "--dur-carousel-move"),
          easing: getComputedStyle(item).getPropertyValue("--ease-carousel").trim() || "ease",
        },
      );
    });
  }, [centre, from, count, reduced]);
  const inPause = (target: EventTarget | null) =>
    target instanceof Node && !!pauseRef.current?.contains(target);
  const stop = (target: EventTarget | null) => {
    if (!inPause(target)) setAuto(false);
  };

  const startSwipe = (event: PointerEvent<HTMLDivElement>) => {
    stop(event.target);
    swipeFrom.current = event.clientX;
  };
  const endSwipe = (event: PointerEvent<HTMLDivElement>) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (from === null) return;
    const moved = event.clientX - from;
    // The next circles wait on the inline end (the left in right to left): drag them toward the
    // middle to move on.
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    if (Math.abs(moved) >= SWIPE_PX) step(moved > 0 === rtl ? 1 : -1);
  };

  const centred = circles[centre];
  const n = formatNumber(centre + 1);
  const total = formatNumber(count);

  return (
    <div
      aria-roledescription="carousel"
      aria-label={t("categoriesLabel")}
      role="region"
      onFocus={(event) => stop(event.target)}
      onPointerDown={startSwipe}
      onPointerUp={endSwipe}
      onPointerCancel={() => (swipeFrom.current = null)}
      className="flex flex-col items-center"
      data-testid="home-circles"
    >
      <p className="sr-only" aria-live={moving ? "off" : "polite"}>
        {t("centredCategory", { n, count: total, name: centred.name })}
      </p>
      <div className="relative h-55.5 w-full touch-pan-y overflow-hidden">
        <ul ref={listRef}>
          {circles.map((circle, index) => {
            const steps = circleSteps(index, centre, count);
            const away = awayFrom(steps);
            const towardEnd = steps > 0;
            const crossing = changesSide(circleSteps(index, from, count), steps);
            const style: CSSProperties = {
              width: SIZE,
              insetInlineStart: `calc(50% - ${SIZE / 2}px)`,
              // In right to left the inline end is the physical left: a negative move.
              transform: `translateX(calc(var(--carousel-end) * ${OFFSETS[away]}px * ${towardEnd ? 1 : -1})) scale(${SCALES[away]})`,
              transformOrigin: `50% ${SIZE / 2}px`,
              opacity: OPACITY[away],
              zIndex: 10 - away,
              // It jumps to its new side and the fade above plays instead of a slide.
              ...(crossing && { transition: "none" }),
            };
            return (
              <li
                key={circle.slug}
                inert={away > 2}
                aria-hidden={away > 2 || undefined}
                style={style}
                // Three steps out a circle has faded away: it is not shown, focused, or tapped.
                className={cn(
                  "absolute top-0 text-center transition-[transform,opacity,visibility] duration-(--dur-carousel-move) ease-(--ease-carousel) [--carousel-end:1] motion-reduce:transition-none rtl:[--carousel-end:-1]",
                  away > 2 && "invisible",
                )}
              >
                <Link href={routes.category(circle.slug)} className="block rounded-btn">
                  <CirclePicture
                    circle={circle}
                    className={cn("border-4", away === 0 ? "border-yellow" : "border-transparent")}
                  />
                  <span className="-mx-[20%] block w-[140%]">
                    <CircleWords circle={circle} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Button
          variant="outline"
          size="icon"
          className="absolute start-3 top-11 z-30 rounded-full"
          aria-label={t("categoryPrev")}
          onClick={() => step(-1)}
        >
          <ChevronBack className="size-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="absolute end-3 top-11 z-30 rounded-full"
          aria-label={t("categoryNext")}
          onClick={() => step(1)}
        >
          <ChevronNext className="size-5" />
        </Button>
      </div>
      <div className="mb-5 flex items-center gap-3">
        <span aria-hidden className="relative h-0.5 w-30 bg-chip-border">
          <span
            className="absolute -top-1.5 size-3.5 rounded-full border-2 border-ink bg-white transition-[inset-inline-start] duration-(--dur-carousel-move) ease-(--ease-carousel) motion-reduce:transition-none"
            style={{ insetInlineStart: `${(centre / Math.max(1, count - 1)) * 106}px` }}
          />
        </span>
        {reduced ? null : (
          <Button
            ref={pauseRef}
            variant="outline"
            size="icon"
            aria-pressed={!moving}
            aria-label={moving ? t("pauseAuto") : t("playAuto")}
            onClick={() => setAuto((on) => !on)}
            data-testid="circles-pause"
          >
            {moving ? (
              <Pause className="size-5" aria-hidden />
            ) : (
              <Play className="size-5" aria-hidden />
            )}
          </Button>
        )}
      </div>
      <ButtonLink
        href={routes.category(centred.slug)}
        className="px-6"
        data-testid="circles-browse"
      >
        {t("browse", { name: centred.name })}
      </ButtonLink>
    </div>
  );
}

export function CategoryCircles({ circles }: { readonly circles: readonly HomeCircle[] }) {
  if (circles.length >= HOME_LIMITS.carouselFrom) return <CircleCarousel circles={circles} />;
  return circles[0] ? <LoneCircle circle={circles[0]} /> : null;
}
