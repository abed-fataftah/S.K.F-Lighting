"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckRow, Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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
import type { ColourChoice } from "../colour-match";
import {
  move,
  pairId,
  pairsOf,
  type ColourRow,
  type EditorState,
  type SizeRow,
} from "../editor-state";
import { PRODUCT_LIMITS } from "../schemas";
import { ColourPicker } from "./colour-picker";
import { useEditorField, type SectionProps } from "./editor-fields";

type RowButtonsProps = {
  readonly index: number;
  readonly count: number;
  readonly disabled: boolean;
  readonly labels: { readonly earlier: string; readonly later: string; readonly remove: string };
  readonly onMove: (by: number) => void;
  readonly onRemove: () => void;
};

function RowButtons({ index, count, disabled, labels, onMove, onRemove }: RowButtonsProps) {
  return (
    <div className="flex">
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.earlier}
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.later}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.remove}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

/** One "متوفر" tick for a size or colour row when the product has only that kind of option. */
function RowTick({
  state,
  setState,
  id,
  name,
  disabled,
}: Pick<SectionProps, "state" | "setState" | "disabled"> & {
  readonly id: string;
  readonly name: string;
}) {
  const t = useTranslations("AdminProducts");
  return (
    <CheckRow className="min-w-11">
      <Checkbox
        checked={state.ticks[id] ?? true}
        disabled={disabled}
        onCheckedChange={(checked) =>
          setState((current) => ({ ...current, ticks: { ...current.ticks, [id]: checked } }))
        }
      />
      {t("available")}
      <span className="sr-only">{name}</span>
    </CheckRow>
  );
}

// Sizes with a price each, colours from the shared list, and which pairs are in stock
// (spec 0006 AC-3 to AC-6). With no sizes, one price field; with both, a grid of ticks.
export function OptionsSection({
  state,
  setState,
  errors,
  disabled,
  newRowId,
  colours: listed,
}: SectionProps & { readonly newRowId: () => string; readonly colours: readonly ColourChoice[] }) {
  const t = useTranslations("AdminProducts");
  const { control, errorFor, helpId } = useEditorField(errors);
  const [picking, setPicking] = useState(false);
  const addColourRef = useRef<HTMLButtonElement>(null);
  const hasSizes = state.sizes.length > 0;
  const hasColours = state.colours.length > 0;

  const setSizes = (update: (sizes: readonly SizeRow[]) => readonly SizeRow[]) =>
    setState((current) => ({ ...current, sizes: update(current.sizes) }));
  const setColours = (update: (colours: readonly ColourRow[]) => readonly ColourRow[]) =>
    setState((current) => ({ ...current, colours: update(current.colours) }));
  const editSize = (rowId: string, patch: Partial<SizeRow>) =>
    setSizes((sizes) => sizes.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));

  const closePicker = () => {
    setPicking(false);
    requestAnimationFrame(() => addColourRef.current?.focus());
  };

  return (
    <>
      <Card>
        <div className="flex flex-col gap-1">
          <h2 className="type-title-s">{t("options")}</h2>
          <p className="type-small text-muted">
            {t("sizesHelp", { max: formatNumber(PRODUCT_LIMITS.maxSizes) })}
          </p>
        </div>

        {!hasSizes ? (
          <Field className="max-w-60">
            <FieldLabel htmlFor={control("price").id}>{t("singlePrice")}</FieldLabel>
            <Input
              {...control("price", { help: true })}
              value={state.price}
              onChange={(event) =>
                setState((current) => ({ ...current, price: event.target.value }))
              }
              disabled={disabled}
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              maxLength={20}
            />
            <FieldDescription id={helpId("price")}>{t("priceHelp")}</FieldDescription>
            {errorFor("price")}
          </Field>
        ) : (
          <Table aria-label={t("sizesTableLabel")} data-testid="sizes-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("sizeColumn")}</TableHead>
                <TableHead>{t("sizePriceColumn")}</TableHead>
                {hasColours ? null : <TableHead>{t("availabilityColumn")}</TableHead>}
                <TableHead>
                  <span className="sr-only">{t("actionsColumn")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.sizes.map((row, index) => {
                const n = formatNumber(index + 1);
                return (
                  <TableRow key={row.rowId}>
                    <TableCell className="min-w-36 align-top">
                      <Input
                        {...control(`sizes.${index}.label`)}
                        aria-label={t("sizeN", { n })}
                        value={row.label}
                        onChange={(event) => editSize(row.rowId, { label: event.target.value })}
                        disabled={disabled}
                        maxLength={80}
                      />
                      {errorFor(`sizes.${index}.label`)}
                    </TableCell>
                    <TableCell className="min-w-32 align-top">
                      <Input
                        {...control(`sizes.${index}.price`)}
                        aria-label={t("sizePriceN", { n })}
                        value={row.price}
                        onChange={(event) => editSize(row.rowId, { price: event.target.value })}
                        disabled={disabled}
                        dir="ltr"
                        inputMode="decimal"
                        autoComplete="off"
                        maxLength={20}
                      />
                      {errorFor(`sizes.${index}.price`)}
                    </TableCell>
                    {hasColours ? null : (
                      <TableCell className="align-top">
                        <RowTick
                          state={state}
                          setState={setState}
                          disabled={disabled}
                          id={pairId(row.rowId, null)}
                          name={row.label || t("sizeN", { n })}
                        />
                      </TableCell>
                    )}
                    <TableCell className="align-top">
                      <RowButtons
                        index={index}
                        count={state.sizes.length}
                        disabled={disabled}
                        labels={{
                          earlier: t("sizeEarlier", { n }),
                          later: t("sizeLater", { n }),
                          remove: t("removeSize", { n }),
                        }}
                        onMove={(by) => setSizes((sizes) => move(sizes, index, by))}
                        onRemove={() =>
                          setSizes((sizes) => sizes.filter((size) => size.rowId !== row.rowId))
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {errorFor("sizes")}
        {!disabled && state.sizes.length < PRODUCT_LIMITS.maxSizes ? (
          <Button
            variant="outline"
            className="self-start"
            data-testid="add-size"
            onClick={() =>
              setSizes((sizes) => [
                ...sizes,
                { rowId: newRowId(), originalLabel: null, label: "", price: "" },
              ])
            }
          >
            {t("addSize")}
          </Button>
        ) : null}
      </Card>

      <Card>
        <div className="flex flex-col gap-1">
          <h2 className="type-title-s">{t("colours")}</h2>
          <p className="type-small text-muted">
            {t("coloursHelp", { max: formatNumber(PRODUCT_LIMITS.maxColours) })}
          </p>
        </div>
        {hasColours ? (
          <Table aria-label={t("coloursTableLabel")} data-testid="colours-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("colourColumn")}</TableHead>
                {hasSizes ? null : <TableHead>{t("availabilityColumn")}</TableHead>}
                <TableHead>
                  <span className="sr-only">{t("actionsColumn")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.colours.map((row, index) => (
                <TableRow key={row.rowId}>
                  <TableCell className="min-w-36">
                    <span
                      id={control(`colours.${index}.newName`).id}
                      className="flex items-center gap-2"
                    >
                      {row.name}
                      {row.colourId ? null : <Badge variant="spec">{t("colourNew")}</Badge>}
                    </span>
                    {errorFor(`colours.${index}.newName`)}
                  </TableCell>
                  {hasSizes ? null : (
                    <TableCell>
                      <RowTick
                        state={state}
                        setState={setState}
                        disabled={disabled}
                        id={pairId(null, row.rowId)}
                        name={row.name}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <RowButtons
                      index={index}
                      count={state.colours.length}
                      disabled={disabled}
                      labels={{
                        earlier: t("colourEarlier", { name: row.name }),
                        later: t("colourLater", { name: row.name }),
                        remove: t("removeColour", { name: row.name }),
                      }}
                      onMove={(by) => setColours((colours) => move(colours, index, by))}
                      onRemove={() =>
                        setColours((colours) => colours.filter((c) => c.rowId !== row.rowId))
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        {errorFor("colours")}
        {picking ? (
          <ColourPicker
            listed={listed}
            onProduct={state.colours}
            onClose={closePicker}
            onPick={(pick) => {
              setColours((colours) => [...colours, { rowId: newRowId(), ...pick }]);
              closePicker();
            }}
          />
        ) : !disabled && state.colours.length < PRODUCT_LIMITS.maxColours ? (
          <Button
            ref={addColourRef}
            variant="outline"
            className="self-start"
            data-testid="add-colour"
            onClick={() => setPicking(true)}
          >
            {t("addColour")}
          </Button>
        ) : null}
      </Card>

      {hasSizes && hasColours ? (
        <PairGrid state={state} setState={setState} disabled={disabled} />
      ) : null}
      {errorFor("pairs")}
    </>
  );
}

/** Sizes as rows, colours as columns, one tick per pair, in its own sideways scroll box (AC-6). */
function PairGrid({
  state,
  setState,
  disabled,
}: Pick<SectionProps, "state" | "setState" | "disabled">) {
  const t = useTranslations("AdminProducts");
  const pairs = pairsOf(state);
  const toggle = (id: string, checked: boolean) =>
    setState((current: EditorState) => ({
      ...current,
      ticks: { ...current.ticks, [id]: checked },
    }));

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h2 className="type-title-s">{t("grid")}</h2>
        <p className="type-small text-muted">{t("gridHelp")}</p>
      </div>
      <Table aria-label={t("gridLabel")} data-testid="pair-grid">
        <TableHeader>
          <TableRow>
            <TableHead>{t("sizeColumn")}</TableHead>
            {state.colours.map((colour) => (
              <TableHead key={colour.rowId}>{colour.name}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.sizes.map((size) => (
            <TableRow key={size.rowId}>
              <TableHead scope="row" className="text-ink">
                {size.label}
              </TableHead>
              {state.colours.map((colour) => {
                const pair = pairs.find((p) => p.id === pairId(size.rowId, colour.rowId))!;
                return (
                  <TableCell key={colour.rowId}>
                    <CheckRow className="min-w-11 justify-center">
                      <Checkbox
                        checked={pair.available}
                        disabled={disabled}
                        onCheckedChange={(checked) => toggle(pair.id, checked)}
                      />
                      <span className="sr-only">{`${size.label} ${colour.name}`}</span>
                    </CheckRow>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
