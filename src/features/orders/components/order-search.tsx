"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { routes } from "@/lib/routes";
import { SEARCH_TEXT_MAX } from "../schemas";
import { searchAdminOrders } from "../server/admin-actions";
import type { AdminOrderRow } from "../server/admin-queries";
import { OrdersTable } from "./orders-table";

type Problem = "noOrderNumber" | "searchInvalid";

// The orders search (spec 0014 AC-13). It posts to a Server Action, so the text (a phone maybe)
// never goes into the address, a log, or browser storage. A number opens its order; a phone shows
// that customer's orders in place of the list (`children`) until "مسح البحث".
export function OrderSearch({ children }: { readonly children: ReactNode }) {
  const t = useTranslations("AdminOrders");
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [rows, setRows] = useState<readonly AdminOrderRow[] | null>(null);
  const [pending, startTransition] = useTransition();

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProblem(null);
    startTransition(async () => {
      try {
        const result = await searchAdminOrders({ text });
        if (!result.ok) {
          setProblem(result.error === "no_order" ? "noOrderNumber" : "searchInvalid");
        } else if (result.data.kind === "open") {
          router.push(routes.admin.order(result.data.number));
        } else {
          setRows(result.data.rows);
        }
      } catch {
        setProblem("searchInvalid");
      }
    });
  };

  // The results replace the list: focus moves to their heading once they are on screen.
  useEffect(() => {
    if (rows) heading.current?.focus();
  }, [rows]);

  const clear = () => {
    setRows(null);
    setText("");
    setProblem(null);
  };

  return (
    <>
      <form role="search" aria-label={t("search")} onSubmit={search} data-testid="order-search">
        <Field>
          <FieldLabel htmlFor="orders-search">{t("search")}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="orders-search"
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("searchPlaceholder")}
              maxLength={SEARCH_TEXT_MAX}
              autoComplete="off"
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? "orders-search-problem" : undefined}
            />
            <Button type="submit" className="h-12" disabled={pending}>
              {pending ? t("searching") : t("search")}
            </Button>
          </div>
          {problem ? <FieldError id="orders-search-problem">{t(problem)}</FieldError> : null}
        </Field>
      </form>

      {rows === null ? (
        children
      ) : (
        <section className="flex flex-col gap-3" data-testid="order-search-results">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 ref={heading} tabIndex={-1} className="type-title-s">
              {t("searchResults")}
            </h2>
            <Button variant="outline" onClick={clear}>
              {t("clearSearch")}
            </Button>
          </div>
          {rows.length ? (
            <OrdersTable rows={rows} label={t("searchResults")} testId="order-search-table" />
          ) : (
            <p className="text-muted">{t("noPhoneOrders")}</p>
          )}
        </section>
      )}
    </>
  );
}
