import { createHash } from "node:crypto";
import { isLocalDatabaseUrl } from "@/server/db/local";

// The pure parts of `pnpm media:samples` (spec 0032 AC-14): the dev only command that gives local
// products and main categories a glowing sample picture until the real photos are uploaded. The
// runner is scripts/media-samples.ts; it reads the colours from tokens.css and passes them in, so
// no colour value lives here.

export const SAMPLE_DRAWINGS = ["chandelier", "tableLamp", "pendant", "wallLight", "bulb"] as const;
export type SampleDrawing = (typeof SAMPLE_DRAWINGS)[number];

/** How many product tones there are (`--skf-product-bg-1..4`). */
export const SAMPLE_TONES = 4;

/** The pixel sizes the command writes: a 4:5 product picture and the 1:1 category crop. */
export const SAMPLE_SIZES = {
  product: { width: 1200, height: 1500 },
  category: { width: 800, height: 800 },
} as const;
export type SampleTarget = keyof typeof SAMPLE_SIZES;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** True only for a Supabase URL whose host is localhost or 127.0.0.1. */
export function isLocalSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Why the command must not run, or null when both the database and Supabase are local. Both
 * have to be local, so it never touches the live shop or mixes a local bucket with a remote
 * database.
 */
export function samplesRefusal(
  databaseUrl: string | undefined,
  supabaseUrl: string | undefined,
): string | null {
  if (!isLocalDatabaseUrl(databaseUrl)) {
    return (
      "Refusing to add sample pictures: DATABASE_URL_DIRECT must point at the local Supabase " +
      "database (localhost or 127.0.0.1, port 54322)."
    );
  }
  if (!isLocalSupabaseUrl(supabaseUrl)) {
    return (
      "Refusing to add sample pictures: NEXT_PUBLIC_SUPABASE_URL must be the local Supabase " +
      "(localhost or 127.0.0.1)."
    );
  }
  return null;
}

/** The drawing and tone for an id: sha256 of it, byte 0 picks the drawing, byte 1 the tone. */
export function pickSample(id: string): { readonly drawing: SampleDrawing; readonly tone: number } {
  const digest = createHash("sha256").update(id).digest();
  return {
    drawing: SAMPLE_DRAWINGS[digest[0] % SAMPLE_DRAWINGS.length],
    tone: digest[1] % SAMPLE_TONES,
  };
}

type Glow = { readonly cx: number; readonly cy: number; readonly r: number };

// Each drawing sits in a 200 by 200 box: line art in the glow colour, plus where its light is.
const DRAWINGS: Readonly<Record<SampleDrawing, { readonly glow: Glow; readonly art: string }>> = {
  chandelier: {
    glow: { cx: 100, cy: 105, r: 95 },
    art: `
      <path d="M100 18V62" />
      <path d="M86 62h28l-5 22h-18z" />
      <path d="M100 84v12" />
      <path d="M42 112c10 22 106 22 116 0" />
      <path d="M100 96c-20 0-46 4-58 16M100 96c20 0 46 4 58 16M100 96c-10 2-24 10-28 22M100 96c10 2 24 10 28 22" />
      ${[42, 72, 128, 158]
        .map(
          (x) =>
            `<rect x="${x - 4}" y="${x === 72 || x === 128 ? 118 : 112}" width="8" height="16" rx="2" />` +
            `<circle class="lit" cx="${x}" cy="${x === 72 || x === 128 ? 112 : 106}" r="4" />`,
        )
        .join("")}
      <path d="M100 130v18M94 154l6 10 6-10-6-6z" />`,
  },
  tableLamp: {
    glow: { cx: 100, cy: 88, r: 90 },
    art: `
      <path d="M66 92h68l-16-52H82z" />
      <circle class="lit" cx="100" cy="98" r="7" />
      <path d="M100 106v52" />
      <path d="M72 168c0-8 56-8 56 0v4H72z" />`,
  },
  pendant: {
    glow: { cx: 100, cy: 126, r: 92 },
    art: `
      <path d="M100 8v56" />
      <path d="M92 64h16v8H92z" />
      <path d="M48 120c0-30 24-48 52-48s52 18 52 48z" />
      <circle class="lit" cx="100" cy="128" r="10" />`,
  },
  wallLight: {
    glow: { cx: 118, cy: 78, r: 88 },
    art: `
      <rect x="40" y="70" width="18" height="64" rx="4" />
      <path d="M58 102h34c14 0 26-8 26-22" />
      <path d="M98 80h40l-8 28h-24z" />
      <circle class="lit" cx="118" cy="68" r="7" />
      <path d="M112 60v-8M124 60v-8" />`,
  },
  bulb: {
    glow: { cx: 100, cy: 82, r: 96 },
    art: `
      <path d="M78 116c-14-10-22-24-22-40a44 44 0 0 1 88 0c0 16-8 30-22 40v14H78z" />
      <path d="M84 104l8-30 8 18 8-18 8 30" class="lit-line" />
      <path d="M80 140h40M82 150h36M90 160h20" />`,
  },
};

/**
 * The SVG for one sample picture: the drawing, lit by a warm glow, on a product tone. `background`
 * and `glow` are colour values read from tokens.css by the runner.
 */
export function sampleSvg({
  drawing,
  target,
  background,
  glow,
}: {
  readonly drawing: SampleDrawing;
  readonly target: SampleTarget;
  readonly background: string;
  readonly glow: string;
}): string {
  const { width, height } = SAMPLE_SIZES[target];
  // A 200 wide box scaled to the picture, the drawing centred in its height.
  const viewHeight = (200 * height) / width;
  const offset = (viewHeight - 200) / 2;
  const { glow: light, art } = DRAWINGS[drawing];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 200 ${viewHeight}">
  <defs>
    <radialGradient id="light">
      <stop offset="0" stop-color="${glow}" stop-opacity="0.55" />
      <stop offset="0.45" stop-color="${glow}" stop-opacity="0.18" />
      <stop offset="1" stop-color="${glow}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="200" height="${viewHeight}" fill="${background}" />
  <g transform="translate(0 ${offset})">
    <circle cx="${light.cx}" cy="${light.cy}" r="${light.r}" fill="url(#light)" />
    <g fill="none" stroke="${glow}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <style>.lit { fill: ${glow}; } .lit-line { stroke-width: 2; }</style>
      ${art}
    </g>
  </g>
</svg>`;
}
