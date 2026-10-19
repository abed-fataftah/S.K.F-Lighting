import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// covers: AC-2, AC-3, AC-6 (spec 0003). The design is the only option: no raw colour,
// no physical direction, no off scale value, no dark mode, no ring, shadow, gradient, or blur.
// Planted fixtures below are built from string pieces so this file never flags itself.

type Rule = { readonly name: string; readonly pattern: RegExp; readonly only?: "css" };

// A class token starts after whitespace, a quote, a backtick, a variant colon, `!`, `(`, or `{`.
const B = String.raw`(?<![\w-])-?`;

const rules: readonly Rule[] = [
  { name: "raw hex colour", pattern: /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/i },
  {
    name: "physical direction class",
    pattern: new RegExp(
      B +
        String.raw`(?:m[lr]|p[lr]|left|right|inset-x|scroll-m[lr]|scroll-p[lr])-` +
        "|" +
        B +
        String.raw`(?:border-[lr]|rounded-[lr]|rounded-[tb][lr])(?![\w])` +
        "|" +
        B +
        String.raw`(?:text|float|origin|clear)-(?:left|right)(?![\w])` +
        "|" +
        B +
        String.raw`(?:slide-in-from|slide-out-to)-(?:left|right)(?![\w])`,
    ),
  },
  {
    name: "physical CSS property",
    pattern:
      /(?<![\w-])(?:(?:margin|padding|border|scroll-margin|scroll-padding)-(?:left|right)|left|right)\s*:/,
    only: "css",
  },
  { name: "arbitrary pixel value", pattern: /\[[^\]\s]*\d+px[^\]\s]*\]/ },
  {
    name: "removed Tailwind scale",
    pattern: new RegExp(
      B +
        String.raw`text-(?:xs|sm|base|lg|[2-9]?xl)(?![\w-])` +
        "|" +
        B +
        String.raw`rounded-(?:xs|sm|md|lg|[2-4]?xl)(?![\w-])` +
        "|" +
        B +
        String.raw`[a-z]+-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?![\w])` +
        "|" +
        B +
        String.raw`font-(?:thin|extralight|light|medium|semibold|black)(?![\w-])` +
        "|" +
        B +
        String.raw`leading-(?:none|tight|snug|normal|relaxed|loose)(?![\w-])`,
    ),
  },
  { name: "dark mode", pattern: /(?<![\w-])dark:|\.dark(?![\w-])|prefers-color-scheme/ },
  {
    name: "ring or removed outline",
    pattern: new RegExp(B + String.raw`(?:ring-|outline-(?:none|hidden)(?![\w-]))`),
  },
  {
    name: "shadow, gradient, or blur",
    pattern: new RegExp(
      B +
        String.raw`(?:inset-shadow|drop-shadow|text-shadow|shadow)(?=[-\s"'\x60]|$)` +
        "|" +
        B +
        String.raw`bg-(?:gradient|linear|radial|conic)-` +
        "|" +
        B +
        String.raw`(?:backdrop-)?blur(?=[-\s"'\x60]|$)`,
    ),
  },
];

// Comments are prose, not code: drop them before matching. `//` after `:` (a URL) stays.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[\s;{}()])\/\/.*$/gm, "$1");
}

function violations(source: string, kind: "ts" | "css"): readonly string[] {
  const code = stripComments(source);
  return rules
    .filter((rule) => !rule.only || rule.only === kind)
    .flatMap((rule) => {
      const match = code.match(rule.pattern);
      return match ? [`${rule.name}: ${match[0]}`] : [];
    });
}

// Words that never appear in the storefront (handoff section 11, item 10).
// Arabic letter boundaries, so the currency شيكل passes.
const forbiddenWords = ["شيك", "بشيك", "دفع إلكتروني", "تعديل الأسعار"];
const arabicLetter = "\\u0600-\\u06FF";

function forbiddenWordsIn(text: string): readonly string[] {
  return forbiddenWords.filter((word) =>
    new RegExp(`(?<![${arabicLetter}])${word}(?![${arabicLetter}])`).test(text),
  );
}

type Messages = { readonly [key: string]: string | Messages };

function storefrontText(messages: Messages): string {
  return Object.entries(messages)
    .filter(([namespace]) => !namespace.startsWith("Admin"))
    .map(([, value]) => JSON.stringify(value))
    .join("\n");
}

const srcDir = join(process.cwd(), "src");
const skipped = new Set([
  join("app", "tokens.css"),
  "design-rules.test.ts",
  // Inserts a product colour row: its swatch hex is catalog data (colours.hex), not a style.
  join("server", "db", "testing.ts"),
]);

function sourceFiles(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) && !skipped.has(relative(srcDir, path)) ? [path] : [];
  });
}

describe("design rules: planted fixtures", () => {
  const caught: readonly [string, string, "ts" | "css"][] = [
    ["a physical margin", `className="m` + `l-2"`, "ts"],
    ["a raw hex colour", `color: "#` + `ffffff"`, "ts"],
    ["a short hex colour", `"#` + `fff"`, "ts"],
    ["an arbitrary pixel value", `className="h-[13` + `px]"`, "ts"],
    ["a shadow", `className="shad` + `ow-md"`, "ts"],
    ["a dark variant", `className="da` + `rk:bg-ink"`, "ts"],
    ["a removed font size", `className="text-` + `sm"`, "ts"],
    ["a removed outline", `className="outline-` + `none"`, "ts"],
    ["a physical corner", `className="rounded-` + `tl-card"`, "ts"],
    ["a focus ring", `className="focus-visible:ri` + `ng-2"`, "ts"],
    ["a default palette colour", `className="bg-r` + `ed-500"`, "ts"],
    ["a removed weight", `className="font-semi` + `bold"`, "ts"],
    ["a leading keyword", `className="leading-` + `tight"`, "ts"],
    ["a gradient", `className="bg-lin` + `ear-to-r"`, "ts"],
    ["a blur", `className="backdrop-bl` + `ur"`, "ts"],
    ["a physical text align", `className="text-` + `right"`, "ts"],
    ["a physical slide", `className="slide-in-from-` + `left"`, "ts"],
    ["a physical CSS property", `.x { margin-` + `left: 4px; }`, "css"],
    ["a physical inset in CSS", `.x { ri` + `ght: 0; }`, "css"],
    ["a colour scheme query", `@media (prefers-color-` + `scheme: dark) {}`, "css"],
  ];

  it.each(caught)("catches %s", (_name, source, kind) => {
    expect(violations(source, kind)).not.toEqual([]);
  });

  const allowed: readonly [string, string][] = [
    ["html- in a word", `className="html-content"`],
    ["an anchor href", `href="#main"`],
    ["a logical inset", `className="start-0 end-3.5"`],
    ["a logical text align", `className="text-start"`],
    ["a token radius", `className="rounded-card rounded-btn rounded-full"`],
    ["a token colour", `className="bg-yellow text-ink border-control-border bg-yellow-tint"`],
    ["the kept weights", `className="font-bold font-extrabold"`],
    ["a type role", `className="type-caption type-404"`],
    ["a URL inside a string", `const url = "https://wa.me/970500000000";`],
    ["a comment that mentions blur and left", `// clamp on blur; never use ml-2 or left`],
  ];

  it.each(allowed)("lets %s pass", (_name, source) => {
    expect(violations(source, "ts")).toEqual([]);
  });

  it("catches a forbidden word in a storefront namespace", () => {
    const messages = {
      Shell: { note: "ادفع " + "شيك" + " عند الاستلام", other: "الدفع ب" + "شيك" },
    };
    expect(forbiddenWordsIn(storefrontText(messages))).toEqual(["شيك", "بشيك"]);
  });

  it("lets the currency name شيكل pass", () => {
    expect(forbiddenWordsIn(storefrontText({ Home: { price: "السعر بالشيكل" } }))).toEqual([]);
  });

  it("allows those words in a dashboard namespace", () => {
    const messages = { AdminPayments: { cheque: "دفعة ب" + "شيك" } };
    expect(forbiddenWordsIn(storefrontText(messages))).toEqual([]);
  });
});

describe("design rules: the real tree", () => {
  const files = sourceFiles(srcDir);

  it("scans the source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("finds no design rule violation in src/ (outside tokens.css)", () => {
    const found = files.flatMap((file) =>
      violations(readFileSync(file, "utf8"), file.endsWith(".css") ? "css" : "ts").map(
        (v) => `${relative(srcDir, file).split(sep).join("/")}: ${v}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("keeps the storefront copy free of the forbidden words", async () => {
    const { default: ar } = await import("@/i18n/messages/ar.json");
    expect(forbiddenWordsIn(storefrontText(ar))).toEqual([]);
  });
});
