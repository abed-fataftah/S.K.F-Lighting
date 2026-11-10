"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  colourAfterSize,
  countsInTotal,
  lineUnavailable,
  productPrice,
  resolveOption,
  type DraftLineView,
  type DraftOption,
  type LineProblemReason,
  type OptionChoice,
  type Picked,
} from "../draft-view";
import { commitDraftQuantity } from "../quantity";
import type { QuickOrderProduct } from "../server/search";
import { ProductCombobox } from "./product-combobox";

// One line of a quick order (spec 0020 AC-6, AC-8, AC-14): a fieldset "السطر N" with the product
// combobox, the size and colour selects the product needs, the quantity, and a footer with the
// unit price and the line total. The page owns the saves; this card owns what is being picked.
// From lg the card is one row of the lines table (spec 0029 AC-16): every row and the header take
// the same fixed columns, and the delete button, last in source, sits in the last column.

/** The value a select uses for "nothing chosen" and for the "without" choice. */
const NOT_CHOSEN = "";
const WITHOUT = "\u0000without";

const toSelect = (picked: Picked) =>
  picked === undefined ? NOT_CHOSEN : picked === null ? WITHOUT : picked;
const fromSelect = (value: string): Picked =>
  value === NOT_CHOSEN ? undefined : value === WITHOUT ? null : value;

const ltr = (chunks: ReactNode) => <Ltr>{chunks}</Ltr>;

/**
 * The lines table's columns from lg: line number, product, size, colour, quantity, unit price,
 * line total, delete. Fixed widths, so every row lines up with the header (a fieldset cannot take
 * its list's columns through subgrid).
 */
export const lineColumns = "lg:grid-cols-[5rem_minmax(0,1fr)_9rem_9rem_6rem_9rem_6rem_2.75rem]";

export const lineFieldId = (lineId: string, field: "product" | "size" | "colour" | "quantity") =>
  `line-${lineId}-${field}`;

export type LineRefusal =
  { readonly kind: "duplicate"; readonly position: number } | { readonly kind: "invalid" };

export function LineCard({
  line,
  position,
  pending,
  problem,
  refusal,
  onProduct,
  onOption,
  onQuantity,
  onRemove,
  onGoToLine,
  onForbidden,
}: {
  readonly line: DraftLineView;
  readonly position: number;
  /** Not saved yet: shown, but not editable until it has an id. */
  readonly pending: boolean;
  readonly problem: LineProblemReason | null;
  readonly refusal: LineRefusal | null;
  readonly onProduct: (product: QuickOrderProduct, option: DraftOption | null) => void;
  readonly onOption: (option: DraftOption) => void;
  readonly onQuantity: (quantity: number | null) => void;
  readonly onRemove: () => void;
  readonly onGoToLine: (position: number) => void;
  readonly onForbidden: () => void;
}) {
  const t = useTranslations("QuickOrder");
  const product = line.product;
  const options = product?.options ?? [];

  // What is picked follows the saved option; a reply or reload with another option resets it.
  const [picked, setPicked] = useState<{ size: Picked; colour: Picked }>({
    size: line.option?.sizeLabel,
    colour: line.option?.colourName,
  });
  const optionKey = `${product?.id}:${line.option?.id}`;
  const [seenOption, setSeenOption] = useState(optionKey);
  if (optionKey !== seenOption) {
    setSeenOption(optionKey);
    setPicked({ size: line.option?.sizeLabel, colour: line.option?.colourName });
  }

  const [quantityText, setQuantityText] = useState(line.quantity?.toString() ?? "");
  const [seenQuantity, setSeenQuantity] = useState(line.quantity);
  if (line.quantity !== seenQuantity) {
    setSeenQuantity(line.quantity);
    setQuantityText(line.quantity?.toString() ?? "");
  }

  const resolved = resolveOption(options, picked.size, picked.colour);
  const unavailable = lineUnavailable(line);
  const readOnly = pending || (product !== null && !product.sellable);

  const pick = (size: Picked, colour: Picked) => {
    setPicked({ size, colour });
    const match = resolveOption(options, size, colour).option;
    if (match && match.id !== line.option?.id) onOption(match);
  };

  const chooseProduct = (chosen: QuickOrderProduct) => {
    if (chosen.id === product?.id && !chosen.exactOptionId) return;
    const option =
      chosen.options.find((o) => o.id === chosen.exactOptionId) ??
      resolveOption(chosen.options, undefined, undefined).option;
    onProduct(chosen, option);
  };

  const commitQuantity = () => {
    const next = commitDraftQuantity(quantityText, line.quantity);
    setQuantityText(next?.toString() ?? "");
    if (next !== line.quantity) onQuantity(next);
  };
  const quantityKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitQuantity();
    }
  };

  const errorId = `line-${line.id}-error`;
  const problemOn = (field: "product" | "option" | "quantity") => {
    const at =
      problem === "no_product" ? "product" : problem === "no_option" ? "option" : "quantity";
    return problem !== null && at === field;
  };
  const invalidProps = (field: "product" | "option" | "quantity") =>
    problemOn(field) ? { "aria-invalid": true as const, "aria-describedby": errorId } : {};

  const price = line.option && !unavailable ? line.option.price : null;
  const fromPrice = !line.option && product && !unavailable ? productPrice(product) : null;
  const total = countsInTotal(line) ? line.option.price * line.quantity : null;

  return (
    <fieldset
      className={cn(
        "relative flex flex-col gap-2.5 rounded-card border border-border bg-white p-3.5 text-ink lg:grid lg:items-center lg:gap-x-3 lg:gap-y-1.5 lg:py-2",
        lineColumns,
      )}
      data-testid="quick-order-line"
      aria-busy={pending || undefined}
    >
      {/* The legend is the fieldset's first child; the remove button sits beside it on a phone.
          Floated, it stays a plain grid item at lg rather than the fieldset's border legend. */}
      <legend className="float-start flex min-h-11 items-center gap-2 pe-13 type-lead lg:col-start-1 lg:row-start-1 lg:pe-0">
        {t("lineLegend", { position: formatNumber(position) })}
        {unavailable ? (
          <Badge variant="off" data-testid="line-unavailable">
            {t("unavailable")}
          </Badge>
        ) : null}
      </legend>
      <Field className="lg:col-start-2 lg:row-start-1">
        <FieldLabel
          className="lg:sr-only"
          id={`${lineFieldId(line.id, "product")}-label`}
          htmlFor={lineFieldId(line.id, "product")}
        >
          {t("product")}
        </FieldLabel>
        <ProductCombobox
          id={lineFieldId(line.id, "product")}
          labelId={`${lineFieldId(line.id, "product")}-label`}
          product={product}
          disabled={pending}
          onChoose={chooseProduct}
          onForbidden={onForbidden}
          invalid={problemOn("product")}
          describedBy={problemOn("product") ? errorId : undefined}
        />
      </Field>

      <div className="grid grid-cols-3 gap-2 lg:contents">
        {resolved.showSize ? (
          <OptionSelect
            id={lineFieldId(line.id, "size")}
            label={t("size")}
            className="lg:col-start-3 lg:row-start-1"
            labelClassName="lg:sr-only"
            choices={resolved.sizes}
            value={picked.size}
            without={t("noSize")}
            disabled={readOnly}
            onChange={(size) => pick(size, colourAfterSize(options, size, picked.colour))}
            {...invalidProps("option")}
          />
        ) : null}
        {resolved.showColour ? (
          <OptionSelect
            id={lineFieldId(line.id, "colour")}
            label={t("colour")}
            className="lg:col-start-4 lg:row-start-1"
            labelClassName="lg:sr-only"
            choices={resolved.colours}
            value={picked.colour}
            without={t("noColour")}
            disabled={readOnly || resolved.colourDisabled}
            onChange={(colour) => pick(picked.size, colour)}
            {...(resolved.showSize ? {} : invalidProps("option"))}
          />
        ) : null}
        <Field className="col-start-3 lg:col-start-5 lg:row-start-1">
          <FieldLabel className="lg:sr-only" htmlFor={lineFieldId(line.id, "quantity")}>
            {t("quantity")}
          </FieldLabel>
          <Input
            id={lineFieldId(line.id, "quantity")}
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            value={quantityText}
            disabled={pending}
            onChange={(event) => setQuantityText(event.currentTarget.value)}
            onBlur={commitQuantity}
            onKeyDown={quantityKey}
            data-testid="line-quantity"
            {...invalidProps("quantity")}
          />
        </Field>
      </div>

      {/* At lg a line's errors run under its row, from the product column on. */}
      {problem ? (
        <FieldError id={errorId} className="lg:col-start-2 lg:col-end-[-1] lg:row-start-2">
          {t(`problems.${problem}`)}
        </FieldError>
      ) : null}
      {refusal?.kind === "duplicate" ? (
        <div
          className="flex flex-col items-start lg:col-start-2 lg:col-end-[-1] lg:row-start-3"
          data-testid="line-duplicate"
        >
          <FieldError>{t("duplicate", { position: formatNumber(refusal.position) })}</FieldError>
          <Button type="button" variant="link" onClick={() => onGoToLine(refusal.position)}>
            {t("goToLine", { position: formatNumber(refusal.position) })}
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5 lg:contents">
        <span
          className="type-small text-muted lg:col-start-6 lg:row-start-1"
          data-testid="line-unit-price"
        >
          {price !== null
            ? t.rich("linePrice", { price: formatPrice(price), ltr })
            : fromPrice
              ? t.rich(fromPrice.from ? "linePriceFrom" : "linePrice", {
                  price: formatPrice(fromPrice.price),
                  ltr,
                })
              : null}
        </span>
        <span
          className="font-extrabold lg:col-start-7 lg:row-start-1 lg:text-end"
          data-testid="line-total"
        >
          {total !== null ? (
            <Ltr>{formatPrice(total)}</Ltr>
          ) : (
            <>
              <span aria-hidden>—</span>
              <span className="sr-only">{t("noTotal")}</span>
            </>
          )}
        </span>
      </div>

      {/* Last in source, so a line's fields come first in tab order; a phone still shows it in
          the card's top corner. */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onRemove}
        disabled={pending}
        className="absolute end-3.5 top-3.5 lg:static lg:col-start-8 lg:row-start-1"
        aria-label={t("removeLine", { position: formatNumber(position) })}
        data-testid="remove-line"
      >
        <Trash2 aria-hidden />
      </Button>
    </fieldset>
  );
}

export function OptionSelect({
  id,
  label,
  className,
  labelClassName,
  choices,
  value,
  without,
  disabled,
  onChange,
  ...aria
}: {
  readonly id: string;
  readonly label: string;
  readonly className?: string;
  readonly labelClassName?: string;
  readonly choices: readonly OptionChoice[];
  readonly value: Picked;
  readonly without: string;
  readonly disabled: boolean;
  readonly onChange: (value: Picked) => void;
  readonly "aria-invalid"?: true;
  readonly "aria-describedby"?: string;
}) {
  const t = useTranslations("QuickOrder");
  return (
    <Field className={className}>
      <FieldLabel className={labelClassName} htmlFor={id}>
        {label}
      </FieldLabel>
      <NativeSelect
        id={id}
        value={toSelect(value)}
        disabled={disabled}
        onChange={(event) => onChange(fromSelect(event.currentTarget.value))}
        {...aria}
      >
        <NativeSelectOption value={NOT_CHOSEN} disabled>
          {t("choose")}
        </NativeSelectOption>
        {choices.map((choice) => {
          const text = choice.value ?? without;
          return (
            <NativeSelectOption
              key={toSelect(choice.value)}
              value={toSelect(choice.value)}
              disabled={!choice.available && choice.value !== value}
            >
              {choice.available ? text : t("optionUnavailable", { value: text })}
            </NativeSelectOption>
          );
        })}
      </NativeSelect>
    </Field>
  );
}
