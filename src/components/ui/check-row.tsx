"use client";

import { createContext, useContext, useId } from "react";
import type * as React from "react";
import { cn } from "@/lib/utils";

const CheckRowLabel = createContext<string | undefined>(undefined);

/** The id of the enclosing CheckRow's label, so a Base UI checkbox or radio can name itself. */
export function useCheckRowLabelId() {
  return useContext(CheckRowLabel);
}

// A checkbox or radio with its words: the whole row is the tap target, at least 44 high.
// Base UI renders the control as a <span role="checkbox">, which a wrapping <label> cannot
// name, so the control reads this label's id into aria-labelledby.
export function CheckRow({ className, id, ...props }: React.ComponentProps<"label">) {
  const generated = useId();
  const labelId = id ?? generated;

  return (
    <CheckRowLabel.Provider value={labelId}>
      <label
        id={labelId}
        data-slot="check-row"
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-2.5 type-body text-ink",
          className,
        )}
        {...props}
      />
    </CheckRowLabel.Provider>
  );
}
