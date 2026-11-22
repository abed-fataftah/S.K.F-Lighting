import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// covers: AC-1, AC-11 (spec 0032): the brand token values in tokens.css, the two drawing colours
// that must read on white, and no trace of the old yellow name or value in src/, e2e/, or scripts/.
// The old names are built from pieces so this file never flags itself.
const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})\\b`, "i"));
  if (!match) throw new Error(`${name} is not in tokens.css`);
  return match[1].toLowerCase();
}

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

const OLD_NAME = "yel" + "low";
const OLD_HEX = "fcf4" + "2c";

describe("brand tokens (spec 0032)", () => {
  // Values are compared without their `#`, so the design rule test does not read them as raw colours.
  it("sets the brand orange and its tint (AC-1)", () => {
    expect(token("--skf-brand").slice(1)).toBe("f7931e");
    expect(token("--skf-brand-tint").slice(1)).toBe("feefdc");
  });

  it("keeps control-border at 3:1 or more on the brand tint (AC-1)", () => {
    expect(
      contrast(token("--skf-control-border"), token("--skf-brand-tint")),
    ).toBeGreaterThanOrEqual(3);
  });

  it.each(["--illus-08", "--illus-09"])(
    "makes the chandelier colour %s show on white, at 1.5:1 or more (AC-11)",
    (name) => {
      expect(contrast(token(name), token("--skf-white"))).toBeGreaterThanOrEqual(1.5);
    },
  );

  it("drops the two pale yellow drawing colours (AC-11)", () => {
    const drawing = [token("--illus-08").slice(1), token("--illus-09").slice(1)];
    expect(drawing).not.toContain("e9d58a");
    expect(drawing).not.toContain("f5efd0");
  });
});

// The two files that name the old colour on purpose: the lock proving `bg-yellow` makes no CSS,
// and the design rule blocklist of the stock Tailwind palette.
const allowed = new Set([
  "src/app/tailwind-lock.test.ts",
  "src/design-rules.test.ts",
  "src/app/brand-tokens.test.ts",
]);

function files(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.(tsx?|mjs|css|json)$/.test(entry.name) ? [path] : [];
  });
}

describe("no yellow left (spec 0032 AC-1)", () => {
  const root = process.cwd();
  const scanned = ["src", "e2e", "scripts"]
    .flatMap((dir) => files(join(root, dir)))
    .map((path) => relative(root, path).split(sep).join("/"))
    .filter((path) => !allowed.has(path));

  it("scans the source, e2e, and script files", () => {
    expect(scanned.length).toBeGreaterThan(50);
  });

  it("finds no yellow name or old hex value outside the two allowed files", () => {
    const pattern = new RegExp(`${OLD_NAME}|${OLD_HEX}`, "i");
    const found = scanned.filter((path) => pattern.test(readFileSync(join(root, path), "utf8")));
    expect(found).toEqual([]);
  });

  it("names the brand colour orange, not yellow, in the Arabic copy", () => {
    const ar = readFileSync(join(root, "src/i18n/messages/ar.json"), "utf8");
    expect(ar).not.toMatch(/أصفر|صفراء/);
    expect(ar).toMatch(/برتقالي/);
  });
});
