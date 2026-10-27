"use client";

import { Copy } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const subscribeNever = () => () => {};

/** True after mount when the browser can write to the clipboard; false on the server. */
function useCanCopy() {
  return useSyncExternalStore(
    subscribeNever,
    () => typeof navigator.clipboard?.writeText === "function",
    () => false,
  );
}

// Copies the plain order number (spec 0013 AC-4). The button shows only where it can work; the
// polite live region is always in the page, empty at first, so the first result is read.
export function CopyOrderNumber({ number }: { readonly number: string }) {
  const t = useTranslations("Confirmation");
  const canCopy = useCanCopy();
  const [status, setStatus] = useState<"" | "copied" | "copyFailed">("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(number);
      setStatus("copied");
    } catch {
      setStatus("copyFailed");
    }
  }

  return (
    <>
      {canCopy ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("copy")}
          onClick={copy}
          data-testid="copy-order-number"
        >
          <Copy aria-hidden />
        </Button>
      ) : null}
      <p aria-live="polite" className="type-small text-muted" data-testid="copy-status">
        {status ? t(status) : null}
      </p>
    </>
  );
}
