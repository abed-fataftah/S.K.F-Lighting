import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/server/db";
import { pages } from "@/server/db/schema";
import type { PolicySlug } from "../slugs";

export type PolicyPage = {
  readonly slug: PolicySlug;
  readonly title: string;
  readonly body: string;
  readonly version: number;
  readonly updatedAt: Date;
};

/**
 * One policy page (spec 0025 AC-8, AC-10), or null when its row is missing. Cached per request, so
 * the metadata and the page share one read. A failed read throws, to the page's error boundary.
 */
export const getPolicyPage = cache(async (slug: PolicySlug): Promise<PolicyPage | null> => {
  const db = await getDb();
  const [row] = await db
    .select({
      slug: pages.slug,
      title: pages.title,
      body: pages.body,
      version: pages.version,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(eq(pages.slug, slug))
    .limit(1);
  return row ? { ...row, slug } : null;
});
