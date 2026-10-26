import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// covers: AC-20 (spec 0003): every pair in the tokens contrast table is recomputed from the hex values.
const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

const colours: ReadonlyMap<string, string> = new Map(
  [...css.matchAll(/(--skf-[a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]),
);

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Pair = {
  readonly fg: string;
  readonly bg: string;
  readonly stated: number;
  readonly min: number;
};

const table = css.slice(css.indexOf("13. Contrast table"));
const nonText = table.indexOf("Non-text pairs");
const pairs: readonly Pair[] = [
  ...table.matchAll(/(--skf-[a-z0-9-]+) on (--skf-[a-z0-9-]+) \.+ (\d+\.\d+)/g),
].map((m) => ({
  fg: m[1],
  bg: m[2],
  stated: Number(m[3]),
  min: (m.index ?? 0) > nonText ? 3 : 4.5,
}));

describe("tokens contrast table", () => {
  it("lists all 18 approved pairs", () => {
    expect(pairs).toHaveLength(18);
  });

  it.each(pairs)("$fg on $bg is $stated:1 and meets $min:1", ({ fg, bg, stated, min }) => {
    const ratio = contrast(colours.get(fg)!, colours.get(bg)!);

    expect(ratio).toBeCloseTo(stated, 1);
    expect(ratio).toBeGreaterThanOrEqual(min);
  });

  it("keeps yellow text on a light surface forbidden (below 3:1)", () => {
    const yellow = colours.get("--skf-yellow")!;

    expect(contrast(yellow, colours.get("--skf-white")!)).toBeLessThan(3);
    expect(contrast(yellow, colours.get("--skf-page")!)).toBeLessThan(3);
  });
});
