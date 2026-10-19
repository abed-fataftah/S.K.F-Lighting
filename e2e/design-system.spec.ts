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
