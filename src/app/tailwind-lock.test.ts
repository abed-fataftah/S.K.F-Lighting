import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compile } from "@tailwindcss/node";
import { beforeAll, describe, expect, it } from "vitest";

// covers: AC-3 (spec 0003): Tailwind knows only the tokens. Compiles the real globals.css
// and asks Tailwind which classes produce CSS.
const base = fileURLToPath(new URL(".", import.meta.url));
let build: (candidates: string[]) => string;

beforeAll(async () => {
  const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
  const compiler = await compile(css, { base, onDependency: () => {} });
  build = (candidates) => compiler.build(candidates);
});

const selector = (cls: string) =>
  "." + cls.replace(/[:.()\-[\]/=]/g, (c) => (c === "-" ? c : `\\${c}`));
const produces = (cls: string) => build([cls]).includes(selector(cls));

describe("Tailwind lock", () => {
  it.each([
    "bg-red-500",
    "text-gray-600",
    "bg-black",
    "rounded-lg",
    "rounded-sm",
    "shadow-md",
    "drop-shadow-md",
    "text-sm",
    "text-2xl",
    "font-medium",
    "font-semibold",
    "font-mono",
    "leading-tight",
    "tracking-wide",
    "max-w-md",
    "blur-sm",
    "ease-in",
    "animate-pulse",
    "animate-spin",
    // Only md and lg (spec 0029 AC-2).
    "sm:flex",
    "xl:flex",
    "2xl:flex",
  ])("removes %s", (cls) => {
    expect(produces(cls)).toBe(false);
  });

  it.each([
    "font-bold",
    "font-extrabold",
    "bg-transparent",
    "text-current",
    "font-sans",
    "bg-yellow",
    "text-ink",
    "border-control-border",
    "bg-product-1",
    "bg-primary",
    "rounded-card",
    "rounded-btn",
    "rounded-full",
    "type-caption",
    "type-404",
    "animate-skeleton",
    "max-w-(--page-max)",
    "h-13",
    "md:flex",
    "lg:flex",
    "lg-tall:sticky",
    "max-w-(--content-max)",
  ])("keeps %s", (cls) => {
    expect(produces(cls)).toBe(true);
  });

  it("gives each type role a size, a weight, and a line height", () => {
    const css = build(["type-title-m"]);
    expect(css).toContain("font-size: var(--fs-title-m)");
    expect(css).toContain("font-weight: var(--fw-heavy)");
    expect(css).toContain("line-height: var(--lh-card-title)");
  });

  // covers: AC-2, AC-12 (spec 0029)
  it("puts md at 48rem, lg at 64rem, and lg-tall at 64rem wide and 45rem high", () => {
    expect(build(["md:flex"])).toContain("(width >= 48rem)");
    expect(build(["lg:flex"])).toContain("(width >= 64rem)");
    expect(build(["lg-tall:sticky"])).toMatch(/\(width >= 64rem\) and \(height >= 45rem\)/);
  });

  it("lets a weight class override a type role's weight", () => {
    const css = build(["type-body", "font-extrabold"]);
    expect(css.indexOf(".font-extrabold")).toBeGreaterThan(css.indexOf(".type-body"));
  });
});
