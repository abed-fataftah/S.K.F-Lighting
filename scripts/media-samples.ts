// `pnpm media:samples` (spec 0032 AC-14): dev only. Gives every local product with no picture, and
// every main category with no picture, one generated sample picture: a lamp drawing lit by a warm
// glow on a product tone. Anything that already has a picture is left alone, so a second run adds
// nothing. Refuses unless both the database and Supabase are local. The colours come from
// tokens.css; the pure parts live in src/features/catalog/media-samples.ts.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import sharp from "sharp";
import {
  pickSample,
  SAMPLE_SIZES,
  sampleSvg,
  samplesRefusal,
  type SampleTarget,
} from "@/features/catalog/media-samples";
import { homeImageKey, mediaKey } from "@/features/catalog/media-rules";
import { getDirectDb } from "@/server/db/direct";
import { categories, productMedia, products } from "@/server/db/schema";
import { removeKeys, uploadObject } from "@/server/storage/admin";

function loadEnv() {
  // Local runs read the same files as `next dev` and `pnpm preview`; set values win.
  for (const file of [".env.local", ".dev.vars"]) {
    if (!existsSync(file)) continue;
    const before = { ...process.env };
    process.loadEnvFile(file);
    Object.assign(process.env, before);
  }
}

/** The tone and glow colours, read from tokens.css so they have one source. */
function tokenColours() {
  const css = readFileSync("src/app/tokens.css", "utf8");
  const token = (name: string) => {
    const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!match) throw new Error(`${name} not found in src/app/tokens.css`);
    return match[1];
  };
  return {
    tones: [1, 2, 3, 4].map((n) => token(`--skf-product-bg-${n}`)),
    glow: token("--skf-brand"),
  };
}

type Colours = ReturnType<typeof tokenColours>;

/** One WebP picture at quality 80 for an id, in its stable drawing and tone. */
async function picture(id: string, target: SampleTarget, colours: Colours): Promise<Buffer> {
  const { drawing, tone } = pickSample(id);
  const svg = sampleSvg({ drawing, target, background: colours.tones[tone], glow: colours.glow });
  const { width, height } = SAMPLE_SIZES[target];
  return sharp(Buffer.from(svg)).resize(width, height).webp({ quality: 80 }).toBuffer();
}

/** Uploads first, then writes the row; a failed write deletes the upload and stops the run. */
async function place(key: string, body: Buffer, write: () => Promise<unknown>, item: string) {
  try {
    await uploadObject(key, body, "image/webp");
  } catch (error) {
    throw new Error(`Could not upload the sample picture for ${item}.`, { cause: error });
  }
  try {
    await write();
  } catch (error) {
    await removeKeys([key]).catch(() => {});
    throw new Error(`Could not save the sample picture for ${item}.`, { cause: error });
  }
}

async function main() {
  loadEnv();
  const refusal = samplesRefusal(
    process.env.DATABASE_URL_DIRECT,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  if (refusal) {
    console.error(refusal);
    process.exitCode = 1;
    return;
  }

  const colours = tokenColours();
  const db = getDirectDb();
  let filledProducts = 0;
  let filledCategories = 0;
  try {
    const bare = await db
      .select({ id: products.id })
      .from(products)
      .where(
        sql`not exists (select 1 from ${productMedia} where ${productMedia.productId} = ${products.id} and ${productMedia.kind} = 'image')`,
      );
    for (const { id } of bare) {
      const { width, height } = SAMPLE_SIZES.product;
      const key = mediaKey(id, randomUUID(), "webp");
      await place(
        key,
        await picture(id, "product", colours),
        () =>
          db
            .insert(productMedia)
            .values({ productId: id, kind: "image", storageKey: key, width, height, sort: 0 }),
        `product ${id}`,
      );
      filledProducts += 1;
    }

    const mains = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          isNull(categories.parentId),
          or(isNull(categories.imageKey), eq(categories.imageKey, "")),
        ),
      );
    for (const { id } of mains) {
      const key = homeImageKey("category", randomUUID(), "webp");
      await place(
        key,
        await picture(id, "category", colours),
        () => db.update(categories).set({ imageKey: key }).where(eq(categories.id, id)),
        `category ${id}`,
      );
      filledCategories += 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await db.$client.end();
    console.log(
      `Added sample pictures to ${filledProducts} products and ${filledCategories} main categories.`,
    );
  }
}

void main();
