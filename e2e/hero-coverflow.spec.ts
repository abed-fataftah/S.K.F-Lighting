import { expect, test, type Page } from "@playwright/test";
import {
  expectFocusOutline,
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";

// covers: AC-3 to AC-10, AC-13 (spec 0030); AC-5 to AC-10, AC-15 (spec 0032): the hero coverflow on the phone, tablet, and desktop
// projects, against whatever Home shows (the picks, else the newest products). It needs three or
// more products and changes nothing; the homepage flow covers the picks, the small counts, the
// banners under the hero, and the fallback card.

const cardWidth: Readonly<Record<string, number>> = { phone: 220, tablet: 260, desktop: 300 };

test.beforeEach(async ({ page }, testInfo) => {
  await usePhoneWidth(page, testInfo);
});

/** Opens Home and skips when the coverflow has fewer than three products. */
async function openHome(page: Page) {
  await page.goto("/");
  // Home streams behind loading.tsx: at load the hero can still wait in React's hidden container,
  // where boundingBox() gives null.
  await expect(page.getByTestId("home-hero")).toBeVisible({ timeout: 15_000 });
  const list = page.getByTestId("home-products");
  const count = await list.locator("li").count();
  test.skip(count < 3, "needs three or more products on Home");
  return { list, count };
}

/** The name on the centred product's dot: "المنتج N من M: <name>". */
const centredLabel = (page: Page) =>
  page.getByTestId("hero-dots").locator("[aria-current=true]").getAttribute("aria-label");

const visibleCards = (list: ReturnType<Page["getByTestId"]>) =>
  list
    .locator("li")
    .evaluateAll(
      (items) => items.filter((li) => getComputedStyle(li).visibility === "visible").length,
    );

test("places the centre card and its neighbours for the width", async ({ page }, testInfo) => {
  const { list, count } = await openHome(page);
  const project = testInfo.project.name;
  const hero = page.getByTestId("home-hero");

  // One h1, the hero headline (AC-1); the centre card's width per breakpoint (AC-10).
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText(/الإضاءة المناسبة/);
  const link = list.getByRole("link");
  await expect(link).toHaveCount(1);
  expect(Math.round((await link.boundingBox())!.width)).toBe(cardWidth[project]);

  // One neighbour each side below lg, two from lg (AC-4); the rest hidden.
  expect(await visibleCards(list)).toBe(Math.min(count, project === "desktop" ? 5 : 3));

  // The hero is white, and line 2 sits on the brand marker under ink text (spec 0032 AC-5, AC-6).
  await expect(hero).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const line2 = page.locator("h1 span").nth(1);
  await expect(line2).toHaveCSS("background-color", "rgb(247, 147, 30)");
  await expect(line2).toHaveCSS("color", "rgb(17, 17, 17)");

  // The band spans the screen from md; on a phone the card keeps the column's side margins, and
  // at least a quarter of each neighbour shows inside it (AC-3, AC-4).
  const heroBox = (await hero.boundingBox())!;
  if (project === "phone") {
    expect(Math.round(heroBox.width)).toBe(390 - 32);
    const items = list.locator("li");
    for (const index of [1, count - 1]) {
      const box = (await items.nth(index).boundingBox())!;
      const shown =
        Math.min(box.x + box.width, heroBox.x + heroBox.width) - Math.max(box.x, heroBox.x);
      expect(shown).toBeGreaterThanOrEqual(box.width / 4);
      expect(shown).toBeLessThan(box.width);
    }
  } else {
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(Math.round(heroBox.width)).toBe(clientWidth);
  }

  // The centre image, when there is one, names its widths (AC-13) and the arrows show from lg.
  const image = link.locator('img:not([data-testid="photo-colour"])');
  if (await image.count()) {
    await expect(image).toHaveAttribute(
      "sizes",
      "(min-width: 1024px) 300px, (min-width: 768px) 260px, 220px",
    );
  }
  await expect(hero.getByRole("button", { name: "المنتج التالي" })).toBeVisible({
    visible: project === "desktop",
  });

  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
});

// The token values as the browser computes them (tokens.css).
const rgb = {
  white: "rgb(255, 255, 255)",
  ink: "rgb(17, 17, 17)",
  muted: "rgb(85, 85, 85)",
  page: "rgb(245, 245, 243)",
  brand: "rgb(247, 147, 30)",
  controlBorder: "rgb(138, 138, 132)",
} as const;

test("draws the side cards, centre words, dots, arrows, and buttons for the white surface", async ({
  page,
}, testInfo) => {
  // covers: AC-7, AC-8, AC-9, AC-10 (spec 0032)
  const { list } = await openHome(page);
  const hero = page.getByTestId("home-hero");

  // A side card fades toward white, not black (AC-7): its tint layer is white and shows.
  const tints = await list
    .locator("li")
    .nth(1)
    .locator("[role=group] span[aria-hidden]")
    .evaluateAll((spans) =>
      spans.map((span) => {
        const style = getComputedStyle(span);
        return { bg: style.backgroundColor, opacity: Number(style.opacity) };
      }),
    );
  const shown = tints.filter((tint) => tint.opacity > 0 && tint.bg !== "rgba(0, 0, 0, 0)");
  expect(shown.length).toBeGreaterThan(0);
  expect(shown.every((tint) => tint.bg === rgb.white)).toBe(true);

  // The centre card's name is ink; its price is ink, or grey when out of stock (AC-8).
  const link = list.getByRole("link");
  const price = link.getByTestId("hero-price");
  const name = price.locator("xpath=preceding-sibling::span");
  await expect(name).toHaveCSS("color", rgb.ink);
  const outOfStock = await link.getByText("غير متوفر").count();
  await expect(price).toHaveCSS("color", outOfStock ? rgb.muted : rgb.ink);

  // The centred dot is orange with an ink edge; the others have the grey control edge (AC-9).
  const dots = page.getByTestId("hero-dots").getByRole("button");
  const current = dots.nth(0).locator("span");
  await expect(current).toHaveCSS("background-color", rgb.brand);
  await expect(current).toHaveCSS("border-top-color", rgb.ink);
  await expect(dots.nth(1).locator("span")).toHaveCSS("border-top-color", rgb.controlBorder);

  // Inside the white hero the focus outline is the ink one of light surfaces, not orange (AC-9).
  await dots.nth(1).focus();
  await expectFocusOutline(dots.nth(1), "ink");

  // The WhatsApp button keeps its green and the 52 high size; "تسوّق المجموعة", when the
  // categories exist, is the brand fill under ink text at the same height (AC-10).
  const whatsapp = hero.getByRole("link", { name: "اطلب استشارة" });
  await expect(whatsapp).toHaveCSS("background-color", "rgb(30, 123, 79)");
  expect(Math.round((await whatsapp.boundingBox())!.height)).toBe(52);
  const shop = hero.getByRole("link", { name: "تسوّق المجموعة" });
  if (await shop.count()) {
    await expect(shop).toHaveCSS("background-color", rgb.brand);
    await expect(shop).toHaveCSS("color", rgb.ink);
    expect(Math.round((await shop.boundingBox())!.height)).toBe(52);
  }

  // From lg the arrows are white 44 by 44 circles with a grey edge and ink chevrons, page grey on
  // hover (AC-9).
  if (testInfo.project.name === "desktop") {
    const next = hero.getByRole("button", { name: "المنتج التالي" });
    await expect(next).toHaveCSS("background-color", rgb.white);
    await expect(next).toHaveCSS("border-top-color", rgb.controlBorder);
    await expect(next).toHaveCSS("color", rgb.ink);
    const box = (await next.boundingBox())!;
    expect([Math.round(box.width), Math.round(box.height)]).toEqual([44, 44]);
    await next.hover();
    await expect(next).toHaveCSS("background-color", rgb.page);
  }
});

test("moves one step on a swipe, centres a side card on a tap, and opens the centred product", async ({
  page,
}) => {
  const { list, count } = await openHome(page);
  const first = await centredLabel(page);

  // A drag to the left (any pointer) brings the card on the physical left in (AC-6).
  const box = (await list.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 80;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 40, y, { steps: 4 });
  await page.mouse.move(x - 90, y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => centredLabel(page)).not.toBe(first);
  // The drag never opened the product it started on.
  await expect(page).toHaveURL(/\/$/);

  // A tap on a side card centres it: the one on the inline end (the next product, physical left).
  const centre = await list
    .locator("li")
    .evaluateAll((items) => items.findIndex((li) => !!li.querySelector("a")));
  const next = (centre + 1) % count;
  await list.locator("li").nth(next).locator("[role=group]").click({ force: true });
  await expect(list.locator("li").nth(next).getByRole("link")).toHaveCount(1);
  await expect(page.getByTestId("home-hero").locator("[aria-live=polite]")).toContainText(
    "المنتج في المنتصف",
  );

  // The centre link opens its product page (AC-5).
  const name = (await list.getByRole("link").locator("span").first().textContent()) ?? "";
  await list.getByRole("link").click();
  await expect(page).toHaveURL(/\/p\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name.trim());
});

test("moves with the arrow keys and the dots, with focus following the centre", async ({
  page,
}, testInfo) => {
  const { list, count } = await openHome(page);
  const hero = page.getByTestId("home-hero");
  const dots = page.getByTestId("hero-dots").getByRole("button");
  await expect(dots).toHaveCount(count);
  await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");

  // The left key brings the card on the physical left (the next product in right to left) in,
  // and the centre link keeps focus (AC-5, AC-6).
  await list.getByRole("link").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
  await expect(list.getByRole("link")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(dots.nth(count - 1)).toHaveAttribute("aria-current", "true");
  // A key with a modifier is the browser's.
  await page.keyboard.press("Shift+ArrowRight");
  await expect(dots.nth(count - 1)).toHaveAttribute("aria-current", "true");

  // A dot goes to its product the shortest way round (AC-8).
  await dots.nth(2).click();
  await expect(dots.nth(2)).toHaveAttribute("aria-current", "true");
  await expect(list.locator("li").nth(2).getByRole("link")).toHaveCount(1);

  if (testInfo.project.name === "desktop") {
    // The arrows, from lg: next steps on, previous steps back (AC-6).
    await hero.getByRole("button", { name: "المنتج التالي" }).click();
    await expect(dots.nth(3 % count)).toHaveAttribute("aria-current", "true");
    await hero.getByRole("button", { name: "المنتج السابق" }).click();
    await expect(dots.nth(2)).toHaveAttribute("aria-current", "true");
  }
  await expectNoAxeViolations(page);
});

test("lands a step at once under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { list } = await openHome(page);
  const dots = page.getByTestId("hero-dots").getByRole("button");
  await dots.nth(1).click();
  // Read right after the click: with no transition the new centre already sits in place (AC-7).
  const transform = await list
    .locator("li")
    .nth(1)
    .evaluate((li) => getComputedStyle(li).transform);
  expect(transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
  await expect(list.locator("li").nth(1).getByRole("link")).toHaveCount(1);
});
