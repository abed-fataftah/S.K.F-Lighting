import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { adminAccounts, serviceClient } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: scope feature 44 (whole product photos in every frame) on the phone, tablet, and desktop
// projects. A tall 1:2 photo (a shape no frame has at any width) is uploaded for real, so the browser gets what
// Supabase renders: the category card and the cart tile receive it whole, at its own ratio, and
// draw it contained; the hero's photos arrive at the ratio their rows store; an out of stock card
// fades the photo while its frame keeps the product tone.

const accounts = adminAccounts();
// With the worker's pid, as accounts.ts does: the phone, tablet, and desktop workers each load
// this file, and two of them can start in the same millisecond.
const tag = `${Date.now().toString(36)}${process.pid.toString(36)}`;
const CODE = `WHOLE-E2E-${tag.toUpperCase()}`;
const categorySlug = `whole-e2e-${tag}`;
const LAMP = `ثريا طويلة ${tag}`;
const OUT = `ثريا منتهية ${tag}`;
const PHOTO = { width: 300, height: 600 } as const;
const keys: string[] = [];

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

/** A plain tall JPEG the render endpoint can resize. */
const tallPhoto = () =>
  sharp({ create: { ...PHOTO, channels: 3, background: { r: 230, g: 140, b: 20 } } })
    .jpeg({ quality: 80 })
    .toBuffer();

test.beforeAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    const [category] = await sql<{ id: string }[]>`
      insert into categories (name, slug) values (${`عريض ${tag}`}, ${categorySlug}) returning id`;
    const photo = await tallPhoto();
    const storage = serviceClient().storage.from("product-media");
    for (const [name, code, available] of [
      [LAMP, CODE, true],
      [OUT, `${CODE}-OUT`, false],
    ] as const) {
      // Dated in the past, so they never lead Home's newest products, which other flows add from.
      const [product] = await sql<{ id: string }[]>`
        insert into products (category_id, code, name, slug, is_available, created_at)
        values (${category.id}, ${code}, ${name}, ${code.toLowerCase()}, ${available},
                now() - interval '10 years')
        returning id`;
      await sql`
        insert into product_variants (product_id, price, is_default)
        values (${product.id}, ${12_000}, true)`;
      const key = `products/${product.id}/e2e-tall.jpg`;
      const { error } = await storage.upload(key, photo, { contentType: "image/jpeg" });
      if (error) throw new Error(`Could not upload the test photo: ${error.message}`);
      keys.push(key);
      await sql`
        insert into product_media (product_id, kind, storage_key, width, height, sort)
        values (${product.id}, 'image', ${key}, ${PHOTO.width}, ${PHOTO.height}, 0)`;
    }
  } finally {
    await sql.end();
  }
});

test.afterAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    await sql`delete from products where code like ${`${CODE}%`}`;
    await sql`delete from categories where slug = ${categorySlug}`;
  } finally {
    await sql.end();
  }
  if (keys.length) await serviceClient().storage.from("product-media").remove(keys);
});

/** Waits for the photo to arrive, then reads how the browser received and drew it. */
async function receivedPhoto(img: Locator) {
  await img.scrollIntoViewIfNeeded();
  await expect
    .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 20_000 })
    .toBeGreaterThan(0);
  return img.evaluate((el) => {
    const image = el as HTMLImageElement;
    const box = image.getBoundingClientRect();
    return {
      key: decodeURIComponent(image.currentSrc.replace(/^.*product-media\//, "").split("?")[0]),
      query: image.currentSrc.split("?")[1] ?? "",
      ratio: image.naturalWidth / image.naturalHeight,
      box: { width: box.width, height: box.height },
      objectFit: getComputedStyle(image).objectFit,
    };
  });
}

// The browser reports a photo's natural size in whole numbers after dividing by the srcset
// density, so a small tile's ratio lands a little off; a cropped strip is off by 0.5 or more.
const RATIO_TOLERANCE = 0.08;

/** The photo came whole from Supabase, at the ratio its row stores, and is drawn contained. */
async function expectWhole(img: Locator, ratio: number) {
  const photo = await receivedPhoto(img);
  expect(photo.query).toContain("resize=contain");
  expect(photo.objectFit).toBe("contain");
  expect(Math.abs(photo.ratio - ratio)).toBeLessThan(RATIO_TOLERANCE);
  return photo;
}

const tall = PHOTO.width / PHOTO.height;
const card = (page: Page, name: string) =>
  page.getByTestId("product-card").filter({ hasText: name });

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

/**
 * The frame (the img's own box, since the photo fills it) has a different shape from the photo,
 * so a cover crop would have cut something, and the size `object-fit: contain` draws the photo
 * at fits inside the frame with a band on one axis.
 */
function expectContainedInFrame(photo: {
  readonly box: { readonly width: number; readonly height: number };
  readonly ratio: number;
}) {
  const frameRatio = photo.box.width / photo.box.height;
  expect(Math.abs(frameRatio - photo.ratio)).toBeGreaterThan(0.1);
  const drawnWidth = Math.min(photo.box.width, photo.box.height * photo.ratio);
  const drawnHeight = drawnWidth / photo.ratio;
  expect(drawnWidth).toBeLessThanOrEqual(photo.box.width + 0.5);
  expect(drawnHeight).toBeLessThanOrEqual(photo.box.height + 0.5);
  expect(drawnWidth < photo.box.width - 0.5 || drawnHeight < photo.box.height - 0.5).toBe(true);
}

test("the category card and the cart tile show the whole tall photo", async ({ page }) => {
  await page.goto(`/c/${categorySlug}`);
  const lamp = card(page, LAMP);
  await expect(lamp).toBeVisible();
  const onCard = await expectWhole(lamp.locator("img"), tall);
  expectContainedInFrame(onCard);
  await checkA11y(page);

  await lamp.getByTestId("card-add-to-cart").click();
  await expect(lamp.getByTestId("card-add-to-cart")).toContainText("تمت الإضافة");

  await page.goto("/cart");
  const line = page.getByTestId("cart-lines").getByRole("listitem").filter({ hasText: LAMP });
  await expect(line).toBeVisible();
  expectContainedInFrame(await expectWhole(line.locator("img"), tall));
  await checkA11y(page);
});

test("an out of stock card fades the photo and keeps the tone on its frame", async ({ page }) => {
  await page.goto(`/c/${categorySlug}`);
  const img = card(page, OUT).locator("img");
  await expectWhole(img, tall);
  await expect(img).toHaveCSS("opacity", "0.45");
  await expect(img).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const frameTone = await img.evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor);
  expect(frameTone).not.toBe("rgba(0, 0, 0, 0)");
});

test("the hero's photos arrive at the ratio their rows store", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-hero")).toBeVisible({ timeout: 15_000 });
  // The centred card and its shown neighbours only: a card hidden at the side loads lazily and
  // may never load while it stays hidden.
  const imgs = page
    .getByTestId("home-products")
    .locator("li")
    .filter({ visible: true })
    .locator("img");
  const count = await imgs.count();
  test.skip(count === 0, "no product shown on Home has a photo");
  const sql = localSql();
  try {
    for (let i = 0; i < count; i += 1) {
      const photo = await receivedPhoto(imgs.nth(i));
      const [row] = await sql<{ width: number; height: number }[]>`
        select width, height from product_media where storage_key = ${photo.key}`;
      test.skip(!row?.width || !row.height, "a Home photo has no stored size");
      expect(photo.query).toContain("resize=contain");
      expect(photo.objectFit).toBe("contain");
      expect(Math.abs(photo.ratio - row.width / row.height)).toBeLessThan(RATIO_TOLERANCE);
    }
  } finally {
    await sql.end();
  }
});
