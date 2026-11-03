"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { CUSTOMER_SEARCH_MAX } from "../schemas";
import { searchAdminCustomers } from "../server/admin-actions";
import type { AdminCustomerRow } from "../server/admin-queries";
import { CustomersTable } from "./customers-table";

type Results = { readonly rows: readonly AdminCustomerRow[]; readonly capped: boolean };

// The customers search (spec 0019 AC-3). It posts to a Server Action, so the text (a phone or an
// email maybe) never goes into the address, a log, or browser storage. Results replace the list
// (`children`) until "مسح البحث".
export function CustomerSearch({
  limit,
  children,
}: {
  /** How many rows a search shows at most. */
  readonly limit: number;
  readonly children: ReactNode;
}) {
  const t = useTranslations("AdminCustomers");
  const heading = useRef<HTMLHeadingElement>(null);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<"searchInvalid" | "failed" | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [pending, startTransition] = useTransition();

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProblem(null);
    startTransition(async () => {
      try {
        const result = await searchAdminCustomers({ text });
        if (result.ok) setResults(result.data);
        else setProblem(result.error === "invalid" ? "searchInvalid" : "failed");
      } catch {
        setProblem("failed");
      }
    });
  };

  // The results replace the list: focus moves to their heading once they are on screen.
  useEffect(() => {
    if (results) heading.current?.focus();
  }, [results]);

  const clear = () => {
    setResults(null);
    setText("");
    setProblem(null);
  };

  return (
    <>
      <form role="search" aria-label={t("search")} onSubmit={search} data-testid="customer-search">
        <Field>
          <FieldLabel htmlFor="customers-search">{t("search")}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="customers-search"
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("searchPlaceholder")}
              maxLength={CUSTOMER_SEARCH_MAX}
              autoComplete="off"
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? "customers-search-problem" : undefined}
            />
            <Button type="submit" className="h-12" disabled={pending}>
              {pending ? t("searching") : t("search")}
            </Button>
          </div>
          {problem ? <FieldError id="customers-search-problem">{t(problem)}</FieldError> : null}
        </Field>
      </form>

      {results === null ? (
        children
      ) : (
        <section className="flex flex-col gap-3" data-testid="customer-search-results">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 ref={heading} tabIndex={-1} className="type-title-s">
              {t("searchResults")}
            </h2>
            <Button variant="outline" onClick={clear} data-testid="customer-search-clear">
              {t("clearSearch")}
            </Button>
          </div>
          {results.rows.length ? (
            <>
              <CustomersTable
                rows={results.rows}
                label={t("searchResults")}
                testId="customer-search-table"
              />
              {results.capped ? (
                <p className="type-small text-muted" data-testid="customer-search-capped">
                  {t("searchCapped", { count: formatNumber(limit) })}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted" data-testid="customer-search-empty">
              {t("noMatch")}
            </p>
          )}
        </section>
      )}
    </>
  );
}
