"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, use, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PaymentNotice } from "../schemas";

// One notice region for the payments card (spec 0023 AC-4, AC-6, AC-7): the form and every
// reversal dialog report here, so a success or a refusal that refreshes the page survives the form
// and the dialog remounting with their fresh ids. Each new notice takes focus.

export type CardNotice =
  | { readonly kind: "done"; readonly key: "recorded" | "refunded" | "reversed" }
  | { readonly kind: "refused"; readonly key: PaymentNotice["key"] };

type Shown = CardNotice & { readonly seq: number };

const NoticeContext = createContext<{
  readonly notice: Shown | null;
  readonly show: (notice: CardNotice | null) => void;
} | null>(null);

export function PaymentNotices({ children }: { readonly children: React.ReactNode }) {
  const [notice, setNotice] = useState<Shown | null>(null);
  const show = (next: CardNotice | null) =>
    setNotice((current) => (next ? { ...next, seq: (current?.seq ?? 0) + 1 } : null));
  return <NoticeContext value={{ notice, show }}>{children}</NoticeContext>;
}

export function useShowNotice() {
  const context = use(NoticeContext);
  if (!context) throw new Error("useShowNotice needs <PaymentNotices>");
  return context.show;
}

/** The notice element's id, for a dialog that hands focus to it as it closes. */
export const NOTICE_ID = "payments-notice";

// Remounting per notice (the key) lets the ref focus each new one, the same text twice included.
const focusOnMount = (node: HTMLElement | null) => node?.focus();

/** Where the notice shows: above the form, under the summary. */
export function PaymentNoticeSlot() {
  const t = useTranslations("AdminPayments");
  const notice = use(NoticeContext)?.notice ?? null;

  if (!notice) return null;
  return notice.kind === "done" ? (
    <p
      key={notice.seq}
      id={NOTICE_ID}
      ref={focusOnMount}
      tabIndex={-1}
      role="status"
      className="flex items-center gap-2 font-bold"
      data-testid="payments-notice"
    >
      <CircleCheck aria-hidden className="size-5.5 shrink-0" />
      {t(notice.key)}
    </p>
  ) : (
    <Alert
      key={notice.seq}
      id={NOTICE_ID}
      ref={focusOnMount}
      tabIndex={-1}
      data-testid="payments-problem"
    >
      <AlertDescription>{t(`errors.${notice.key}`)}</AlertDescription>
    </Alert>
  );
}
