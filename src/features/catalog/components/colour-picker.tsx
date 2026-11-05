"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { colourMatches, type ColourChoice } from "../colour-match";
import type { ColourRow } from "../editor-state";

// The inline search behind "+ إضافة لون": buttons for the listed colours, and "add «name»" for
// a name the list does not have. A typed name that matches a listed colour picks that colour.
export function ColourPicker({
  listed,
  onProduct,
  onPick,
  onClose,
}: {
  readonly listed: readonly ColourChoice[];
  readonly onProduct: readonly ColourRow[];
  readonly onPick: (pick: { readonly colourId: string | null; readonly name: string }) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations("AdminProducts");
  const [query, setQuery] = useState("");
  const inputId = useId();
  const listId = useId();
  const match = colourMatches(query, listed, onProduct);

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (match.exact) onPick({ colourId: match.exact.id, name: match.exact.name });
      else if (match.canAdd) onPick({ colourId: null, name: match.name });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-control-border bg-white p-3">
      <Field>
        <FieldLabel htmlFor={inputId}>{t("colourSearch")}</FieldLabel>
        <Input
          id={inputId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={keyDown}
          autoFocus
          autoComplete="off"
          maxLength={80}
          data-testid="colour-search"
        />
      </Field>
      {match.choices.length ? (
        <ul id={listId} aria-label={t("colourChoices")} className="flex flex-wrap gap-2">
          {match.choices.slice(0, 24).map((colour) => (
            <li key={colour.id}>
              <Button
                variant="outline"
                onClick={() => onPick({ colourId: colour.id, name: colour.name })}
              >
                {colour.name}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-small text-muted">{t("colourNone")}</p>
      )}
      {match.already ? (
        <p role="status" className="type-small text-muted">
          {t("colourAlready")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {match.canAdd ? (
          <Button onClick={() => onPick({ colourId: null, name: match.name })}>
            <Plus aria-hidden className="size-4" />
            {t("colourAddNew", { name: match.name })}
          </Button>
        ) : null}
        <Button variant="outline" onClick={onClose}>
          {t("colourClose")}
        </Button>
      </div>
    </div>
  );
}
