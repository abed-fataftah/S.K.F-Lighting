"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Suspense,
  use,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Ltr } from "@/components/ltr";
import { LoadingStatus } from "@/components/loading-status";
import { RadioCard } from "@/components/radio-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { fail, type Fail } from "@/lib/result";
import { routes } from "@/lib/routes";
import {
  chooseDraft,
  commitPickerQuantity,
  keepOption,
  NEW_DRAFT,
  pickedOption,
  pickerStart,
  type PickerOption,
} from "../catalog-add";
import { colourAfterSize, resolveOption } from "../draft-view";
import {
  DRAFT_NAME_LIMITS,
  draftNameProblem,
  draftNameSchema,
  MAX_DRAFT_LINES,
  type DraftNameProblem,
} from "../schemas";
import type { DraftPickerData } from "../server/add-from-catalog";
import { addToDraft, readDraftPicker, type AddToDraftAdded } from "../server/actions";
import { OptionSelect } from "./line-card";

// The add to draft sheet (spec 0021 AC-4 to AC-11): one bottom sheet for the product page button
// and the card corner button. It reads the drafts and the product when it opens, checks the
// choices inline, and replaces its body with where the item landed. It mounts fresh on each open.

const SIZE_ID = "draft-picker-size";
const COLOUR_ID = "draft-picker-colour";
const QUANTITY_ID = "draft-picker-quantity";
const NAME_ID = "draft-picker-name";
const OPTION_ERROR_ID = "draft-picker-option-error";
const QUANTITY_ERROR_ID = "draft-picker-quantity-error";
const NAME_ERROR_ID = "draft-picker-name-error";
const DRAFT_LEGEND_ID = "draft-picker-draft";

/** Where the sheet starts: the product page's option and stepper, or nothing and 1 from a card. */
export type PickerStartFrom = { readonly variantId: string | null; readonly quantity: number };

/** One read of the picker; a call that throws (a network failure) is a failed read too. */
type PickerRead = Awaited<ReturnType<typeof readDraftPicker>> | Fail<"network">;

const readPicker = (productId: string): Promise<PickerRead> =>
  readDraftPicker({ productId }).catch(() => fail("network"));

type NameError = DraftNameProblem | "name_taken" | "too_many_drafts";

type Errors = {
  readonly option: boolean;
  readonly quantity: boolean;
  readonly name: NameError | null;
};

const NO_ERRORS: Errors = { option: false, quantity: false, name: null };

type Refusal =
  | { readonly kind: "too_many_lines"; readonly name: string }
  | { readonly kind: "quantity_over"; readonly position: number; readonly current: number }
  | { readonly kind: "not_sellable" | "not_found" | "failed" };

const ltr = (chunks: ReactNode) => <Ltr>{chunks}</Ltr>;

export function AddToDraftSheet({
  productId,
  name,
  code,
  startFrom,
  trigger,
}: {
  readonly productId: string;
  readonly name: string;
  readonly code: string;
  /** Read when the sheet opens. */
  readonly startFrom: PickerStartFrom;
  /** The button that opens the sheet; focus returns to it on close. */
  readonly trigger: ReactElement;
}) {
  const t = useTranslations("DraftPicker");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The read starts when the sheet opens; each new read mounts a fresh body.
  const [request, setRequest] = useState<{
    readonly id: number;
    readonly read: Promise<PickerRead>;
  } | null>(null);

  // A demoted or signed out account loses the buttons (AC-1).
  const forbidden = () => {
    setOpen(false);
    router.refresh();
  };

  const startRead = () => {
    const read = readPicker(productId);
    void read.then((result) => {
      if (!result.ok && result.error === "forbidden") forbidden();
    });
    setRequest((last) => ({ id: (last?.id ?? 0) + 1, read }));
  };

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) startRead();
  };

  return (
    <Sheet open={open} onOpenChange={openChange}>
      <SheetTrigger render={trigger} />
      <SheetContent side="bottom" closeLabel={t("close")} data-testid="draft-picker">
        <SheetHeader className="pb-1">
          <SheetTitle>{t("title")}</SheetTitle>
          <p className="font-bold">{name}</p>
          <SheetDescription>{t.rich("productCode", { code, ltr })}</SheetDescription>
        </SheetHeader>
        {request ? (
          <Suspense fallback={<PickerSkeleton />}>
            <PickerBody
              key={request.id}
              read={request.read}
              productId={productId}
              startFrom={startFrom}
              onRetry={startRead}
              onForbidden={forbidden}
            />
          </Suspense>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PickerBody({
  read,
  onRetry,
  ...props
}: {
  readonly read: Promise<PickerRead>;
  readonly productId: string;
  readonly startFrom: PickerStartFrom;
  readonly onRetry: () => void;
  readonly onForbidden: () => void;
}) {
  const result = use(read);
  if (result.ok) return <PickerForm initial={result.data} {...props} />;
  // Forbidden closes the sheet (above).
  if (result.error === "forbidden") return null;
  return <LoadFailed onRetry={onRetry} />;
}

/** AC-4: a failed read, with a retry. */
function LoadFailed({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations("DraftPicker");
  return (
    <div className="flex flex-col items-start gap-3 p-4" data-testid="draft-picker-failed">
      <p role="alert" className="font-bold">
        {t("loadFailed")}
      </p>
      <Button variant="outline" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}

function PickerForm({
  initial,
  productId,
  startFrom,
  onForbidden,
}: {
  readonly initial: DraftPickerData;
  readonly productId: string;
  readonly startFrom: PickerStartFrom;
  readonly onForbidden: () => void;
}) {
  const t = useTranslations("DraftPicker");
  const [data, setData] = useState(initial);
  const [reloadFailed, setReloadFailed] = useState(false);
  const [start] = useState(() =>
    pickerStart(initial.product?.options ?? [], startFrom.variantId, startFrom.quantity),
  );
  const [picked, setPicked] = useState<PickerOption>({ size: start.size, colour: start.colour });
  const [quantityText, setQuantityText] = useState(start.quantity);
  const [draft, setDraft] = useState(() =>
    chooseDraft(initial.drafts, null, initial.draftLimitReached),
  );
  const [newName, setNewName] = useState("");
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [added, setAdded] = useState<AddToDraftAdded | null>(null);
  const [pending, startTransition] = useTransition();

  const option = pickedOption(data.product?.options ?? [], picked);

  /**
   * A reload after a refusal keeps the typed quantity and name, the option while it is still
   * among the options and sellable, and the draft while it is still listed (AC-11).
   */
  const reload = async (keepVariantId: string | null) => {
    const result = await readPicker(productId);
    if (!result.ok) {
      if (result.error === "forbidden") onForbidden();
      else setReloadFailed(true);
      return;
    }
    const next = result.data;
    setReloadFailed(false);
    setData(next);
    setPicked(keepOption(next.product?.options ?? [], keepVariantId));
    setDraft((current) => chooseDraft(next.drafts, current, next.draftLimitReached));
  };

  if (added) return <AddedBlock added={added} />;

  if (reloadFailed) return <LoadFailed onRetry={() => void reload(option?.id ?? null)} />;

  const product = data.product;
  if (!product) {
    return (
      <div className="flex flex-col gap-3 p-4" data-testid="draft-picker-gone">
        <p role="alert" className="font-bold">
          {t("productGone")}
        </p>
        <SheetClose render={<Button variant="outline" size="lg" />}>{t("close")}</SheetClose>
      </div>
    );
  }

  const resolved = resolveOption(product.options, picked.size, picked.colour);
  const draftName = data.drafts.find((d) => d.id === draft)?.name ?? newName;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const quantity = commitPickerQuantity(quantityText);
    const name = draft === NEW_DRAFT ? draftNameSchema.safeParse(newName) : null;
    const next: Errors = {
      option: option === null,
      quantity: quantity === null,
      name: name && !name.success ? draftNameProblem(name.error) : null,
    };
    setErrors(next);
    setRefusal(null);
    // The select still waiting: the size first, the colour once a size is chosen.
    const optionField =
      resolved.showSize && (picked.size === undefined || !resolved.showColour)
        ? SIZE_ID
        : COLOUR_ID;
    const firstProblem = next.option
      ? optionField
      : next.quantity
        ? QUANTITY_ID
        : next.name
          ? NAME_ID
          : null;
    if (firstProblem || !option || quantity === null || draft === null) {
      if (firstProblem) document.getElementById(firstProblem)?.focus();
      return;
    }

    const target = draft === NEW_DRAFT ? { newDraftName: newName } : { draftId: draft };
    const chosenName = draftName;
    startTransition(async () => {
      try {
        const result = await addToDraft({
          productId: product.id,
          variantId: option.id,
          quantity,
          target,
        });
        if (result.ok) {
          setAdded(result.data);
          return;
        }
        switch (result.error) {
          case "forbidden":
            onForbidden();
            return;
          case "name_taken":
          case "too_many_drafts":
            setErrors({ ...NO_ERRORS, name: result.error });
            document.getElementById(NAME_ID)?.focus();
            return;
          case "too_many_lines":
            setRefusal({ kind: "too_many_lines", name: chosenName });
            return;
          case "quantity_over":
            setRefusal({
              kind: "quantity_over",
              position: result.position ?? 0,
              current: result.current ?? 0,
            });
            return;
          case "not_sellable":
          case "not_found":
            setRefusal({ kind: result.error });
            await reload(option.id);
            return;
          case "invalid":
            if (result.problem) {
              setErrors({ ...NO_ERRORS, name: result.problem });
              document.getElementById(NAME_ID)?.focus();
              return;
            }
            setRefusal({ kind: "failed" });
            return;
          default:
            setRefusal({ kind: "failed" });
        }
      } catch {
        setRefusal({ kind: "failed" });
      }
    });
  };

  const optionInvalid = errors.option
    ? { "aria-invalid": true as const, "aria-describedby": OPTION_ERROR_ID }
    : {};
  const sellablePrices = product.options.filter((o) => o.sellable).map((o) => o.price);
  const lowest = sellablePrices.length ? Math.min(...sellablePrices) : null;
  const priceLine = option
    ? t.rich("unitPriceLine", { price: formatPrice(option.price), ltr })
    : lowest !== null
      ? t.rich(sellablePrices.some((p) => p !== lowest) ? "fromPriceLine" : "unitPriceLine", {
          price: formatPrice(lowest),
          ltr,
        })
      : null;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 p-4 pt-2">
      {resolved.showSize || resolved.showColour ? (
        <div className="grid grid-cols-2 gap-2">
          {resolved.showSize ? (
            <OptionSelect
              id={SIZE_ID}
              label={t("size")}
              choices={resolved.sizes}
              value={picked.size}
              without={t("noSize")}
              disabled={pending}
              onChange={(size) =>
                setPicked({ size, colour: colourAfterSize(product.options, size, picked.colour) })
              }
              {...optionInvalid}
            />
          ) : null}
          {resolved.showColour ? (
            <OptionSelect
              id={COLOUR_ID}
              label={t("colour")}
              choices={resolved.colours}
              value={picked.colour}
              without={t("noColour")}
              disabled={pending || resolved.colourDisabled}
              onChange={(colour) => setPicked({ size: picked.size, colour })}
              {...(resolved.showSize ? {} : optionInvalid)}
            />
          ) : null}
        </div>
      ) : null}
      {errors.option ? <FieldError id={OPTION_ERROR_ID}>{t("optionMissing")}</FieldError> : null}
      {priceLine ? (
        <p className="type-small text-muted" data-testid="draft-picker-price">
          {priceLine}
        </p>
      ) : null}

      <Field>
        <FieldLabel htmlFor={QUANTITY_ID}>{t("quantity")}</FieldLabel>
        <Input
          id={QUANTITY_ID}
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          value={quantityText}
          onChange={(event) => setQuantityText(event.currentTarget.value)}
          aria-invalid={errors.quantity || undefined}
          aria-describedby={errors.quantity ? QUANTITY_ERROR_ID : undefined}
          data-testid="draft-picker-quantity"
        />
        {errors.quantity ? (
          <FieldError id={QUANTITY_ERROR_ID}>{t("quantityError")}</FieldError>
        ) : null}
      </Field>

      <FieldSet className="gap-2">
        <FieldLegend id={DRAFT_LEGEND_ID} className="type-lead text-ink">
          {t("draft")}
        </FieldLegend>
        <RadioGroup
          aria-labelledby={DRAFT_LEGEND_ID}
          value={draft}
          onValueChange={(value) => setDraft(String(value))}
          className="gap-2"
          data-testid="draft-picker-drafts"
        >
          {data.drafts.map((row) => (
            <RadioCard
              key={row.id}
              value={row.id}
              title={row.name}
              description={
                row.lineCount >= MAX_DRAFT_LINES ? (
                  <Ltr>{`${formatNumber(row.lineCount)} / ${formatNumber(MAX_DRAFT_LINES)}`}</Ltr>
                ) : (
                  t("lines", { count: row.lineCount, shown: formatNumber(row.lineCount) })
                )
              }
            />
          ))}
          <RadioCard
            value={NEW_DRAFT}
            title={t("newDraft")}
            description={data.draftLimitReached ? t("draftLimit") : undefined}
            disabled={data.draftLimitReached}
          />
        </RadioGroup>
        {draft === NEW_DRAFT ? (
          <Field>
            <FieldLabel htmlFor={NAME_ID}>{t("nameLabel")}</FieldLabel>
            <Input
              id={NAME_ID}
              autoComplete="off"
              maxLength={DRAFT_NAME_LIMITS.max * 2}
              value={newName}
              onChange={(event) => setNewName(event.currentTarget.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? NAME_ERROR_ID : undefined}
              data-testid="draft-picker-name"
            />
            {errors.name ? (
              <FieldError id={NAME_ERROR_ID}>{t(`nameErrors.${errors.name}`)}</FieldError>
            ) : null}
          </Field>
        ) : null}
      </FieldSet>

      {refusal ? (
        <Alert data-testid="draft-picker-refusal">
          <AlertDescription>
            {refusal.kind === "too_many_lines"
              ? t("errors.too_many_lines", { name: refusal.name })
              : refusal.kind === "quantity_over"
                ? t("errors.quantity_over", {
                    position: formatNumber(refusal.position),
                    current: formatNumber(refusal.current),
                  })
                : t(`errors.${refusal.kind}`)}
          </AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} data-testid="draft-picker-confirm">
        {pending ? t("adding") : t("confirm")}
      </Button>
    </form>
  );
}

/** AC-10: where the item landed, in place of the form; focus moves to its heading. */
function AddedBlock({ added }: { readonly added: AddToDraftAdded }) {
  const t = useTranslations("DraftPicker");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const numbers = {
    position: formatNumber(added.position),
    quantity: formatNumber(added.quantity),
  };
  return (
    <div className="flex flex-col gap-3 p-4 pt-2">
      <div role="status" className="flex flex-col gap-1" data-testid="draft-picker-added">
        <h3 ref={heading} tabIndex={-1} className="flex items-center gap-2 type-lead">
          <Check aria-hidden className="size-5.5 shrink-0 text-whatsapp" />
          {t("added", { draft: added.draftName })}
        </h3>
        <p className="text-muted">
          {added.merged ? t("mergedLine", numbers) : t("addedLine", numbers)}
        </p>
      </div>
      <ButtonLink size="lg" render={<Link href={routes.quickOrderDraft(added.draftId)} />}>
        {t("openDraft")}
      </ButtonLink>
      <SheetClose render={<Button variant="outline" size="lg" />}>{t("keepShopping")}</SheetClose>
    </div>
  );
}

function PickerSkeleton() {
  const t = useTranslations("DraftPicker");
  return (
    <LoadingStatus label={t("loading")} className="flex flex-col gap-4 p-4 pt-2">
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-12 rounded-card" />
        <Skeleton className="h-12 rounded-card" />
      </div>
      <Skeleton className="h-12 rounded-card" />
      <Skeleton className="h-14 rounded-card" />
      <Skeleton className="h-14 rounded-card" />
    </LoadingStatus>
  );
}
