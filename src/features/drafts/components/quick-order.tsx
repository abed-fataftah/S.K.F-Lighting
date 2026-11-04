"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Ltr } from "@/components/ltr";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import type { FieldErrors } from "@/lib/form-errors";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";
import {
  draftTotals,
  lineProblems,
  type DraftLineView,
  type DraftOption,
  type DraftProduct,
  type LineProblemReason,
} from "../draft-view";
import { MAX_DRAFT_LINES } from "../schemas";
import { parseDraftCustomer, type DraftCustomerFields } from "../send-check";
import {
  addDraftLine,
  removeDraftLine,
  restoreDraftLine,
  saveDraftCustomer,
  sendDraft,
  updateDraftLine,
  type LineResult,
  type SendError,
} from "../server/actions";
import type { QuickOrderProduct } from "../server/search";
import {
  customerErrorKey,
  customerFieldId,
  CustomerCard,
  type CustomerField,
} from "./customer-card";
import { LineCard, lineFieldId, type LineRefusal } from "./line-card";
import { DraftNameCard } from "./name-card";
import { useSaveQueue, type SaveOutcome } from "./use-save-queue";

// The quick order page with a draft open (spec 0020 AC-5 to AC-14). Every edit shows at once and
// saves through one queue; a server reply replaces a line only when no newer edit of it waits.
// Sending flushes the queue, checks the lines and the customer card here, then asks the server,
// which checks everything again and redirects to the W5 page.

export type DraftZone = {
  readonly id: string;
  readonly name: string;
  readonly fee: number;
  readonly active: boolean;
};

export type QuickOrderDraft = {
  readonly id: string;
  readonly name: string;
  readonly customer: DraftCustomerFields;
  readonly lines: readonly DraftLineView[];
  readonly zones: readonly DraftZone[];
};

type ClientLine = DraftLineView & { readonly pending?: boolean };

/** A removed line, kept for "تراجع" for 5 seconds (AC-9). */
type Removed = { readonly line: DraftLineView; readonly position: number };

const UNDO_MS = 5000;
const customerFields: readonly CustomerField[] = [
  "customerName",
  "customerPhone",
  "fulfilment",
  "deliveryZoneId",
  "city",
  "address",
  "notes",
];

/** The record without `key`. */
function omit<T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> {
  return Object.fromEntries(Object.entries(record).filter(([other]) => other !== key));
}

type Notice = SendError | "save_first" | "restore_failed" | null;

export function QuickOrder({
  draft,
  mine,
}: {
  readonly draft: QuickOrderDraft;
  /** The signed in electrician's own name and phone, for "الطلب لي". */
  readonly mine: { readonly name: string | null; readonly phone: string | null };
}) {
  const t = useTranslations("QuickOrder");
  const tc = useTranslations("Checkout");
  const td = useTranslations("Drafts");
  const router = useRouter();
  const queue = useSaveQueue();
  const rootRef = useRef<HTMLDivElement>(null);

  const [lines, setLines] = useState<readonly ClientLine[]>(draft.lines);
  const [customer, setCustomer] = useState<DraftCustomerFields>(draft.customer);
  // The last line each reply confirmed, to put back after a refusal.
  const saved = useRef(new Map(draft.lines.map((line) => [line.id, line])));
  // A new render from the server (a reload) replaces what the page shows.
  const [seenDraft, setSeenDraft] = useState(draft);
  if (draft !== seenDraft) {
    setSeenDraft(draft);
    setLines(draft.lines);
    setCustomer(draft.customer);
  }
  useEffect(() => {
    saved.current = new Map(draft.lines.map((line) => [line.id, line]));
  }, [draft]);

  const [refusals, setRefusals] = useState<Readonly<Record<string, LineRefusal>>>({});
  const [problems, setProblems] = useState<Readonly<Record<string, LineProblemReason>>>({});
  const [customerErrors, setCustomerErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [sending, startSending] = useTransition();
  const tempIds = useRef(0);

  const zone = draft.zones.find((z) => z.id === customer.deliveryZoneId);
  const fee = customer.fulfilment === "delivery" && zone?.active ? zone.fee : null;
  const shown = lines.filter((line) => !line.pending);
  const totals = draftTotals(shown, fee);

  const forbidden = () => router.replace(routes.account);
  const gone = (error: "forbidden" | "not_found") =>
    error === "forbidden" ? forbidden() : router.refresh();

  const replaceLine = (id: string, next: ClientLine) =>
    setLines((all) => all.map((line) => (line.id === id ? next : line)));
  const clearFor = (id: string) => {
    setRefusals((all) => omit(all, id));
    setProblems((all) => omit(all, id));
  };

  /** A line save's reply: applied, refused (the line goes back), or worth a retry. */
  const handleLine = (id: string, result: LineResult): SaveOutcome => {
    if (result.ok) {
      saved.current.set(id, result.data.line);
      if (!queue.lineHasWaiting(id)) replaceLine(id, result.data.line);
      setRefusals((all) => omit(all, id));
      return "done";
    }
    switch (result.error) {
      case "save_failed":
        return "retry";
      case "forbidden":
      case "not_found":
        gone(result.error);
        return "done";
      case "duplicate":
      case "invalid": {
        const before = saved.current.get(id);
        if (before) replaceLine(id, before);
        const refusal: LineRefusal =
          result.error === "duplicate"
            ? { kind: "duplicate", position: result.position ?? 0 }
            : { kind: "invalid" };
        setRefusals((all) => ({ ...all, [id]: refusal }));
        return "done";
      }
      default:
        return "done";
    }
  };

  const lineSave = (id: string, field: string, input: Parameters<typeof updateDraftLine>[0]) =>
    queue.enqueue({
      key: `line:${id}:${field}`,
      lineId: id,
      run: async () => handleLine(id, await updateDraftLine(input)),
    });

  const chooseProduct = (
    line: ClientLine,
    product: QuickOrderProduct,
    option: DraftOption | null,
  ) => {
    const shownProduct: DraftProduct = {
      id: product.id,
      name: product.name,
      code: product.code,
      imageKey: product.imageKey,
      sellable: product.sellable,
      options: product.options,
    };
    replaceLine(line.id, { ...line, product: shownProduct, option });
    clearFor(line.id);
    lineSave(line.id, "product", {
      lineId: line.id,
      productId: product.id,
      variantId: option?.id ?? null,
    });
  };

  const chooseOption = (line: ClientLine, option: DraftOption) => {
    replaceLine(line.id, { ...line, option });
    clearFor(line.id);
    lineSave(line.id, "option", { lineId: line.id, variantId: option.id });
  };

  const setQuantity = (line: ClientLine, quantity: number | null) => {
    replaceLine(line.id, { ...line, quantity });
    setProblems((all) => omit(all, line.id));
    lineSave(line.id, "quantity", { lineId: line.id, quantity });
  };

  const focusLine = (id: string, field: "product" | "size" | "colour" | "quantity") =>
    requestAnimationFrame(() => document.getElementById(lineFieldId(id, field))?.focus());

  /** The field a line problem points at; an option problem goes to the first select shown. */
  const focusProblem = (id: string, reason: LineProblemReason) => {
    if (reason === "no_option") {
      requestAnimationFrame(() =>
        (
          document.getElementById(lineFieldId(id, "size")) ??
          document.getElementById(lineFieldId(id, "colour"))
        )?.focus(),
      );
    } else focusLine(id, reason === "no_quantity" ? "quantity" : "product");
  };

  const addLine = () => {
    tempIds.current += 1;
    const tempId = `pending-${tempIds.current}`;
    const last = shown.at(-1)?.sort ?? -1;
    setLines((all) => [
      ...all,
      { id: tempId, sort: last + 1, quantity: null, product: null, option: null, pending: true },
    ]);
    queue.enqueue({
      key: `add:${tempId}`,
      run: async () => {
        const result = await addDraftLine({ draftId: draft.id });
        if (result.ok) {
          saved.current.set(result.data.line.id, result.data.line);
          replaceLine(tempId, result.data.line);
          focusLine(result.data.line.id, "product");
          return "done";
        }
        setLines((all) => all.filter((line) => line.id !== tempId));
        if (result.error === "save_failed") return "done";
        if (result.error === "forbidden" || result.error === "not_found") gone(result.error);
        return "done";
      },
    });
  };

  const removeLine = (line: ClientLine, position: number) => {
    const kept = saved.current.get(line.id) ?? line;
    setLines((all) => all.filter((other) => other.id !== line.id));
    clearFor(line.id);
    queue.dropLine(line.id);
    setRemoved({ line: { ...kept, quantity: line.quantity }, position });
    queue.enqueue({
      key: `remove:${line.id}`,
      run: async () => {
        const result = await removeDraftLine({ lineId: line.id });
        if (!result.ok && result.error === "save_failed") return "retry";
        if (!result.ok && result.error === "forbidden") forbidden();
        return "done";
      },
    });
  };

  const undo = () => {
    if (!removed) return;
    const { line } = removed;
    setRemoved(null);
    queue.enqueue({
      key: `restore:${line.id}`,
      run: async () => {
        const result = await restoreDraftLine({
          draftId: draft.id,
          productId: line.product?.id ?? null,
          variantId: line.option?.id ?? null,
          quantity: line.quantity,
          sort: line.sort,
        });
        if (result.ok) {
          const back = result.data.line;
          saved.current.set(back.id, back);
          setLines((all) => {
            const at = all.findIndex((other) => !other.pending && other.sort > back.sort);
            return at === -1 ? [...all, back] : [...all.slice(0, at), back, ...all.slice(at)];
          });
          return "done";
        }
        if (result.error === "save_failed") return "retry";
        if (result.error === "forbidden") forbidden();
        else setNotice("restore_failed");
        return "done";
      },
    });
  };

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [removed]);

  const customerSave = (field: CustomerField, value: string | null) => ({
    key: `customer:${field}`,
    run: async (): Promise<SaveOutcome> => {
      const result = await saveDraftCustomer({ draftId: draft.id, [field]: value });
      if (result.ok) return "done";
      if (result.error === "save_failed") return "retry";
      if (result.error === "forbidden" || result.error === "not_found") gone(result.error);
      return "done";
    },
  });

  const changeCustomer = (field: CustomerField, value: string | null, when: "now" | "later") => {
    setCustomer((current) => ({ ...current, [field]: value }));
    setCustomerErrors((all) => omit(all, customerErrorKey[field]));
    const task = customerSave(field, value);
    if (when === "now") queue.enqueue(task);
    else queue.enqueueLater(task);
  };

  const fillMine = () => {
    changeCustomer("customerName", mine.name ?? "", "now");
    changeCustomer("customerPhone", mine.phone ?? "", "now");
  };

  // Back on the page with nothing unsaved and nothing focused: catch up with other devices.
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState !== "visible" || queue.hasUnsaved()) return;
      if (rootRef.current?.contains(document.activeElement)) return;
      router.refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [queue, router]);

  const send = async () => {
    setNotice(null);
    setRemoved(null);
    const { failed } = await queue.flush();
    if (failed) return setNotice("save_first");

    const lineIssues = lineProblems(shown);
    const customerCheck = parseDraftCustomer(customer, draft.id, totals.total);
    const fieldErrors = customerCheck.ok ? {} : customerCheck.fieldErrors;
    setProblems(Object.fromEntries(lineIssues.map((p) => [p.lineId, p.reason])));
    setCustomerErrors(fieldErrors);
    if (lineIssues.length > 0) {
      return focusProblem(lineIssues[0].lineId, lineIssues[0].reason);
    }
    const firstField = customerFields
      .map((f) => customerErrorKey[f])
      .find((key) => fieldErrors[key]);
    if (firstField) {
      return requestAnimationFrame(() =>
        document.getElementById(customerFieldId(firstField))?.focus(),
      );
    }

    startSending(async () => {
      // Success redirects to the W5 page; only a refusal comes back.
      const result = await sendDraft({ draftId: draft.id, expectedTotal: totals.total }).catch(
        () => ({ ok: false as const, error: "save_failed" as const }),
      );
      if (result.error === "forbidden") return forbidden();
      if (result.error === "not_found") return router.refresh();
      if (result.error === "incomplete" && result.problems) {
        setProblems(Object.fromEntries(result.problems.map((p) => [p.lineId, p.reason])));
        const first = result.problems[0];
        if (first) focusProblem(first.lineId, first.reason);
      }
      if (result.error === "invalid" && result.fieldErrors) setCustomerErrors(result.fieldErrors);
      if (result.error === "price_changed") router.refresh();
      setNotice(result.error);
    });
  };

  const noticeText = (() => {
    switch (notice) {
      case null:
        return null;
      case "save_first":
        return t("saveFirst");
      case "restore_failed":
        return t("restoreFailed");
      case "price_changed":
      case "not_sellable":
      case "zone_invalid":
      case "empty":
      case "rate_limited":
      case "invalid":
      case "incomplete":
        return t(`sendErrors.${notice}`);
      default:
        return t("sendErrors.failed");
    }
  })();

  const statusText =
    queue.status === "saving"
      ? t("saving")
      : queue.status === "saved"
        ? t("saved")
        : queue.status === "failed"
          ? t("saveFailed")
          : null;

  const full = lines.length >= MAX_DRAFT_LINES;

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      <DraftNameCard draftId={draft.id} initialName={draft.name} queue={queue} onGone={gone} />

      <section aria-labelledby="quick-order-lines" className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="quick-order-lines" className="type-lead">
            {t("lines")}
          </h2>
          <span className="type-small text-muted" data-testid="line-counter">
            <Ltr>{`${formatNumber(lines.length)} / ${formatNumber(MAX_DRAFT_LINES)}`}</Ltr>
          </span>
        </div>

        {removed ? (
          <Alert role="status" data-testid="line-removed">
            <AlertDescription className="flex items-center justify-between gap-2">
              {t("lineRemoved", { position: formatNumber(removed.position) })}
              <Button type="button" variant="outline" onClick={undo} data-testid="undo-remove">
                {t("undo")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <ol className="flex flex-col gap-2.5" data-testid="quick-order-lines">
          {lines.map((line, index) => (
            <li key={line.id}>
              <LineCard
                line={line}
                position={index + 1}
                pending={!!line.pending}
                problem={problems[line.id] ?? null}
                refusal={refusals[line.id] ?? null}
                onProduct={(product, option) => chooseProduct(line, product, option)}
                onOption={(option) => chooseOption(line, option)}
                onQuantity={(quantity) => setQuantity(line, quantity)}
                onRemove={() => removeLine(line, index + 1)}
                onGoToLine={(position) => {
                  const target = lines[position - 1];
                  if (target) focusLine(target.id, "quantity");
                }}
                onForbidden={forbidden}
              />
            </li>
          ))}
        </ol>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={addLine}
          disabled={full}
          focusableWhenDisabled
          data-testid="add-line"
        >
          {t("addLine")}
        </Button>
      </section>

      <CustomerCard
        customer={customer}
        zones={draft.zones}
        errors={customerErrors}
        canFillMine={!!mine.phone}
        onChange={changeCustomer}
        onLeave={(field) => queue.flushField(`customer:${field}`)}
        onFillMine={fillMine}
      />

      <Card data-testid="totals-card">
        {noticeText ? (
          <Alert id="quick-order-notice" data-testid="send-notice">
            <AlertDescription>{noticeText}</AlertDescription>
          </Alert>
        ) : null}
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between gap-3">
            <dt>{t("subtotal")}</dt>
            <dd data-testid="draft-subtotal">
              <Ltr>{formatPrice(totals.subtotal)}</Ltr>
            </dd>
          </div>
          {totals.deliveryFee !== null ? (
            <div className="flex justify-between gap-3">
              <dt>{t("delivery")}</dt>
              <dd>
                <Ltr>{formatPrice(totals.deliveryFee)}</Ltr>
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3 type-title-s">
            <dt>{t("total")}</dt>
            <dd data-testid="draft-total">
              <Ltr>{formatPrice(totals.total)}</Ltr>
            </dd>
          </div>
        </dl>
        {totals.excluded > 0 ? (
          <p className="type-small text-muted" data-testid="draft-excluded">
            {t("excluded", {
              lines: td("lines", { count: totals.excluded, shown: formatNumber(totals.excluded) }),
            })}
          </p>
        ) : null}

        <div className="flex min-h-11 items-center gap-2" role="status" data-testid="save-status">
          <span className="type-small text-muted">{statusText}</span>
          {queue.status === "failed" ? (
            <Button type="button" variant="outline" onClick={queue.retry} data-testid="save-retry">
              {t("retry")}
            </Button>
          ) : null}
        </div>

        <Button
          type="button"
          variant="whatsapp"
          size="lg"
          onClick={send}
          disabled={sending}
          focusableWhenDisabled
          aria-busy={sending || undefined}
          aria-describedby={noticeText ? "quick-order-notice" : undefined}
          data-testid="send-draft"
        >
          <WhatsAppIcon />
          {sending ? t("sending") : t("send")}
        </Button>
        <p className="type-small text-muted">{tc("note")}</p>
      </Card>
    </div>
  );
}
