// `pnpm launch:check --base <url> --order <number> --phone <phone> [--category <slug>]
// [--product <slug>] [--search <text>]`: the phone speed and accessibility bar for the seven
// launch pages (spec 0028 AC-12 to AC-14). Lighthouse's default mobile run (simulated slow 4G, a
// mid range phone CPU) on Playwright's Chromium, 3 runs a page, the median judged against
// LAUNCH_BAR. Reports go to launch-reports/<stamp>/ (git ignored). Only reads, apart from one
// order lookup; never prints the phone. Run it from one place on a stable connection.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type BrowserContext } from "@playwright/test";
import lighthouse from "lighthouse";
import { computeMedianRun } from "lighthouse/core/lib/median-run.js";
import { orderLookupSchema } from "@/features/orders/schemas";
import { parseOrderNumberInput } from "@/features/orders/order-number";
import { judgePage, type PageMetrics, type Verdict } from "@/features/launch/bar";
import { backupStamp } from "@/features/launch/backup";
import {
  DEFAULT_SEARCH,
  launchPages,
  pickFromSitemap,
  type LaunchPage,
} from "@/features/launch/pages";
import messages from "@/i18n/messages/ar.json" with { type: "json" };
import { formatDecimal, formatMs, formatScore } from "@/lib/format";
import { routes } from "@/lib/routes";

const RUNS = 3;

type Lhr = Parameters<typeof computeMedianRun>[0][number];

// Throws rather than exits, so the `finally` blocks still delete both temp profiles.
function stop(message: string): never {
  throw new Error(message);
}

/** A port nothing listens on, for Chromium's debugging endpoint. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error("No free port"))));
    });
  });
}

type Browser = {
  readonly context: BrowserContext;
  readonly port: number;
  readonly profile: string;
};

/**
 * A persistent profile on a known debugging port: Lighthouse only sees the cookies of the
 * browser's own profile, never those of a `newContext()`.
 */
async function openBrowser(): Promise<Browser> {
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), "skf-launch-"));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    args: [`--remote-debugging-port=${port}`],
  });
  return { context, port, profile };
}

async function closeBrowser(browser: Browser) {
  await browser.context.close().catch(() => {});
  rmSync(browser.profile, { recursive: true, force: true });
}

const sameUrl = (a: string, b: string) => new URL(a).toString() === new URL(b).toString();

function metricsOf(lhr: Lhr): PageMetrics {
  const audit = (id: string) => lhr.audits[id]?.numericValue ?? null;
  return {
    lcpMs: audit("largest-contentful-paint"),
    cls: audit("cumulative-layout-shift"),
    tbtMs: audit("total-blocking-time"),
    performance: lhr.categories.performance?.score ?? null,
    accessibility: lhr.categories.accessibility?.score ?? null,
  };
}

type Measured = {
  readonly page: LaunchPage;
  readonly metrics: PageMetrics;
  readonly verdict: Verdict;
};

/** 3 Lighthouse runs of one page, the median judged, its HTML and JSON reports saved. */
async function measure(browser: Browser, page: LaunchPage, reportDir: string): Promise<Measured> {
  const runs: { lhr: Lhr; html: string; json: string }[] = [];
  for (let run = 1; run <= RUNS; run += 1) {
    const result = await lighthouse(page.url, {
      port: browser.port,
      output: ["html", "json"],
      logLevel: "error",
      onlyCategories: ["performance", "accessibility"],
      // The warm pages need the cart and the unlocked order kept (AC-13).
      disableStorageReset: page.group === "warm",
    });
    if (!result) stop(`Lighthouse returned nothing for ${page.key}.`);
    const { lhr } = result;
    if (lhr.runtimeError)
      stop(`Lighthouse could not load ${page.key}: ${lhr.runtimeError.message}`);
    if (
      page.group === "warm" &&
      lhr.finalDisplayedUrl &&
      !sameUrl(lhr.finalDisplayedUrl, page.url)
    ) {
      stop(
        `The ${page.key} page redirected while measuring (to ${new URL(lhr.finalDisplayedUrl).pathname}).`,
      );
    }
    const [html, json] = result.report as string[];
    runs.push({ lhr, html: html!, json: json! });
    console.log(`  ${page.key}: run ${run} of ${RUNS} done`);
  }
  const median = computeMedianRun(runs.map((run) => run.lhr));
  const chosen = runs.find((run) => run.lhr === median) ?? runs[0]!;
  writeFileSync(join(reportDir, `${page.key}.html`), chosen.html);
  writeFileSync(join(reportDir, `${page.key}.json`), chosen.json);
  const metrics = metricsOf(chosen.lhr);
  return { page, metrics, verdict: judgePage(metrics) };
}

/** Stops unless the search shows results: an empty results page measures the wrong thing. */
async function expectSearchResults(browser: Browser, url: string) {
  const tab = await browser.context.newPage();
  try {
    await tab.goto(url, { waitUntil: "load" });
    if (await tab.getByText(messages.Search.emptyText).count()) {
      stop("The search found nothing. Pass --search with a word that finds products.");
    }
  } finally {
    await tab.close();
  }
}

/**
 * Fills the warm profile the way a customer would (AC-13): the product added through its real
 * button, then the order unlocked through the real lookup form.
 */
async function warmUp(
  browser: Browser,
  base: string,
  productUrl: string,
  order: string,
  phone: string,
) {
  const tab = await browser.context.newPage();
  try {
    await tab.goto(productUrl, { waitUntil: "networkidle" });
    // The page opens on the default size and colour, so the button adds that one.
    const add = tab.getByRole("button", { name: messages.Catalog.addToCart, exact: true });
    if (!(await add.count()) || !(await add.isEnabled())) {
      stop(
        "The product page has no add to cart button to press (out of stock?). Pass another --product.",
      );
    }
    await add.click();
    await tab
      .getByRole("link", { name: messages.Catalog.viewCart })
      .waitFor({ timeout: 15_000 })
      .catch(() => stop("Adding to the cart did not finish. Is the product sellable?"));

    await tab.goto(new URL(routes.orderTrack, base).toString(), { waitUntil: "networkidle" });
    await tab.getByLabel(messages.OrderLookup.number).fill(order);
    await tab.getByLabel(messages.OrderLookup.phone).fill(phone);
    const orderUrl = new URL(routes.order(order), base).toString();
    await tab.getByRole("button", { name: messages.OrderLookup.submit }).click();
    const refused = tab
      .getByText(messages.OrderLookup.notFound)
      .or(tab.getByText(messages.OrderLookup.limited));
    // Whichever comes first; a timeout settles to null, so no wait is left to reject unseen.
    await Promise.race([
      tab
        .waitForURL((url) => sameUrl(url.toString(), orderUrl), { timeout: 20_000 })
        .then(
          () => null,
          () => null,
        ),
      refused
        .first()
        .waitFor({ timeout: 20_000 })
        .then(
          () => null,
          () => null,
        ),
    ]);
    const answer = sameUrl(tab.url(), orderUrl)
      ? "open"
      : (await tab.getByText(messages.OrderLookup.notFound).count())
        ? "not found"
        : (await tab.getByText(messages.OrderLookup.limited).count())
          ? "limited (too many lookups, wait a minute)"
          : "no answer";
    if (answer !== "open") stop(`The order lookup did not unlock the order: ${answer}.`);
  } finally {
    await tab.close();
  }
}

/** Every warm page must open as itself: a redirect means an empty cart or a locked order. */
async function expectNoRedirects(browser: Browser, pages: readonly LaunchPage[]) {
  const tab = await browser.context.newPage();
  try {
    for (const page of pages) {
      await tab.goto(page.url, { waitUntil: "load" });
      if (!sameUrl(tab.url(), page.url)) {
        stop(`The ${page.key} page redirected to ${new URL(tab.url()).pathname} before measuring.`);
      }
    }
  } finally {
    await tab.close();
  }
}

const MEASURE_LABEL = {
  lcpMs: "LCP",
  cls: "CLS",
  tbtMs: "TBT",
  performance: "perf",
  accessibility: "a11y",
} as const;

const shown = (value: number | null, format: (n: number) => string) =>
  value === null ? "n/a" : format(value);

function printTable(results: readonly Measured[]) {
  const rows = [
    ["page", "LCP", "CLS", "TBT", "perf", "a11y", "result"],
    ...results.map(({ page, metrics, verdict }) => [
      page.key,
      shown(metrics.lcpMs, formatMs),
      shown(metrics.cls, (n) => formatDecimal(n, 3)),
      shown(metrics.tbtMs, formatMs),
      shown(metrics.performance, formatScore),
      shown(metrics.accessibility, formatScore),
      verdict.pass ? "PASS" : `FAIL (${verdict.failures.map((m) => MEASURE_LABEL[m]).join(", ")})`,
    ]),
  ];
  const widths = rows[0]!.map((_, col) => Math.max(...rows.map((row) => row[col]!.length)));
  const line = (row: readonly string[]) =>
    `| ${row.map((cell, col) => cell.padEnd(widths[col]!)).join(" | ")} |`;
  console.log(line(rows[0]!));
  console.log(`|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`);
  rows.slice(1).forEach((row) => console.log(line(row)));
}

async function targets(values: Record<string, string | undefined>) {
  if (
    !values.base ||
    !URL.canParse(values.base) ||
    !/^https?:$/.test(new URL(values.base).protocol)
  ) {
    stop("Pass --base with the shop's address, like https://example.com or http://localhost:8787.");
  }
  const base = values.base;
  if (!values.order || !values.phone) {
    stop("Pass --order and --phone from the smoke test order: the order page needs a real lookup.");
  }
  const order = parseOrderNumberInput(values.order);
  if (!order) stop("--order is not an order number. Write it as it came, like 26-00123.");
  if (!orderLookupSchema.shape.phone.safeParse(values.phone).success) {
    stop("--phone is not a mobile number the lookup accepts.");
  }

  let category = values.category;
  let product = values.product;
  if (!category || !product) {
    const response = await fetch(new URL("/sitemap.xml", base)).catch(() => null);
    const picked = response?.ok ? pickFromSitemap(await response.text()) : null;
    if (!picked) {
      stop(
        "This host has no sitemap (every preview host is like that): pass --category and --product.",
      );
    }
    category ??= picked.category;
    product ??= picked.product;
  }
  return {
    base,
    order,
    phone: values.phone,
    category,
    product,
    search: values.search || DEFAULT_SEARCH,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      base: { type: "string" },
      order: { type: "string" },
      phone: { type: "string" },
      category: { type: "string" },
      product: { type: "string" },
      search: { type: "string" },
    },
  });
  const t = await targets(values);
  const pages = launchPages(t);
  const reportDir = join("launch-reports", backupStamp(new Date()));
  mkdirSync(reportDir, { recursive: true });
  const results: Measured[] = [];

  console.log(`Checking ${pages.length} pages on ${t.base}, ${RUNS} runs each.`);
  const cold = await openBrowser();
  try {
    await expectSearchResults(cold, pages.find((page) => page.key === "search")!.url);
    for (const page of pages.filter((p) => p.group === "cold")) {
      results.push(await measure(cold, page, reportDir));
    }
  } finally {
    await closeBrowser(cold);
  }

  const warm = await openBrowser();
  try {
    const warmPages = pages.filter((p) => p.group === "warm");
    await warmUp(warm, t.base, pages.find((page) => page.key === "product")!.url, t.order, t.phone);
    await expectNoRedirects(warm, warmPages);
    for (const page of warmPages) results.push(await measure(warm, page, reportDir));
  } finally {
    await closeBrowser(warm);
  }

  printTable(results);
  console.log(`Reports: ${reportDir}`);
  if (results.some((result) => !result.verdict.pass)) {
    console.log(
      "A page is below the bar. If it missed by a little, run the check once more and record both runs.",
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
