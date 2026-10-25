import type { Metadata } from "next";
import { SearchPage, searchMetadata } from "@/features/catalog/components/search-page";

// `/search` (spec 0010 AC-1): the prompt without a searchable `q`, else the results.
export async function generateMetadata(): Promise<Metadata> {
  return searchMetadata();
}

export default async function SearchRoute({ searchParams }: PageProps<"/[locale]/search">) {
  return <SearchPage params={await searchParams} />;
}
