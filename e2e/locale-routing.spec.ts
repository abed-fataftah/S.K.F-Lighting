import { expect, test } from "@playwright/test";

// covers: DW-2 (spec 0001 verify.md, UI steps). Runs on a phone and a desktop viewport.
// The shop is Arabic only: there is no English site and no language switch.

const pathOf = (location: string | undefined) =>
  new URL(location ?? "", "http://localhost").pathname;

test.describe("Arabic storefront", () => {
  test("serves the Arabic home at / laid out right to left", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: "أحدث المنتجات" })).toBeVisible();
    await expect(
      page.getByText("ثريات، أباجورات، ومواد كهربائية من معرضنا، تصلك أينما كنت."),
    ).toBeVisible();
    await expect(page).toHaveTitle("S.K.F للإنارة");
  });

  test.describe("for a phone set to English", () => {
    test.use({ locale: "en-US" });

    test("still shows Arabic at /, with no redirect", async ({ page }) => {
      await page.goto("/");

      expect(new URL(page.url()).pathname).toBe("/");
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    });
  });

  test("stays Arabic at / even with a NEXT_LOCALE=en cookie left over from an old visit", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL! }]);

    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  });

  test("offers no language switch", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "English" })).toHaveCount(0);
  });

  test("redirects /ar to / because Arabic has no prefix", async ({ request }) => {
    const response = await request.get("/ar", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(pathOf(response.headers()["location"])).toBe("/");
  });

  test("has no English site at /en", async ({ page }) => {
    const response = await page.goto("/en");

    expect(response?.status()).toBe(404);
    await expect(page.getByText("الصفحة غير موجودة")).toBeVisible();
  });
});

test.describe("routes outside the storefront", () => {
  // The dashboard exists since spec 0004: a signed out visitor goes to its sign in page.
  test("leaves /admin to its own routes: no locale rewrite, signed out goes to sign in", async ({
    request,
  }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });

    expect(response.headers()["x-middleware-rewrite"]).toBeUndefined();
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toMatch(/^\/admin\/login(\?|$)/);
  });

  test("shows the Arabic not found page, right to left, for an unknown path", async ({ page }) => {
    const response = await page.goto("/no-such-page");

    expect(response?.status()).toBe(404);
    await expect(page.getByText("الصفحة غير موجودة")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("serves /favicon.ico directly as an image", async ({ request }) => {
    const response = await request.get("/favicon.ico", { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^image\//);
  });
});
