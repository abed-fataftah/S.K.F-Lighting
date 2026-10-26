import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { buildProductSlug } from "@/features/catalog/slug";
import { categories, colours, products, productVariants } from "./schema";
import { hasLocalDb } from "./testing";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("./direct");
const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

const run = promisify(execFile);

/** Runs `pnpm db:seed` the way package.json does, with `DATABASE_URL_DIRECT` set to `url`. */
async function runSeed(url: string | undefined) {
  const env = { ...process.env, DATABASE_URL_DIRECT: url };
  return run(
    process.execPath,
    ["--import", "tsx", "--conditions=react-server", "scripts/seed-dev.ts"],
    { env, timeout: 60_000 },
  ).then(
    ({ stdout, stderr }) => ({ code: 0, stdout, stderr }),
    (error: { code?: number; stdout?: string; stderr?: string }) => ({
      code: error.code ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    }),
  );
}

const DEMO_CATEGORY_NAMES = ["ثريات", "إنارة داخلية"];
const DEMO_COLOUR_NAMES = ["ذهبي", "أسود", "أبيض"];

/** How many of the seed's own rows exist, matched by the names and codes the seed upserts on. */
async function demoCounts() {
  const count = (rows: readonly { n: number }[]) => rows[0].n;
  const n = sql<number>`count(*)::int`;
  return {
    categories: count(
      await db.select({ n }).from(categories).where(inArray(categories.name, DEMO_CATEGORY_NAMES)),
    ),
    colours: count(
      await db.select({ n }).from(colours).where(inArray(colours.name, DEMO_COLOUR_NAMES)),
    ),
    products: count(await db.select({ n }).from(products).where(like(products.code, "DEMO-%"))),
    variants: count(
      await db
        .select({ n })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(like(products.code, "DEMO-%")),
    ),
  };
}

// covers: AC-12 (spec 0002). Needs no database: the guard runs before any connection.
describe("pnpm db:seed outside the local database", () => {
  it("refuses a remote host, exits 1, and seeds nothing", async () => {
    const result = await runSeed("postgresql://postgres:x@db.example.com:5432/postgres");

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Refusing to seed");
    expect(result.stdout).not.toContain("Seeded");
  });

  it("refuses localhost on the wrong port", async () => {
    const result = await runSeed("postgresql://postgres:postgres@127.0.0.1:5432/postgres");

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Refusing to seed");
  });
});

// covers: AC-12 (spec 0002). The seed commits by design (that is its job), so these tests leave the
// demo catalog in the local database, exactly as `pnpm db:seed` would.
describe.skipIf(!hasLocalDb)("pnpm db:seed on the local database", () => {
  const localUrl = process.env.DATABASE_URL_DIRECT;

  it("adds two categories, three colours, and three demo products with ten variants", async () => {
    const result = await runSeed(localUrl);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Seeded 2 categories, 3 colours, and 3 demo products.");
    expect(await demoCounts()).toEqual({ categories: 2, colours: 3, products: 3, variants: 10 });
  });

  it("runs a second time without duplicating, and puts a changed demo price back", async () => {
    await runSeed(localUrl);
    const before = await demoCounts();
    await db.update(productVariants).set({ price: 999 }).where(eq(productVariants.code, "DEMO-1"));

    const result = await runSeed(localUrl);

    expect(result.code).toBe(0);
    expect(await demoCounts()).toEqual(before);
    const [variant] = await db
      .select({ price: productVariants.price })
      .from(productVariants)
      .where(eq(productVariants.code, "DEMO-1"));
    expect(variant.price).toBe(1_500);
  });

  it("builds each product slug from its name and code", async () => {
    await runSeed(localUrl);

    const rows = await db
      .select({ code: products.code, name: products.name, slug: products.slug })
      .from(products)
      .where(like(products.code, "DEMO-%"));

    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.slug).toBe(buildProductSlug(row.name, row.code));
    expect(rows.find((r) => r.code === "DEMO-2")?.slug).toBe("ثريا-كريستال-دائرية-DEMO-2");
  });

  it("gives each demo product one default, and the shapes the spec names", async () => {
    await runSeed(localUrl);

    const rows = await db
      .select({
        product: products.code,
        isDefault: productVariants.isDefault,
        sizeLabel: productVariants.sizeLabel,
        colourId: productVariants.colourId,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(like(products.code, "DEMO-%"));
    const of = (code: string) => rows.filter((r) => r.product === code);

    for (const code of ["DEMO-1", "DEMO-2", "DEMO-3"]) {
      expect(
        of(code).filter((r) => r.isDefault),
        code,
      ).toHaveLength(1);
    }
    // One simple product, one with sizes only, one with size by colour.
    expect(of("DEMO-1")).toEqual([expect.objectContaining({ sizeLabel: null, colourId: null })]);
    expect(of("DEMO-2")).toHaveLength(3);
    expect(of("DEMO-2").every((r) => r.sizeLabel !== null && r.colourId === null)).toBe(true);
    expect(of("DEMO-3")).toHaveLength(6);
    expect(of("DEMO-3").every((r) => r.sizeLabel !== null && r.colourId !== null)).toBe(true);
  });
});
