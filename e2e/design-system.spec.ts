import { expect, test } from "@playwright/test";
import {
  expectFocusOutline,
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";

// covers: AC-4, AC-5, AC-19, AC-20 (spec 0003). Runs at 390x844 (phone) and 1280 (desktop).
// Needs DESIGN_SYSTEM_PAGE=1 (.env.local for `pnpm dev`, .dev.vars for `pnpm preview`).

test.beforeEach(async ({ page }, testInfo) => {
  await usePhoneWidth(page, testInfo);
  await page.goto("/design-system");
});

test.describe("design system gallery", () => {
  test("renders in Arabic, right to left, in Almarai, and is not indexed", async ({ page }) => {
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "ar");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: "نظام التصميم" })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("font-family", /Almarai/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("shows every contrast pair, every type role, and the button matrix", async ({ page }) => {
    await expect(page.locator("#colours li")).toHaveCount(18);
    await expect(page.locator("#type li")).toHaveCount(14);
    await expect(page.getByRole("button", { name: "متابعة الطلب" })).toHaveCount(5);
    await expect(page.getByRole("button", { name: "أضف للسلة" }).last()).toBeDisabled();
  });

  test("passes axe for WCAG 2.1 A and AA", async ({ page }) => {
    await expectNoAxeViolations(page);
  });

  test("keeps every tappable element at least 44 by 44", async ({ page }) => {
    await expectTouchTargets(page);
  });

  test("never scrolls sideways", async ({ page }) => {
    await expectNoSidewaysScroll(page);
  });

  test("starts tabbing at the skip link, which moves focus to main", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "تخطي إلى المحتوى" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
    await expect(page.locator("main#main")).toHaveCSS("outline-style", "none");
  });

  test("draws a yellow focus outline on black and an ink one on light", async ({ page }) => {
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expectFocusOutline(page.getByRole("link", { name: "الألوان وتباينها" }), "yellow");

    const button = page.getByRole("button", { name: "متابعة الطلب" }).first();
    await button.focus();
    // Programmatic focus after a key press still counts as keyboard focus.
    await expectFocusOutline(button, "ink");
  });

  test("uses no colour scheme switch: the page stays light in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(245, 245, 243)");
  });
});

test.describe("gallery primitives", () => {
  // covers: AC-8
  test("shows a field error with a danger border, aria-invalid, and a linked alert", async ({
    page,
  }) => {
    const input = page.getByLabel("رقم الهاتف").and(page.locator("[aria-invalid=true]"));
    await expect(input).toHaveAttribute("aria-describedby", "ds-phone-bad-error");
    await expect(input).toHaveCSS("border-top-color", "rgb(179, 38, 30)");
    const error = page.locator("#ds-phone-bad-error");
    await expect(error).toHaveAttribute("role", "alert");
    await expect(error).toHaveText("أدخل رقم هاتف صحيح.");
    await expect(error).toHaveCSS("font-weight", "700");
    await expect(error.locator("svg")).toHaveCount(1);
  });

  // covers: AC-7, AC-13 (sheet behaviour)
  test("opens the sheet with focus on close, traps it, and returns it on Escape", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: "افتح اللوحة" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "القائمة" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "إغلاق" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "إغلاق" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("anchors the sheet to the inline start edge (the right, in Arabic)", async ({ page }) => {
    await page.getByRole("button", { name: "افتح اللوحة" }).click();
    const dialog = page.getByRole("dialog", { name: "القائمة" });
    await expect(dialog).toBeVisible();
    const width = page.viewportSize()!.width;
    // Wait for the slide to finish, then the panel's end edge sits on the right edge.
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return Math.round(box!.x + box!.width);
      })
      .toBe(width);
  });
});

test.describe("gallery custom controls", () => {
  // covers: AC-9
  test("marks a chosen chip with aria-pressed and a check, and an unavailable one in words", async ({
    page,
  }) => {
    const group = page.getByRole("group", { name: "الحجم" });
    const chosen = group.getByRole("button", { name: "60 سم" });
    await expect(chosen).toHaveAttribute("aria-pressed", "true");
    await expect(chosen.locator("svg")).toBeVisible();

    const other = group.getByRole("button", { name: "40 سم" });
    await expect(other.locator("svg")).toBeHidden();
    await other.click();
    await expect(other).toHaveAttribute("aria-pressed", "true");
    await expect(chosen).toHaveAttribute("aria-pressed", "false");

    const unavailable = group.getByRole("button", { name: /80 سم/ });
    await expect(unavailable).toBeDisabled();
    await expect(unavailable).toContainText("غير متوفر");
  });

  test("removes an applied filter by its named button", async ({ page }) => {
    const remove = page.getByRole("button", { name: "إزالة ذهبي" });
    await remove.click();
    await expect(remove).toHaveCount(0);
    await expect(page.getByRole("button", { name: "إزالة متوفر فقط" })).toBeVisible();
  });

  test("selects a radio card without shifting its size", async ({ page }) => {
    const card = page.locator('#controls [data-slot="check-row"]').filter({ hasText: "توصيل" });
    const delivery = card.getByRole("radio");
    const before = await card.boundingBox();
    await delivery.click();
    await expect(delivery).toHaveAttribute("aria-checked", "true");
    await expect(card).toHaveCSS("border-top-width", "2px");
    await expect(card).toHaveCSS("background-color", "rgb(255, 246, 208)");
    const after = await card.boundingBox();
    expect(after!.height).toBe(before!.height);
  });

  test("steps, clamps typed values, and keeps focus on a limit button", async ({ page }) => {
    const stepper = page.locator('[data-slot="quantity-stepper"]').first();
    const value = stepper.getByRole("textbox", { name: "الكمية" });
    const minus = stepper.getByRole("button", { name: "إنقاص الكمية" });
    const plus = stepper.getByRole("button", { name: "زيادة الكمية" });

    await expect(value).toHaveValue("1");
    await expect(value).toHaveAttribute("aria-live", "polite");
    await expect(value).toHaveAttribute("inputmode", "numeric");
    await expect(minus).toHaveAttribute("aria-disabled", "true");
    await minus.focus();
    await page.keyboard.press("Enter");
    await expect(value).toHaveValue("1");
    await expect(minus).toBeFocused();

    await plus.click();
    await expect(value).toHaveValue("2");

    await value.fill("150");
    await value.press("Enter");
    await expect(value).toHaveValue("99");
    await expect(plus).toHaveAttribute("aria-disabled", "true");

    await value.fill("abc");
    await value.blur();
    await expect(value).toHaveValue("99");

    await value.fill("0");
    await value.blur();
    await expect(value).toHaveValue("1");
  });

  // covers: AC-9, AC-17
  test("shows the error card as an alert with retry and a WhatsApp link", async ({ page }) => {
    const card = page.locator('[data-slot="error-state"]');
    await expect(card).toHaveAttribute("role", "alert");
    await expect(card.getByRole("button", { name: "إعادة المحاولة" })).toBeVisible();
    const whatsapp = card.getByRole("link", { name: "اطلب عبر واتساب" });
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    await expect(whatsapp).toHaveAttribute("rel", "noopener");
    const href = new URL((await whatsapp.getAttribute("href"))!);
    expect(href.origin + href.pathname).toBe("https://wa.me/970500000000");
    expect(href.searchParams.get("text")).toBe("مرحباً، لم أجد ما أبحث عنه وأحتاج مساعدة.");
  });

  test("announces loading in a hidden status sentence", async ({ page }) => {
    await expect(page.getByRole("status").filter({ hasText: "جارٍ تحميل المنتجات" })).toHaveCount(
      1,
    );
  });

  // covers: AC-10
  test("flips the directional icons in right to left", async ({ page }) => {
    const icon = page.locator('[data-testid="icons-flip"] svg').first();
    await expect(icon).toHaveCSS("scale", "-1 1");
  });
});

test.describe("gallery shell parts", () => {
  // covers: AC-14
  test("names the cart with its count in Arabic and shows a hidden badge", async ({ page }) => {
    const header = page.getByTestId("header-with-count");
    const cart = header.getByRole("link", { name: "السلة، 3 منتجات" });
    await expect(cart).toBeVisible();
    const badge = cart.locator('[data-slot="badge"]');
    await expect(badge).toHaveText("3");
    await expect(badge).toHaveAttribute("aria-hidden", "true");
    await expect(badge).toHaveCSS("background-color", "rgb(252, 244, 44)");
  });

  // covers: AC-15
  test("shows the phone left to right with the address, and hides an empty line", async ({
    page,
  }) => {
    const line = page.locator('[data-testid="footer-contact"]').first();
    await expect(line).toHaveText("0599 123 456 · نابلس، شارع فيصل");
    await expect(line.locator("bdi")).toHaveAttribute("dir", "ltr");
    await expect(
      page.getByTestId("footer-no-contact").locator('[data-testid="footer-contact"]'),
    ).toHaveCount(0);
    for (const link of await page.locator("footer").getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  // covers: AC-18
  test("marks the current dashboard link and wraps the sidebar on a phone", async ({
    page,
  }, testInfo) => {
    const frame = page.getByTestId("dashboard-frame");
    const nav = frame.getByRole("navigation", { name: "لوحة التحكم" });
    await expect(nav.getByRole("link")).toHaveCount(8);
    const current = nav.getByRole("link", { name: "الطلبات" });
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(nav.locator("[aria-current]")).toHaveCount(1);
    await expect(frame.getByRole("link", { name: "عرض المتجر" })).toHaveAttribute("href", "/");

    const side = (await frame.locator("aside").boundingBox())!;
    const content = (await frame.locator("aside + div").boundingBox())!;
    if (testInfo.project.name === "desktop") {
      expect(Math.abs(side.y - content.y)).toBeLessThan(1);
    } else {
      expect(content.y).toBeGreaterThanOrEqual(side.y + side.height - 1);
    }
  });
});

// covers: AC-21
test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("keeps the skeleton still and the sheet from sliding", async ({ page }) => {
    const block = page.locator('[data-testid="skeleton-sample"] [data-slot="skeleton"]').first();
    await expect(block).toHaveCSS("animation-duration", "0s");

    await page.getByRole("button", { name: "افتح اللوحة" }).click();
    await expect(page.getByRole("dialog")).toHaveCSS("transition-duration", "0s");
  });
});

test("returns 404 for the gallery path with a trailing segment that does not exist", async ({
  request,
}) => {
  const response = await request.get("/design-system/nothing-here");
  expect(response.status()).toBe(404);
});
