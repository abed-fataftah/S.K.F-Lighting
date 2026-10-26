import { expect, test, type Locator } from "@playwright/test";
import {
  expectFocusOutline,
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";

// covers: AC-11 to AC-17, AC-20 (spec 0003): the storefront shell on the real home page.
// Runs at 390x844 (phone) and 1280 (desktop).

test.beforeEach(async ({ page }, testInfo) => {
  await usePhoneWidth(page, testInfo);
  await page.goto("/");
});

const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error("element has no box");
  return result;
}

test.describe("storefront shell", () => {
  test("passes axe, keeps targets at 44, and never scrolls sideways", async ({ page }) => {
    await expectNoAxeViolations(page);
    await expectTouchTargets(page);
    await expectNoSidewaysScroll(page);
  });

  test("puts the page in one centered column at most 480 wide", async ({ page }) => {
    const main = await box(page.locator("main#main"));
    const width = page.viewportSize()!.width;
    expect(main.width).toBeLessThanOrEqual(480);
    expect(Math.abs(main.x + main.width / 2 - width / 2)).toBeLessThan(1);
  });

  // covers: AC-5, AC-11, AC-20
  test("starts with the skip link, then the menu button with a yellow outline", async ({
    page,
  }) => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "تخطي إلى المحتوى" });
    await expect(skip).toBeFocused();

    await page.keyboard.press("Tab");
    await expectFocusOutline(page.getByRole("button", { name: "القائمة" }), "yellow");

    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("outlines the search box, not the field inside it, on keyboard focus", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: "ابحث في المتجر" });
    await search.focus();
    const box = page.locator("label", { has: search });
    await expect(box).toHaveCSS("outline-style", "solid");
    await expect(box).toHaveCSS("outline-color", "rgb(252, 244, 44)");
  });

  // covers: AC-12
  test("shows the header with the logo link home, the cart, and the info strip on /", async ({
    page,
  }) => {
    const header = page.locator("header").first();
    await expect(header.getByRole("link", { name: "S.K.F lighting" })).toHaveAttribute("href", "/");
    await expect(header.getByRole("link", { name: "السلة", exact: true })).toHaveAttribute(
      "href",
      "/cart",
    );
    await expect(page.getByText("توصيل: الضفة ₪20 · الداخل ₪70")).toBeVisible();
  });

  test("submits the search as GET /search?q=", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: "ابحث في المتجر" });
    await search.fill("ثريا ذهبية");
    await search.press("Enter");
    await page.waitForURL(/\/search\?/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("q")).toBe("ثريا ذهبية");
  });

  test("allows an empty search, which goes to /search", async ({ page }) => {
    await page.getByRole("button", { name: "بحث", exact: true }).click();
    await page.waitForURL(/\/search/);
    expect(new URL(page.url()).pathname).toBe("/search");
  });

  // covers: AC-13
  test("opens the menu with the tab links, the policies, and WhatsApp, and returns focus", async ({
    page,
  }) => {
    const menu = page.getByRole("button", { name: "القائمة" });
    await menu.click();
    const sheet = page.getByRole("dialog", { name: "القائمة" });
    await expect(sheet.getByRole("button", { name: "إغلاق" })).toBeFocused();

    // The shop's categories in navigation sit between the tabs and the policies (spec 0008
    // AC-14); which ones depends on the data, so the fixed links are checked around them.
    const links = sheet.getByRole("link");
    const categories = sheet.getByTestId("menu-categories").getByRole("link");
    const texts = await links.allTextContents();
    const categoryTexts = await categories.allTextContents();
    expect(texts.filter((text) => !categoryTexts.includes(text))).toEqual([
      "الرئيسية",
      "الأقسام",
      "السلة",
      "بحث",
      "حسابي",
      "سياسة الخصوصية",
      "الشروط والأحكام",
      "سياسة الإرجاع",
      "تواصل معنا عبر واتساب",
    ]);
    expect(texts.slice(5, 5 + categoryTexts.length)).toEqual(categoryTexts);
    const whatsapp = new URL((await links.last().getAttribute("href"))!);
    expect(whatsapp.searchParams.get("text")).toBe("مرحباً S.K.F lighting، أريد الاستفسار.");

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(menu).toBeFocused();
  });

  // covers: AC-16
  test("marks الرئيسية as the current tab on /", async ({ page }) => {
    const bar = page.getByRole("navigation", { name: "التنقل الرئيسي" });
    await expect(bar.getByRole("link")).toHaveText([
      "الرئيسية",
      "الأقسام",
      "السلة",
      "بحث",
      "حسابي",
    ]);
    await expect(bar.getByRole("link", { name: "الرئيسية" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(bar.locator("[aria-current]")).toHaveCount(1);
    await expect(bar.getByRole("link", { name: "حسابي" })).toHaveAttribute(
      "href",
      "/account/orders",
    );
  });

  // covers: AC-17
  test("opens WhatsApp from the float with W1 and the configured number", async ({ page }) => {
    const fab = page.getByRole("link", { name: "واتساب", exact: true });
    await expect(fab).toHaveAttribute("target", "_blank");
    await expect(fab).toHaveAttribute("rel", "noopener");
    const href = new URL((await fab.getAttribute("href"))!);
    expect(href.origin + href.pathname).toBe("https://wa.me/970500000000");
    expect(href.searchParams.get("text")).toBe("مرحباً S.K.F lighting، أريد الاستفسار.");
  });

  // covers: AC-11
  test("keeps every footer link clear of the float and the bar at the end of the page", async ({
    page,
  }) => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const fab = await box(page.getByRole("link", { name: "واتساب", exact: true }));
    const bar = await box(page.getByRole("navigation", { name: "التنقل الرئيسي" }));
    const footerLinks = page.locator("footer").getByRole("link");
    await expect(footerLinks).toHaveCount(3);
    for (const link of await footerLinks.all()) {
      const linkBox = await box(link);
      expect(overlaps(linkBox, fab)).toBe(false);
      expect(overlaps(linkBox, bar)).toBe(false);
    }
  });

  test("scrolls a focused field clear of the bottom bar", async ({ page }) => {
    await expect(page.locator("html")).toHaveCSS("scroll-padding-bottom", "64px");
  });
});

// covers: AC-13, AC-21
test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shows the menu without sliding", async ({ page }) => {
    await page.getByRole("button", { name: "القائمة" }).click();
    await expect(page.getByRole("dialog", { name: "القائمة" })).toHaveCSS(
      "transition-duration",
      "0s",
    );
  });
});
