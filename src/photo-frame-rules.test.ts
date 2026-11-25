import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// covers: scope feature 44 (whole product photos in every frame). A product photo is never cropped
// to its frame: every product frame draws it with `object-contain`, and `object-cover` stays on the
// frames that keep a chosen crop (category cards and banners). A tile inside a table also carries
// `max-w-none`, or the global `img { max-width: 100% }` shrinks it to nothing once the table is
// wider than its scroll box on a phone. Planted fixtures are built from string pieces so this file
// never flags itself.

const srcDir = join(process.cwd(), "src");

/** The frames that crop on purpose: a category's 1:1 upload shown 4:5 or 4:3, and the banners. */
const croppedFrames: ReadonlySet<string> = new Set([
  "app/[locale]/c/(index)/page.tsx",
  "features/home/components/category-cards.tsx",
  "features/home/components/banner-carousel.tsx",
  "features/home/components/home-image-field.tsx",
  "features/home/components/homepage-editor.tsx",
  // The gallery's 56 px thumbnail strip, unchanged by feature 44 (the main photo is contained).
  "features/catalog/components/product-gallery.tsx",
]);

/** Every frame that shows a product photo, in the storefront and the dashboard. */
const productFrames: readonly string[] = [
  "features/catalog/components/product-card.tsx",
  "features/home/components/hero-coverflow.tsx",
  "app/[locale]/cart/page.tsx",
  "features/orders/components/order-summary.tsx",
  "features/drafts/components/product-combobox.tsx",
  "features/home/components/product-picker.tsx",
  "app/admin/(dashboard)/products/page.tsx",
  "features/catalog/components/media-section.tsx",
];

/** The big frames, where the space beside a tall or wide photo shows: they fill it with its colour. */
const colourFilledFrames: readonly string[] = [
  "features/catalog/components/product-card.tsx",
  "features/home/components/hero-coverflow.tsx",
  "features/catalog/components/product-gallery.tsx",
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[\s;{}()])\/\/.*$/gm, "$1");
}

function componentFiles(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return componentFiles(path);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

const posix = (path: string) => relative(srcDir, path).split("\\").join("/");
const read = (file: string) => stripComments(readFileSync(join(srcDir, file), "utf8"));

const COVER = "object-" + "cover";
const CONTAIN = "object-" + "contain";

/** Each `<Image` or `<img` element's text, from its opening bracket to its closing one. */
function imageElements(code: string): readonly string[] {
  return code.match(/<(?:Image|img)\b[^>]*>/g) ?? [];
}

/** An image element inside a table cell must carry `max-w-none`. */
function tableTilesWithoutMaxWidthNone(code: string): readonly string[] {
  if (!code.includes("<TableCell")) return [];
  return imageElements(code).filter((element) => !element.includes("max-w-none"));
}

describe("photo frame rules: planted fixtures", () => {
  it("catches a cropped product photo", () => {
    expect(imageElements(`<Image src={k} className="${COVER}" />`).join()).toContain(COVER);
  });

  it("catches a table tile without max-w-none, and accepts one with it", () => {
    const cell = (className: string) =>
      `<TableCell><Image src={k} width={44} height={44} className="${className}" /></TableCell>`;
    expect(tableTilesWithoutMaxWidthNone(cell(`size-11 ${CONTAIN}`))).toHaveLength(1);
    expect(tableTilesWithoutMaxWidthNone(cell(`size-11 max-w-none ${CONTAIN}`))).toHaveLength(0);
  });

  it("ignores an image outside a table", () => {
    expect(tableTilesWithoutMaxWidthNone(`<Image src={k} className="${CONTAIN}" />`)).toHaveLength(
      0,
    );
  });
});

describe("photo frame rules: the source", () => {
  const files = componentFiles(srcDir).map(posix);

  it("lists every frame that crops on purpose, and nothing else crops", () => {
    const cropping = files.filter((file) => read(file).includes(COVER));
    expect(cropping.sort()).toEqual([...croppedFrames].sort());
  });

  it.each(productFrames)("%s draws the product photo whole", (file) => {
    const code = read(file);
    expect(code).toContain(CONTAIN);
    expect(code).not.toContain(COVER);
  });

  it.each(colourFilledFrames)("%s fills the space beside the photo with its colour", (file) => {
    expect(read(file)).toMatch(/<PhotoColour\s[^>]*imageKey=/);
  });

  it("gives every image tile inside a table its own width", () => {
    const offenders = files.flatMap((file) =>
      tableTilesWithoutMaxWidthNone(read(file)).map(
        (element) => `${file}: ${element.slice(0, 60)}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
