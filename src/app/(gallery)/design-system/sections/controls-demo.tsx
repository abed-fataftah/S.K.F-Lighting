"use client";

import { useState } from "react";
import { ErrorState } from "@/components/error-state";
import { RemovableChip } from "@/components/removable-chip";

// Live samples that need a click handler, so they run in the browser.

export function AppliedFiltersDemo({ labels }: { readonly labels: readonly string[] }) {
  const [applied, setApplied] = useState(labels);

  return (
    <div className="flex flex-wrap gap-2 p-1">
      {applied.map((label) => (
        <RemovableChip
          key={label}
          label={label}
          onRemove={() => setApplied((current) => current.filter((l) => l !== label))}
        />
      ))}
    </div>
  );
}

export function ErrorStateDemo({
  title,
  whatsappNumber,
}: {
  readonly title: string;
  readonly whatsappNumber: string;
}) {
  // A sample: retrying has nothing to reload here.
  return <ErrorState title={title} whatsappNumber={whatsappNumber} onRetry={() => undefined} />;
}
