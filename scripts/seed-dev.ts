// `pnpm db:seed`: demo catalog for the local database only (spec 0002, AC-12). Upserts by slug,
// name, and code, so running it twice changes nothing. Production gets only the delivery zones and
// the settings row, from the migration.
import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { buildProductSlug, slugify } from "@/features/catalog/slug";
import { getDirectDb } from "@/server/db/direct";
import { isLocalDatabaseUrl } from "@/server/db/local";
import { categories, colours, products, productVariants } from "@/server/db/schema";
import type { Transaction } from "@/server/db/types";

const CATEGORIES = [
  { name: "ثريات", sort: 0 },
  { name: "إنارة داخلية", sort: 1 },
] as const;

const COLOURS = [
  { name: "ذهبي", hex: "#C9A227", sort: 0 },
  { name: "أسود", hex: "#1F1F1F", sort: 1 },
  { name: "أبيض", hex: "#F5F5F0", sort: 2 },
] as const;

type DemoVariant = {
  readonly code: string;
  readonly price: number;
  readonly sizeLabel?: string;
  readonly sizeSort?: number;
  readonly colour?: (typeof COLOURS)[number]["name"];
  readonly isDefault?: boolean;
};

type DemoProduct = {
  readonly code: string;
  readonly name: string;
  readonly category: (typeof CATEGORIES)[number]["name"];
  readonly description: string;
  readonly specs: readonly { label: string; value: string }[];
  readonly variants: readonly DemoVariant[];
};

// Prices in agorot (1 ₪ = 100 agorot).
const PRODUCTS: readonly DemoProduct[] = [
  {
    code: "DEMO-1",
    name: "لمبة LED ٩ واط",
    category: "إنارة داخلية",
    description: "لمبة موفرة للطاقة بضوء أبيض دافئ.",
    specs: [
      { label: "القدرة", value: "9 واط" },
      { label: "القاعدة", value: "E27" },
    ],
    variants: [{ code: "DEMO-1", price: 1_500, isDefault: true }],
  },
  {
    code: "DEMO-2",
    name: "ثريا كريستال دائرية",
    category: "ثريات",
    description: "ثريا كريستال بثلاثة مقاسات.",
    specs: [{ label: "عدد اللمبات", value: "6" }],
    variants: [
      { code: "DEMO-2-40", sizeLabel: "40 سم", sizeSort: 0, price: 45_000 },
      { code: "DEMO-2-60", sizeLabel: "60 سم", sizeSort: 1, price: 65_000, isDefault: true },
      { code: "DEMO-2-80", sizeLabel: "80 سم", sizeSort: 2, price: 89_000 },
    ],
  },
  {
    code: "DEMO-3",
    name: "أباجورة طاولة حديثة",
    category: "إنارة داخلية",
    description: "أباجورة بمقاسين وثلاثة ألوان.",
    specs: [{ label: "الأبعاد", value: "حسب المقاس" }],
    variants: (["صغير", "كبير"] as const).flatMap((size, sizeSort) =>
      COLOURS.map((colour, i) => ({
        code: `DEMO-3-${sizeSort === 0 ? "S" : "L"}${i + 1}`,
        sizeLabel: size,
        sizeSort,
        colour: colour.name,
        price: sizeSort === 0 ? 18_000 : 26_000,
        isDefault: sizeSort === 0 && i === 0,
      })),
    ),
  },
];

const excluded = (column: string) => sql.raw(`excluded.${column}`);

async function seed(tx: Transaction) {
  const categoryRows = await tx
    .insert(categories)
    .values(CATEGORIES.map((c) => ({ ...c, slug: slugify(c.name) })))
    .onConflictDoUpdate({
      target: categories.slug,
      set: { name: excluded("name"), sort: excluded("sort") },
    })
    .returning();
  const categoryId = new Map(categoryRows.map((c) => [c.name, c.id]));

  const colourRows = await tx
    .insert(colours)
    .values([...COLOURS])
    .onConflictDoUpdate({
      target: colours.name,
      set: { hex: excluded("hex"), sort: excluded("sort") },
    })
    .returning();
  const colourId = new Map(colourRows.map((c) => [c.name, c.id]));

  for (const demo of PRODUCTS) {
    const [product] = await tx
      .insert(products)
      .values({
        code: demo.code,
        name: demo.name,
        slug: buildProductSlug(demo.name, demo.code),
        categoryId: categoryId.get(demo.category)!,
        description: demo.description,
        specs: demo.specs,
      })
      .onConflictDoUpdate({
        target: products.code,
        set: {
          name: excluded("name"),
          categoryId: excluded("category_id"),
          description: excluded("description"),
          specs: excluded("specs"),
        },
      })
      .returning({ id: products.id });

    await tx
      .insert(productVariants)
      .values(
        demo.variants.map((v, sort) => ({
          productId: product.id,
          code: v.code,
          price: v.price,
          sizeLabel: v.sizeLabel ?? null,
          sizeSort: v.sizeSort ?? 0,
          colourId: v.colour ? colourId.get(v.colour)! : null,
          isDefault: v.isDefault ?? false,
          sort,
        })),
      )
      .onConflictDoUpdate({
        target: productVariants.code,
        set: { price: excluded("price"), sort: excluded("sort") },
      });
  }

  return { categories: CATEGORIES.length, colours: COLOURS.length, products: PRODUCTS.length };
}

async function main() {
  if (!process.env.DATABASE_URL_DIRECT && existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
  if (!isLocalDatabaseUrl(process.env.DATABASE_URL_DIRECT)) {
    console.error(
      "Refusing to seed: DATABASE_URL_DIRECT must point at the local Supabase database " +
        "(localhost or 127.0.0.1, port 54322).",
    );
    process.exitCode = 1;
    return;
  }

  const db = getDirectDb();
  try {
    const counts = await db.transaction(seed);
    console.log(
      `Seeded ${counts.categories} categories, ${counts.colours} colours, and ${counts.products} demo products.`,
    );
  } finally {
    await db.$client.end();
  }
}

void main();
