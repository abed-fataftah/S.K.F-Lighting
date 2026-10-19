import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

// Shared checks for spec 0003, AC-20: WCAG AA through axe, 44 by 44 targets,
// no sideways scroll, and a visible focus outline.

// The phone project tests at 390x844, the width the design was drawn for.
export async function usePhoneWidth(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name === "phone") await page.setViewportSize({ width: 390, height: 844 });
}

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
  }));
  expect(summary).toEqual([]);
}

// Every visible interactive element is at least 44 by 44. A checkbox or radio is
// measured by its label row; hidden inputs and a visually hidden skip link are skipped.
export async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() => {
    const selector = [
      "a[href]",
      "button",
      "input:not([type=hidden])",
      "select",
      "textarea",
      "[role=button]",
      "[role=checkbox]",
      "[role=radio]",
      "[role=switch]",
      "[role=tab]",
      // A tab panel is focusable for keyboard reading, not a thing to tap.
      "[tabindex]:not([tabindex='-1']):not([role=tabpanel])",
    ].join(",");
    return [...document.querySelectorAll<HTMLElement>(selector)].flatMap((el) => {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return [];
      let rect = el.getBoundingClientRect();
      // Visually hidden (sr-only) or not rendered: nothing to tap.
      if (rect.width <= 1 || rect.height <= 1) return [];
      const role = el.getAttribute("role") ?? (el as HTMLInputElement).type;
      if (role === "checkbox" || role === "radio") {
        const row = el.closest("label") ?? el.parentElement;
        if (row) rect = row.getBoundingClientRect();
      }
      if (rect.width >= 43.5 && rect.height >= 43.5) return [];
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40);
      return [
        `${el.tagName.toLowerCase()} "${name}" ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      ];
    });
  });
  expect(small).toEqual([]);
}

export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

// The focus outline is 3px solid, ink on light surfaces and yellow inside .on-dark.
export async function expectFocusOutline(target: Locator, colour: "ink" | "yellow") {
  const rgb = colour === "ink" ? "rgb(17, 17, 17)" : "rgb(252, 244, 44)";
  await expect(target).toBeFocused();
  await expect(target).toHaveCSS("outline-style", "solid");
  await expect(target).toHaveCSS("outline-width", "3px");
  await expect(target).toHaveCSS("outline-color", rgb);
}
