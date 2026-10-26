import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  type MessageFormatElement,
  isDateElement,
  isLiteralElement,
  isNumberElement,
  isPluralElement,
  isPoundElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
} from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";

// covers: AC-13, AC-15 (spec 0005). One way to format: numbers, prices, dates, and times come
// only from src/lib/format.ts and src/lib/money.ts, and Arabic digits only from src/lib/arabic.ts.
// Planted fixtures below are built from string pieces so this file never flags itself.

type Rule = {
  readonly name: string;
  readonly pattern: RegExp;
  readonly allowedIn: readonly string[];
};

const FORMAT_FILES = ["lib/format.ts", "lib/money.ts"];

const rules: readonly Rule[] = [
  {
    name: "locale formatting method",
    pattern: /(?<![\w$])to(?:Locale(?:Date|Time)?String|DateString|TimeString)\(/,
    allowedIn: FORMAT_FILES,
  },
  {
    name: "Intl formatter",
    pattern: /Intl\.(?:NumberFormat|DateTimeFormat|RelativeTimeFormat|ListFormat)(?![\w$])/,
    allowedIn: FORMAT_FILES,
  },
  {
    name: "next-intl formatter",
    pattern: /(?<![\w$])(?:useFormatter|getFormatter)(?![\w$])/,
    allowedIn: FORMAT_FILES,
  },
  { name: "toFixed", pattern: /\.toFixed\(/, allowedIn: FORMAT_FILES },
  {
    name: "local time date accessor",
    pattern: /(?<![\w$])get(?:Hours|Minutes|Date|Day|Month|FullYear)\(/,
    allowedIn: FORMAT_FILES,
  },
  {
    name: "time zone name",
    pattern: /["'`]Asia\/(?:Jerusalem|Hebron)["'`]/,
    allowedIn: FORMAT_FILES,
  },
  {
    name: "Arabic Indic or Persian digit",
    pattern: /[\u0660-\u0669\u06F0-\u06F9]/,
    allowedIn: ["lib/arabic.ts"],
  },
];

// Comments are prose, not code: drop them before matching. `//` after `:` (a URL) stays.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[\s;{}()])\/\/.*$/gm, "$1");
}

function violations(source: string, file: string): readonly string[] {
  const code = stripComments(source);
  return rules
    .filter((rule) => !rule.allowedIn.includes(file))
    .flatMap((rule) => {
      const match = code.match(rule.pattern);
      return match ? [`${rule.name}: ${match[0]}`] : [];
    });
}

// The ICU checks (AC-13): Arabic plural categories in full, numbers passed in preformatted,
// and Arabic punctuation and Western digits in the text.
const ARABIC_PLURAL_CATEGORIES = ["one", "two", "few", "many", "other"];
const BAD_LITERAL = /[\u0660-\u0669\u06F0-\u06F9?;]/;

function elementProblems(elements: readonly MessageFormatElement[]): readonly string[] {
  return elements.flatMap((element): readonly string[] => {
    if (isLiteralElement(element)) {
      const bad = element.value.match(BAD_LITERAL);
      return bad ? [`literal text has ${JSON.stringify(bad[0])}`] : [];
    }
    if (isPoundElement(element)) return ["a # inside a plural (pass a formatted string)"];
    if (isNumberElement(element) || isDateElement(element) || isTimeElement(element)) {
      return [`a formatted argument {${element.value}} (pass a formatted string)`];
    }
    if (isPluralElement(element)) {
      const keys = Object.keys(element.options);
      const missing = ARABIC_PLURAL_CATEGORIES.filter((key) => !keys.includes(key));
      if (!keys.includes("zero") && !keys.includes("=0")) missing.push("zero or =0");
      const own = missing.length ? [`plural {${element.value}} misses ${missing.join(", ")}`] : [];
      return [...own, ...Object.values(element.options).flatMap((o) => elementProblems(o.value))];
    }
    if (isSelectElement(element)) {
      return Object.values(element.options).flatMap((option) => elementProblems(option.value));
    }
    if (isTagElement(element)) return elementProblems(element.children);
    return [];
  });
}

function messageProblems(message: string): readonly string[] {
  return elementProblems(parse(message));
}

type Messages = { readonly [key: string]: string | Messages };

function leaves(messages: Messages, prefix = ""): readonly (readonly [string, string])[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value] as const] : leaves(value, path);
  });
}

const srcDir = join(process.cwd(), "src");

function sourceFiles(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const toPosix = (path: string) => path.split(sep).join("/");

describe("language rules: planted fixtures", () => {
  const arabicThree = String.fromCharCode(0x0663);
  const caught: readonly [string, string][] = [
    ["toLocaleString", `price.toLocale` + `String("ar")`],
    ["toLocaleDateString", `d.toLocaleDate` + `String()`],
    ["toTimeString", `d.toTime` + `String()`],
    ["Intl.DateTimeFormat", `new Intl.DateTime` + `Format("ar")`],
    ["Intl.NumberFormat", `new Intl.Number` + `Format("ar")`],
    ["useFormatter", `const f = useForm` + `atter();`],
    ["getFormatter", `await getForm` + `atter()`],
    ["toFixed", `(price / 100).toFix` + `ed(2)`],
    ["getHours", `placedAt.getHo` + `urs()`],
    ["getFullYear", `now.getFull` + `Year()`],
    ["a time zone string", `timeZone: "Asia/Jeru` + `salem"`],
    ["the shop zone string", `timeZone: 'Asia/Heb` + `ron'`],
    ["an Arabic digit in a component", `<span>{"${arabicThree}"}</span>`],
  ];

  it.each(caught)("catches %s outside the format files", (_name, source) => {
    expect(violations(source, "features/cart/components/x.tsx")).not.toEqual([]);
  });

  it.each([
    ["the same words in a line comment", `// never call toLocale` + `String( or getHo` + `urs(`],
    ["the same words in a block comment", `/* Intl.Number` + `Format and "Asia/Heb` + `ron" */`],
    ["UTC accessors and ISO strings", `d.getUTCHours(); d.toISOString(); d.getTime()`],
    ["a name that only contains a banned word", `const formatTimeString = 1; budgetDate();`],
  ])("lets %s pass", (_name, source) => {
    expect(violations(source, "features/cart/components/x.tsx")).toEqual([]);
  });

  it("allows the formatters in the format files, and Arabic digits in arabic.ts", () => {
    expect(violations(`new Intl.DateTime` + `Format("en-US")`, "lib/format.ts")).toEqual([]);
    expect(violations(`"Asia/Heb` + `ron"`, "lib/format.ts")).toEqual([]);
    expect(violations(`/[${String.fromCharCode(0x0660)}]/`, "lib/arabic.ts")).toEqual([]);
    expect(violations(`/[${String.fromCharCode(0x0660)}]/`, "lib/format.ts")).not.toEqual([]);
  });

  const fullPlural = (other: string) =>
    `{count, plural, zero {a} one {b} two {c} few {d} many {e} other {${other}}}`;

  it.each([
    ["a # in a plural", fullPlural("# منتج")],
    ["a number argument", "{total, number} شيكل"],
    ["a date argument", "{when, date, short}"],
    ["a time argument", "{when, time}"],
    [
      "a plural with only five categories",
      "{count, plural, one {a} two {b} few {c} many {d} other {e}}",
    ],
    ["an ASCII question mark", "هل أنت متأكد" + "?"],
    ["an ASCII semicolon", "أولًا" + "; ثانيًا"],
    ["an Arabic digit in the text", `${arabicThree} منتجات`],
    ["a problem nested in a plural option", fullPlural("كم" + "?")],
  ])("flags %s in a message", (_name, message) => {
    expect(messageProblems(message)).not.toEqual([]);
  });

  it.each([
    [
      "a full plural with =0",
      "{count, plural, =0 {a} one {b} two {c} few {d} many {e} other {{shown} f}}",
    ],
    ["Arabic punctuation", "هل أنت متأكد؟ أولًا؛ ثانيًا"],
    ["Western digits", "توصيل: الضفة {fee}"],
    ["a rich text tag", "اقرأ <link>الشروط</link>"],
  ])("lets %s pass", (_name, message) => {
    expect(messageProblems(message)).toEqual([]);
  });
});

describe("language rules: the real tree", () => {
  const files = sourceFiles(srcDir);

  it("scans the source files", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.map((f) => toPosix(relative(srcDir, f)))).toContain("lib/format.ts");
  });

  it("formats only through src/lib/format.ts and src/lib/money.ts", () => {
    const found = files.flatMap((file) => {
      const path = toPosix(relative(srcDir, file));
      return violations(readFileSync(file, "utf8"), path).map((v) => `${path}: ${v}`);
    });
    expect(found).toEqual([]);
  });

  it("keeps ar.json to Arabic plurals, preformatted numbers, and Arabic punctuation", async () => {
    const { default: ar } = await import("@/i18n/messages/ar.json");
    const found = leaves(ar).flatMap(([key, message]) =>
      messageProblems(message).map((problem) => `${key}: ${problem}`),
    );
    expect(found).toEqual([]);
  });
});
