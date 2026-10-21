"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { move, type SpecRow } from "../editor-state";
import { PRODUCT_LIMITS } from "../schemas";
import { useEditorField, type SectionProps } from "./editor-fields";

// Dimensions and specifications (spec 0006 AC-9): free label and value rows, kept in order. A row
// with no value is dropped on save; repeated labels are allowed.
export function SpecsSection({
  state,
  setState,
  errors,
  disabled,
  newRowId,
}: SectionProps & { readonly newRowId: () => string }) {
  const t = useTranslations("AdminProducts");
  const { control, errorFor } = useEditorField(errors);

  const setSpecs = (update: (specs: readonly SpecRow[]) => readonly SpecRow[]) =>
    setState((current) => ({ ...current, specs: update(current.specs) }));
  const edit = (rowId: string, patch: Partial<SpecRow>) =>
    setSpecs((specs) => specs.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h2 className="type-title-s">{t("specs")}</h2>
        <p className="type-small text-muted">{t("specsHelp")}</p>
      </div>
      {state.specs.length ? (
        <Table aria-label={t("specsTableLabel")}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("specLabelColumn")}</TableHead>
              <TableHead>{t("specValueColumn")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("actionsColumn")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.specs.map((row, index) => {
              const n = formatNumber(index + 1);
              return (
                <TableRow key={row.rowId}>
                  <TableCell className="min-w-40 align-top">
                    <Input
                      {...control(`specs.${index}.label`)}
                      aria-label={t("specLabelN", { n })}
                      value={row.label}
                      onChange={(event) => edit(row.rowId, { label: event.target.value })}
                      disabled={disabled}
                      maxLength={80}
                    />
                    {errorFor(`specs.${index}.label`)}
                  </TableCell>
                  <TableCell className="min-w-40 align-top">
                    <Input
                      {...control(`specs.${index}.value`)}
                      aria-label={row.label.trim() || t("specValueN", { n })}
                      value={row.value}
                      onChange={(event) => edit(row.rowId, { value: event.target.value })}
                      disabled={disabled}
                      maxLength={240}
                    />
                    {errorFor(`specs.${index}.value`)}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("specEarlier", { n })}
                        disabled={disabled || index === 0}
                        onClick={() => setSpecs((specs) => move(specs, index, -1))}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("specLater", { n })}
                        disabled={disabled || index === state.specs.length - 1}
                        onClick={() => setSpecs((specs) => move(specs, index, 1))}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("removeSpec", { n })}
                        disabled={disabled}
                        onClick={() =>
                          setSpecs((specs) => specs.filter((spec) => spec.rowId !== row.rowId))
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}
      {errorFor("specs")}
      {!disabled && state.specs.length < PRODUCT_LIMITS.maxSpecs ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() =>
            setSpecs((specs) => [...specs, { rowId: newRowId(), label: "", value: "" }])
          }
        >
          {t("addSpec")}
        </Button>
      ) : null}
    </Card>
  );
}
