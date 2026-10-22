import type { Metadata } from "next";
import { CategoryPage, categoryMetadata } from "@/features/catalog/components/category-page";

// A main category (spec 0008 AC-8): its own listed products and those of its shown subs.
export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/c/[category]">): Promise<Metadata> {
  const [{ category }, { page }] = await Promise.all([params, searchParams]);
  return categoryMetadata({ main: category, sub: null, page });
}

export default async function MainCategoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/c/[category]">) {
  const [{ category }, { page }] = await Promise.all([params, searchParams]);
  return <CategoryPage address={{ main: category, sub: null, page }} />;
}
