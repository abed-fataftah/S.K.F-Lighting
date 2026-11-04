"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Ltr } from "@/components/ltr";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
} from "@/components/ui/combobox";
import { readSearchRequest } from "@/features/catalog/search-text";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";
import { productPrice, type DraftProduct } from "../draft-view";
import type { QuickOrderProduct } from "../server/search";

// The product field of a line (spec 0020 AC-7): 250 ms after typing stops it asks the search
// endpoint, cancelling any older request; under 2 folded characters it asks nothing. A request
// that fails or takes over 3 seconds shows one "try again" row.

export const SEARCH_DELAY_MS = 250;
const SEARCH_TIMEOUT_MS = 3000;

type SearchState = "idle" | "loading" | "done" | "failed";

export function ProductCombobox({
  id,
  product,
  disabled,
  onChoose,
  onForbidden,
  describedBy,
  invalid,
}: {
  readonly id: string;
  readonly product: DraftProduct | null;
  readonly disabled?: boolean;
  readonly onChoose: (product: QuickOrderProduct) => void;
  readonly onForbidden: () => void;
  readonly describedBy?: string;
  readonly invalid?: boolean;
}) {
  const t = useTranslations("QuickOrder");
  const [input, setInput] = useState(product?.name ?? "");
  const [results, setResults] = useState<readonly QuickOrderProduct[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const request = useRef<{ timer?: ReturnType<typeof setTimeout>; abort?: AbortController }>({});

  // The shown name follows the line when its product changes from outside (a reply, a reload).
  const [shownProduct, setShownProduct] = useState(product?.id);
  if (product?.id !== shownProduct) {
    setShownProduct(product?.id);
    setInput(product?.name ?? "");
  }

  useEffect(() => {
    const current = request.current;
    return () => {
      clearTimeout(current.timer);
      current.abort?.abort();
    };
  }, []);

  const search = (text: string) => {
    clearTimeout(request.current.timer);
    request.current.abort?.abort();
    const parsed = readSearchRequest(text);
    if (parsed.kind !== "search") {
      setResults([]);
      setState("idle");
      return;
    }
    setState("loading");
    request.current.timer = setTimeout(async () => {
      const abort = new AbortController();
      request.current.abort = abort;
      const timeout = setTimeout(() => abort.abort(), SEARCH_TIMEOUT_MS);
      try {
        const response = await fetch(routes.api.quickOrderProducts(text), {
          signal: abort.signal,
        });
        if (response.status === 401 || response.status === 403) return onForbidden();
        if (!response.ok) throw new Error("search failed");
        const body = (await response.json()) as { products: QuickOrderProduct[] };
        setResults(body.products);
        setState("done");
      } catch {
        // An older request cancelled by a newer one leaves the newer one's state alone.
        if (request.current.abort === abort) setState("failed");
      } finally {
        clearTimeout(timeout);
      }
    }, SEARCH_DELAY_MS);
  };

  return (
    <Combobox
      items={results}
      filter={null}
      value={product}
      inputValue={input}
      onInputValueChange={(text, details) => {
        setInput(text);
        if (details.reason === "input-change") search(text);
      }}
      onValueChange={(chosen: DraftProduct | null) => {
        // Only a suggestion row can be chosen, so the value carries `exactOptionId`.
        if (chosen) onChoose(chosen as QuickOrderProduct);
      }}
      itemToStringLabel={(item: DraftProduct) => item.name}
      isItemEqualToValue={(a: DraftProduct, b: DraftProduct) => a.id === b.id}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        autoComplete="off"
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
      />
      <ComboboxContent>
        {state === "loading" ? <ComboboxStatus>{t("searching")}</ComboboxStatus> : null}
        {state === "failed" ? <ComboboxStatus>{t("searchFailed")}</ComboboxStatus> : null}
        {state === "done" ? <ComboboxEmpty>{t("noResults")}</ComboboxEmpty> : null}
        <ComboboxList>
          {(item: QuickOrderProduct) => <SuggestionRow key={item.id} product={item} />}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/** A 40 px photo, the name, the code, and the price ("من" when option prices differ). */
function SuggestionRow({ product }: { readonly product: QuickOrderProduct }) {
  const t = useTranslations("QuickOrder");
  const { price, from } = productPrice(product);
  return (
    <ComboboxItem value={product} data-testid="quick-order-suggestion">
      {product.imageKey ? (
        <Image
          src={product.imageKey}
          alt=""
          width={40}
          height={40}
          sizes="40px"
          className="size-10 shrink-0 rounded-btn bg-product-1 object-cover"
        />
      ) : (
        <ImagePlaceholder className="size-10 shrink-0 rounded-btn [&_svg]:size-5" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-bold">{product.name}</span>
        <span className="type-small text-muted">
          <Ltr>{product.code}</Ltr>
        </span>
      </span>
      <span className="shrink-0 font-bold">
        {from ? (
          t.rich("linePriceFrom", {
            price: formatPrice(price),
            ltr: (chunks) => <Ltr>{chunks}</Ltr>,
          })
        ) : (
          <Ltr>{formatPrice(price)}</Ltr>
        )}
      </span>
    </ComboboxItem>
  );
}
