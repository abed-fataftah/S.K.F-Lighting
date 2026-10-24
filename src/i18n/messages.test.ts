import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "./messages/ar.json";

type Messages = { [key: string]: string | Messages };

function leaves(messages: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [p, v] of leaves(value, path)) out.set(p, v);
  }
  return out;
}

describe("Arabic message catalog", () => {
  const catalog = leaves(ar);

  it("has no empty strings", () => {
    const empty = [...catalog].filter(([, value]) => value.trim() === "").map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("writes every sentence in Arabic script", () => {
    expect(ar.Home.productsText).toMatch(/[؀-ۿ]/);
    expect(ar.Metadata.description).toMatch(/[؀-ۿ]/);
  });

  // The shop is Arabic only (spec 0001, amended 2026-10-17), so no message may be left in English.
  it("has Arabic text in every message, with no English only strings", () => {
    const notArabic = [...catalog].filter(([, value]) => !/[؀-ۿ]/.test(value)).map(([key]) => key);

    expect(notArabic).toEqual([]);
  });

  // covers: AC-14 (spec 0005). A price set inside an Arabic sentence must stay left to right, so a
  // screen message places it in the `<ltr>` tag the page renders as `bdi[dir=ltr]`.
  it("wraps every price in a screen message in <ltr>", () => {
    const screen = [...catalog].filter(([key]) => !key.startsWith("OrderMessage."));
    const bare = screen
      .filter(([, value]) => value.replaceAll("<ltr>{price}</ltr>", "").includes("{price}"))
      .map(([key]) => key);

    expect(screen.some(([, value]) => value.includes("<ltr>{price}</ltr>"))).toBe(true);
    expect(bare).toEqual([]);
  });

  // The WhatsApp order message is plain text: a rich tag there would reach the owner as literal text.
  it("keeps the WhatsApp order message free of rich text tags", () => {
    const tagged = [...catalog]
      .filter(([key, value]) => key.startsWith("OrderMessage.") && /<\/?[a-z]+>/i.test(value))
      .map(([key]) => key);

    expect(tagged).toEqual([]);
  });
});

/** Plain translator calls (`t("…")`, not `t.rich("…")`) to any of these message keys, by leaf. */
function plainCalls(source: string, leafKeys: readonly string[]): readonly string[] {
  return leafKeys.filter((leaf) =>
    new RegExp(String.raw`(?<![\w$.])[a-z]\w*\(\s*["'](?:[\w.]+\.)?${leaf}["']`).test(source),
  );
}

// covers: AC-14 (spec 0005). next-intl cannot format a message holding a rich tag through plain
// `t(...)`: the `<ltr>` price would fail to render. Every tagged message goes through `t.rich`.
describe("rich text messages", () => {
  const tagged = [...leaves(ar)].filter(([, value]) => /<[a-z]+>/i.test(value));
  const leafKeys = [...new Set(tagged.map(([key]) => key.split(".").at(-1)!))];

  it("catches a plain call to a tagged message and allows t.rich", () => {
    expect(plainCalls(`t("from", { price })`, ["from"])).toEqual(["from"]);
    expect(plainCalls(`shop('Card.from', { price })`, ["from"])).toEqual(["from"]);
    expect(plainCalls(`t.rich("from", { price, ltr })`, ["from"])).toEqual([]);
    expect(plainCalls(`params.get("from")`, ["from"])).toEqual([]);
  });

  it("renders every tagged message through t.rich in the source", () => {
    const src = join(import.meta.dirname, "..");
    const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter(
      (file) => /\.tsx?$/.test(file) && !/\.(test|spec)\.tsx?$/.test(file),
    );
    const offenders = files.flatMap((file) =>
      plainCalls(readFileSync(join(src, file), "utf8"), leafKeys).map((leaf) => `${file}: ${leaf}`),
    );

    expect(leafKeys).toContain("from");
    expect(offenders).toEqual([]);
  });
});
