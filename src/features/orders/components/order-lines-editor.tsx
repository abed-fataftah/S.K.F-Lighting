"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Ltr } from "@/components/ltr";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { formatPrice, toShekelsInput } from "@/lib/money";
import {
  differsFromCatalog,
  differsFromSaved,
  fieldErrors,
  fieldText,
  previewTotals,
  priceDiscount,
  priceNotice,
  type AdjustedPriceError,
  type PriceNotice,
} from "../price-adjust";
import { PRICE_NOTE_MAX } from "../schemas";
import { adjustOrderPrices } from "../server/price-actions";

export type EditorLine = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly sizeLabel: string | null;
  readonly colourName: string | null;
  readonly quantity: number;
  readonly catalogUnitPrice: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
};

type Saved = {
  readonly total: number;
  readonly lines: readonly EditorLine[];
};

type Notice =
  { readonly kind: "saved" } | (PriceNotice & { readonly kind: "refused"; readonly paid?: number });

const errorKey = {
  required: "priceRequired",
  price_invalid: "priceInvalid",
  above_catalog: "priceAboveCatalog",
} as const satisfies Readonly<Record<AdjustedPriceError, string>>;

const fieldId = (lineId: string) => `line-price-${lineId}`;

const ltr = (chunks: React.ReactNode) => <Ltr>{chunks}</Ltr>;

// The lines table and totals card of the dashboard order page, with the price edit mode on an
// open electrician order (spec 0022 AC-1 to AC-7). Edit mode works on the prices as they were when
// it opened, so a save sends what the owner saw and the server can answer `stale`. Every field is
// checked before anything is sent; the save, any refresh, and the focus move sit in one transition.
export function OrderLinesEditor({
  orderId,
  lines,
  delivery,
  deliveryFee,
  discountTotal,
  subtotal,
  total,
  canAdjust,
  locked,
}: {
  readonly orderId: string;
  readonly lines: readonly EditorLine[];
  readonly delivery: boolean;
  readonly deliveryFee: number;
  readonly discountTotal: number;
  readonly subtotal: number;
  readonly total: number;
  readonly canAdjust: boolean;
  readonly locked: boolean;
}) {
  const t = useTranslations("AdminOrders");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Saved | null>(null);
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, AdjustedPriceError>>>({});
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const focusEdit = useRef(false);
  const focusNotice = useRef(false);

  useEffect(() => {
    // The button stays disabled until the save's refresh lands, and a disabled button takes no focus.
    if (editing || pending || !focusEdit.current) return;
    focusEdit.current = false;
    editButton.current?.focus();
  }, [editing, pending]);

  useEffect(() => {
    if (!focusNotice.current || pending) return;
    focusNotice.current = false;
    noticeRef.current?.focus();
  }, [notice, pending]);

  const shownLines = editing?.lines ?? lines;
  const preview = editing
    ? previewTotals(
        editing.lines.map((line) => ({ ...line, typed: typed[line.id] })),
        deliveryFee,
        discountTotal,
      )
    : null;
  const unitPrices = preview?.unitPrices ?? lines.map((line) => line.unitPrice);
  const discount = priceDiscount(
    shownLines.map((line, index) => ({ ...line, unitPrice: unitPrices[index] })),
  );
  const changed = editing
    ? editing.lines.filter((line) => differsFromSaved(line, typed[line.id]))
    : [];

  const open = () => {
    setEditing({ total, lines });
    setTyped({});
    setErrors({});
    setNote("");
    setNotice(null);
  };

  const close = () => {
    focusEdit.current = true;
    setEditing(null);
    setTyped({});
    setErrors({});
    setNote("");
  };

  const showErrors = (found: Readonly<Record<string, AdjustedPriceError>>) => {
    setErrors(found);
    const first = editing?.lines.find((line) => found[line.id]);
    if (first) document.getElementById(fieldId(first.id))?.focus();
  };

  const refuse = (next: Notice & { readonly kind: "refused" }) => {
    setNotice(next);
    if (!next.refresh) return;
    focusNotice.current = true;
    setEditing(null);
    setTyped({});
    setErrors({});
    startTransition(() => router.refresh());
  };

  const save = () => {
    if (!editing) return;
    const found = fieldErrors(editing.lines, typed);
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    setErrors({});
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await adjustOrderPrices({
          orderId,
          expectedTotal: editing.total,
          note,
          lines: changed.map((line) => ({
            lineId: line.id,
            expectedUnitPrice: line.unitPrice,
            price: typed[line.id] ?? "",
          })),
        });
        if (result.ok) {
          close();
          setNotice({ kind: "saved" });
          return;
        }
        if (result.error === "forbidden") {
          startTransition(() => router.refresh());
          return;
        }
        const lineErrors = "lineErrors" in result ? result.lineErrors : undefined;
        if (lineErrors) showErrors(lineErrors);
        const next = priceNotice(result.error, lineErrors !== undefined);
        if (next) {
          refuse({ ...next, kind: "refused", ...("paid" in result ? { paid: result.paid } : {}) });
        }
      } catch {
        setNotice({ kind: "refused", key: "pricesSaveFailed", refresh: false });
      }
    });
  };

  const type = (lineId: string, text: string) => {
    setTyped((current) => ({ ...current, [lineId]: text }));
    if (errors[lineId]) {
      setErrors((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== lineId)),
      );
    }
  };

  return (
    <div className="flex flex-col gap-3" aria-busy={pending || undefined}>
      {canAdjust && !editing ? (
        <Button
          ref={editButton}
          variant="outline"
          className="w-fit"
          onClick={open}
          disabled={pending}
          data-testid="adjust-prices"
        >
          {t("adjustPrices")}
        </Button>
      ) : null}
      {locked ? (
        <p className="type-small text-muted" data-testid="prices-locked">
          {t("pricesLockedLine")}
        </p>
      ) : null}
      {notice?.kind === "saved" ? (
        <p role="status" className="flex items-center gap-2 font-bold" data-testid="prices-saved">
          <CircleCheck aria-hidden className="size-5.5 shrink-0" />
          {t("pricesSaved")}
        </p>
      ) : notice?.kind === "refused" ? (
        <Alert ref={noticeRef} tabIndex={-1} data-testid="prices-problem">
          <AlertDescription>
            {notice.key === "pricesBelowPaid"
              ? t.rich(notice.key, { paid: formatPrice(notice.paid ?? 0), ltr })
              : t(notice.key)}
          </AlertDescription>
        </Alert>
      ) : null}

      <Table aria-label={t("linesLabel")} data-testid="admin-order-lines">
        <TableHeader>
          <TableRow>
            <TableHead>{t("product")}</TableHead>
            <TableHead>{t("option")}</TableHead>
            <TableHead>{t("quantity")}</TableHead>
            <TableHead>{t("unitPrice")}</TableHead>
            <TableHead>{t("lineTotal")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shownLines.map((line, index) => {
            const lineTyped = typed[line.id];
            const error = errors[line.id];
            const offCatalog = differsFromCatalog(line, lineTyped);
            return (
              <TableRow key={line.id} data-testid="admin-order-line">
                <TableCell>
                  <span className="flex flex-col">
                    <span className="font-bold">{line.name}</span>
                    <span className="type-small text-muted">
                      {t("code")} <Ltr>{line.code}</Ltr>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  {[line.sizeLabel, line.colourName].filter(Boolean).join(" · ")}
                </TableCell>
                <TableCell>{formatNumber(line.quantity)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {editing ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Input
                          id={fieldId(line.id)}
                          inputMode="decimal"
                          autoComplete="off"
                          dir="ltr"
                          className="h-10 w-30"
                          value={fieldText(line, lineTyped)}
                          onChange={(event) => type(line.id, event.target.value)}
                          aria-label={t("linePriceLabel", { n: formatNumber(index + 1) })}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? `${fieldId(line.id)}-error` : undefined}
                          disabled={pending}
                          data-testid="line-price-input"
                        />
                        {offCatalog ? (
                          <s className="text-muted" data-testid="line-catalog-price">
                            <span className="sr-only">{t("beforeDiscountHidden")}</span>
                            <Ltr>{formatPrice(line.catalogUnitPrice)}</Ltr>
                          </s>
                        ) : null}
                      </div>
                      {offCatalog ? (
                        <Button
                          variant="link"
                          className="w-fit"
                          onClick={() => type(line.id, toShekelsInput(line.catalogUnitPrice))}
                          disabled={pending}
                          data-testid="line-price-reset"
                        >
                          {t("resetPrice")}
                        </Button>
                      ) : null}
                      <FieldError id={`${fieldId(line.id)}-error`} announce={false}>
                        {error
                          ? t.rich(errorKey[error], {
                              price: formatPrice(line.catalogUnitPrice),
                              ltr,
                            })
                          : null}
                      </FieldError>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2">
                      {line.unitPrice < line.catalogUnitPrice ? (
                        <s className="text-muted" data-testid="line-catalog-price">
                          <span className="sr-only">{t("beforeDiscountHidden")}</span>
                          <Ltr>{formatPrice(line.catalogUnitPrice)}</Ltr>
                        </s>
                      ) : null}
                      <Ltr>{formatPrice(line.unitPrice)}</Ltr>
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap" data-testid="line-total">
                  <Ltr>{formatPrice(preview?.lineTotals[index] ?? line.lineTotal)}</Ltr>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {editing ? (
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="price-note">{t("priceNote")}</FieldLabel>
            <Input
              id="price-note"
              value={note}
              maxLength={PRICE_NOTE_MAX}
              onChange={(event) => setNote(event.target.value)}
              disabled={pending}
              data-testid="price-note"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={save}
              disabled={pending || changed.length === 0}
              data-testid="save-prices"
            >
              {t("savePrices")}
            </Button>
            <Button
              variant="outline"
              onClick={close}
              disabled={pending}
              data-testid="cancel-prices"
            >
              {t("cancelPrices")}
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <dl className="flex flex-col gap-2">
          {discount.discount > 0 ? (
            <>
              <div className="flex justify-between gap-3">
                <dt>{t("priceBefore")}</dt>
                <dd data-testid="admin-order-before">
                  <Ltr>{formatPrice(discount.catalogSubtotal)}</Ltr>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t("priceDiscount")}</dt>
                <dd data-testid="admin-order-discount">
                  <Ltr>{formatPrice(-discount.discount)}</Ltr>
                </dd>
              </div>
            </>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt>{t("subtotal")}</dt>
            <dd data-testid="admin-order-subtotal">
              <Ltr>{formatPrice(preview?.subtotal ?? subtotal)}</Ltr>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{t("deliveryFee")}</dt>
            <dd>{delivery ? <Ltr>{formatPrice(deliveryFee)}</Ltr> : t("pickupFee")}</dd>
          </div>
          <div className="flex justify-between gap-3 type-title-s">
            <dt>{t("total")}</dt>
            <dd data-testid="admin-order-total">
              <Ltr>{formatPrice(preview?.total ?? total)}</Ltr>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
