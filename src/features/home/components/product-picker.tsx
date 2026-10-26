"use client";

import { Lamp, Search } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tidyText } from "@/lib/arabic";
import type { PickerProduct } from "../server/homepage-db";
import { searchHomeProducts } from "../server/actions";

const DEBOUNCE_MS = 250;

type Search =
  | { readonly kind: "idle" }
  | { readonly kind: "searching" }
  | { readonly kind: "failed" }
  | { readonly kind: "done"; readonly results: readonly PickerProduct[] };

/** The 44 tile, name, code, and badge of a product, as the picker and the featured rows show it. */
export function ProductLine({ product }: { readonly product: PickerProduct }) {
  const t = useTranslations("AdminHomepage");
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-product-1">
        {product.imageKey ? (
          <Image src={product.imageKey} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          <Lamp aria-hidden className="size-5 text-on-dark-muted" strokeWidth={1.5} />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-bold">{product.name}</span>
        <span className="type-caption text-muted">
          {t("code")} <Ltr>{product.code}</Ltr>
        </span>
      </span>
      {product.badge ? (
        <Badge variant="off" className="ms-auto">
          {t(`badges.${product.badge}`)}
        </Badge>
      ) : null}
    </span>
  );
}

// The product search (spec 0011 AC-12): from one character after tidying, 250 ms after the last
// keystroke, at most ten products by name that are not archived, leaving out the ones in
// `exclude`. Results are buttons; picking one hands it over and clears the search.
export function ProductPicker({
  exclude,
  onPick,
  label,
}: {
  readonly exclude: readonly string[];
  readonly onPick: (product: PickerProduct) => void;
  readonly label: string;
}) {
  const t = useTranslations("AdminHomepage.picker");
  const id = useId();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ kind: "idle" });
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Each keystroke restarts the wait; only the newest request's answer is shown.
  const type = (text: string) => {
    setQuery(text);
    clearTimeout(timer.current);
    const ask = ++request.current;
    const q = tidyText(text);
    if (!q) {
      setSearch({ kind: "idle" });
      return;
    }
    setSearch({ kind: "searching" });
    timer.current = setTimeout(async () => {
      try {
        const result = await searchHomeProducts({ q, exclude: [...exclude] });
        if (ask !== request.current) return;
        setSearch(result.ok ? { kind: "done", results: result.data } : { kind: "failed" });
      } catch {
        if (ask === request.current) setSearch({ kind: "failed" });
      }
    }, DEBOUNCE_MS);
  };

  const status =
    search.kind === "searching"
      ? t("searching")
      : search.kind === "failed"
        ? t("failed")
        : search.kind === "done" && search.results.length === 0
          ? t("noResults")
          : "";

  return (
    <div className="flex flex-col gap-2" data-testid="product-picker">
      <Label htmlFor={`${id}-q`}>{label}</Label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted"
        />
        <Input
          id={`${id}-q`}
          type="search"
          value={query}
          onChange={(event) => type(event.target.value)}
          placeholder={t("placeholder")}
          autoComplete="off"
          aria-describedby={`${id}-status`}
          className="ps-10"
        />
      </div>
      <p id={`${id}-status`} role="status" className="type-small text-muted">
        {status}
      </p>
      {search.kind === "done" && search.results.length ? (
        <ul className="flex flex-col rounded-card border border-border bg-white">
          {search.results.map((product) => (
            <li key={product.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                className="flex min-h-14 w-full cursor-pointer items-center px-3 py-1.5 text-start hover:bg-page"
                aria-label={t("add", { name: product.name })}
                onClick={() => {
                  onPick(product);
                  type("");
                }}
              >
                <ProductLine product={product} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
