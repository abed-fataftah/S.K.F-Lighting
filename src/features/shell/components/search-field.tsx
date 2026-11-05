"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, type ComponentProps } from "react";
import { readSearchRequest, shownQuery } from "@/features/catalog/search-text";
import { usePathname } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

// The header's search input (spec 0010 AC-1). On `/search` it holds the current `q`, and on the
// prompt (no searchable `q`) it takes focus on load; results never take focus, so the phone
// keyboard does not cover them. It reads the address, so the header renders it inside Suspense
// with `SearchInput` (empty) as the fallback.

export function SearchInput(props: ComponentProps<"input">) {
  return (
    <input
      type="search"
      name="q"
      data-focus-ring="parent"
      className="h-full min-w-0 flex-1 bg-transparent px-4 type-control text-ink placeholder:text-muted"
      {...props}
    />
  );
}

export function SearchField({ placeholder }: { readonly placeholder: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const onSearch = pathname === routes.search();
  const raw = onSearch ? params.getAll("q") : [];
  const value = shownQuery(raw);
  const prompt = onSearch && readSearchRequest(raw).kind !== "search";
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prompt) input.current?.focus();
  }, [prompt, value]);

  // Keyed on the query, so a new search shows its own text even after the shopper typed.
  return <SearchInput key={value} ref={input} defaultValue={value} placeholder={placeholder} />;
}
