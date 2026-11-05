import type { Metadata } from "next";
import { CategoryPage, categoryMetadata } from "@/features/catalog/components/category-page";

// A sub category (spec 0008 AC-8): opens only under its own main.
export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/c/[category]/[sub]">): Promise<Metadata> {
  const [{ category, sub }, query] = await Promise.all([params, searchParams]);
  return categoryMetadata({ main: category, sub, params: query });
}

export default async function SubCategoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/c/[category]/[sub]">) {
  const [{ category, sub }, query] = await Promise.all([params, searchParams]);
  return <CategoryPage address={{ main: category, sub, params: query }} />;
}
