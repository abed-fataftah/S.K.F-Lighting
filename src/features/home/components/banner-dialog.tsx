"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition, type FormEvent } from "react";
import {
  AlertDialog,
  AlertDialogActions,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckRow,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { HOME_CROPS } from "@/features/catalog/media-rules";
import { formatNumber } from "@/lib/format";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import { useFieldErrorText } from "@/lib/use-field-error-text";
import { BANNER_ALT, saveBannerSchema } from "../schemas";
import { deleteBanner, saveBanner, type SaveBannerError } from "../server/actions";
import type { EditorCategory } from "../server/editor-queries";
import type { EditorBanner } from "../server/homepage-db";
import {
  HomeImageField,
  imageBusy,
  imageKeyOf,
  imageValueOf,
  type HomeImageValue,
} from "./home-image-field";
import { ProductPicker } from "./product-picker";

export type BannerDialogTarget =
  { readonly kind: "add" } | { readonly kind: "edit"; readonly banner: EditorBanner };

type LinkKind = "none" | "category" | "product";
type ChosenProduct = { readonly id: string; readonly label: string };

/** A dialog problem shown as its notice: the ones that are not under a field. */
type Problem = "not_found" | "too_many_banners" | "failed";

type Outcome =
  | {
      readonly kind: "saved";
      readonly banner: EditorBanner;
      readonly version: number;
      readonly created: boolean;
    }
  | { readonly kind: "deleted"; readonly id: string; readonly version: number | null }
  | { readonly kind: "stale" }
  /** The banner is no longer stored; the page drops its row. A save leaves the notice open. */
  | { readonly kind: "gone"; readonly id: string; readonly close: boolean };

function problemOf(error: SaveBannerError): Problem {
  return error === "not_found" || error === "too_many_banners" ? error : "failed";
}

// The banner dialog (spec 0011 AC-10): the picture, the title screen readers read, and a link to
// nothing, a category, or a product. "حفظ" writes the banner at once and closes; the page folds
// the result into its own state. A key per target resets the fields when it opens again.
export function BannerDialog({
  target,
  version,
  categories,
  onOutcome,
  onClose,
}: {
  readonly target: BannerDialogTarget | null;
  readonly version: number;
  readonly categories: readonly EditorCategory[];
  readonly onOutcome: (outcome: Outcome) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations("AdminHomepage.dialog");
  return (
    <Dialog open={target !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent data-testid="banner-dialog">
        <DialogTitle>{target?.kind === "edit" ? t("editTitle") : t("addTitle")}</DialogTitle>
        {target ? (
          <BannerForm
            key={target.kind === "edit" ? target.banner.id : "add"}
            target={target}
            version={version}
            categories={categories}
            onOutcome={onOutcome}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BannerForm({
  target,
  version,
  categories,
  onOutcome,
}: {
  readonly target: BannerDialogTarget;
  readonly version: number;
  readonly categories: readonly EditorCategory[];
  readonly onOutcome: (outcome: Outcome) => void;
}) {
  const t = useTranslations("AdminHomepage.dialog");
  const errorsT = useTranslations("AdminHomepage.errors");
  const errorText = useFieldErrorText();
  const id = useId();
  const editing = target.kind === "edit" ? target.banner : null;
  const [image, setImage] = useState<HomeImageValue>(imageValueOf(editing?.imageKey ?? null));
  const [alt, setAlt] = useState(editing?.alt ?? "");
  const [linkKind, setLinkKind] = useState<LinkKind>(editing?.link?.kind ?? "none");
  const [categoryId, setCategoryId] = useState(
    editing?.link?.kind === "category" ? editing.link.id : "",
  );
  const [product, setProduct] = useState<ChosenProduct | null>(
    editing?.link?.kind === "product" ? { id: editing.link.id, label: editing.link.label } : null,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [linkMissing, setLinkMissing] = useState(false);
  const [serverError, setServerError] = useState<"media_invalid" | "link_not_found" | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const fieldId = (name: string) => `${id}-${name}`;

  const link =
    linkKind === "category" && categoryId
      ? ({ kind: "category", id: categoryId } as const)
      : linkKind === "product" && product
        ? ({ kind: "product", id: product.id } as const)
        : linkKind === "none"
          ? ({ kind: "none" } as const)
          : null;

  const focusFirst = () =>
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>('[data-testid="banner-dialog"] [aria-invalid="true"]')
        ?.focus(),
    );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const local = saveBannerSchema.safeParse({
      version,
      id: editing?.id,
      imageKey: imageKeyOf(image) ?? "",
      alt,
      link: link ?? { kind: "none" },
    });
    setLinkMissing(link === null);
    setServerError(null);
    setProblem(null);
    if (!local.success || link === null) {
      setErrors(local.success ? {} : fieldErrorsOf(local.error));
      focusFirst();
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const result = await saveBanner(local.data);
        if (result.ok) {
          onOutcome({ kind: "saved", ...result.data, created: !editing });
          return;
        }
        if (result.error === "stale") return onOutcome({ kind: "stale" });
        if (result.error === "not_found" && editing) {
          onOutcome({ kind: "gone", id: editing.id, close: false });
        }
        if (result.error === "media_invalid" || result.error === "link_not_found") {
          setServerError(result.error);
        } else if (result.error === "invalid" && result.fieldErrors) {
          setErrors(result.fieldErrors);
          focusFirst();
        } else {
          setProblem(problemOf(result.error));
        }
      } catch {
        setProblem("failed");
      }
    });
  };

  const remove = () =>
    startTransition(async () => {
      if (!editing) return;
      try {
        const result = await deleteBanner({ version, id: editing.id });
        setConfirmDelete(false);
        if (result.ok)
          return onOutcome({ kind: "deleted", id: editing.id, version: result.data.version });
        if (result.error === "stale") return onOutcome({ kind: "stale" });
        if (result.error === "not_found") {
          return onOutcome({ kind: "gone", id: editing.id, close: true });
        }
        setProblem("failed");
      } catch {
        setConfirmDelete(false);
        setProblem("failed");
      }
    });

  const imageError =
    serverError === "media_invalid"
      ? errorsT("media_invalid")
      : errors.imageKey
        ? t("imageRequired")
        : null;
  const linkError = serverError === "link_not_found" ? errorsT("link_not_found") : null;
  const busy = pending || imageBusy(image);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field>
        <FieldLabel id={fieldId("image-label")}>{t("image")}</FieldLabel>
        <HomeImageField
          target="banner"
          value={image}
          onChange={(next) => {
            setImage(next);
            setServerError(null);
          }}
          labelId={fieldId("image-label")}
          helpId={fieldId("image-help")}
          help={t("imageHelp")}
          tooSmallText={t("tooSmall", { width: formatNumber(HOME_CROPS.banner.minWidth) })}
          alt={alt || t("preview")}
          error={imageError}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={fieldId("alt")}>{t("alt")}</FieldLabel>
        <Input
          id={fieldId("alt")}
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          maxLength={BANNER_ALT.max * 2}
          autoComplete="off"
          aria-invalid={errors.alt ? true : undefined}
          aria-describedby={
            errors.alt ? `${fieldId("alt")}-help ${fieldId("alt")}-error` : `${fieldId("alt")}-help`
          }
          data-testid="banner-alt"
        />
        <FieldDescription id={`${fieldId("alt")}-help`}>{t("altHelp")}</FieldDescription>
        <FieldError id={`${fieldId("alt")}-error`}>{errorText(errors.alt)}</FieldError>
      </Field>
      <FieldSet>
        <FieldLegend>{t("link")}</FieldLegend>
        <RadioGroup
          value={linkKind}
          onValueChange={(value) => {
            setLinkKind(value as LinkKind);
            setLinkMissing(false);
            setServerError(null);
          }}
          aria-describedby={linkError ? fieldId("link-error") : undefined}
        >
          {(["none", "category", "product"] as const).map((kind) => (
            <CheckRow key={kind}>
              <RadioGroupItem value={kind} data-testid={`banner-link-${kind}`} />
              {t(
                kind === "none" ? "linkNone" : kind === "category" ? "linkCategory" : "linkProduct",
              )}
            </CheckRow>
          ))}
        </RadioGroup>
        {linkKind === "category" ? (
          <Field>
            <FieldLabel htmlFor={fieldId("category")}>{t("category")}</FieldLabel>
            <NativeSelect
              id={fieldId("category")}
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setLinkMissing(false);
                setServerError(null);
              }}
              aria-invalid={linkMissing ? true : undefined}
              aria-describedby={linkMissing ? fieldId("link-missing") : undefined}
              data-testid="banner-category"
            >
              <NativeSelectOption value="">{t("categoryChoose")}</NativeSelectOption>
              {categories.map((main) => [
                <NativeSelectOption key={main.id} value={main.id}>
                  {main.isVisible ? main.name : t("categoryHidden", { name: main.name })}
                </NativeSelectOption>,
                ...main.subs.map((sub) => {
                  const name = `${main.name} › ${sub.name}`;
                  return (
                    <NativeSelectOption key={sub.id} value={sub.id}>
                      {sub.isVisible ? name : t("categoryHidden", { name })}
                    </NativeSelectOption>
                  );
                }),
              ])}
            </NativeSelect>
            <FieldError id={fieldId("link-missing")}>
              {linkMissing ? t("categoryChoose") : null}
            </FieldError>
          </Field>
        ) : null}
        {linkKind === "product" ? (
          product ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border p-3">
              <span className="font-bold" data-testid="banner-product">
                {product.label}
              </span>
              <Button variant="outline" onClick={() => setProduct(null)}>
                {t("changeProduct")}
              </Button>
            </div>
          ) : (
            <>
              <ProductPicker
                label={t("product")}
                exclude={[]}
                onPick={(picked) => {
                  setProduct({ id: picked.id, label: picked.name });
                  setLinkMissing(false);
                  setServerError(null);
                }}
              />
              <FieldError>{linkMissing ? t("productRequired") : null}</FieldError>
            </>
          )
        ) : null}
        <FieldError id={fieldId("link-error")}>{linkError}</FieldError>
      </FieldSet>
      {problem ? (
        <Alert>
          <AlertDescription>{errorsT(problem)}</AlertDescription>
        </Alert>
      ) : null}
      <DialogActions>
        <Button type="submit" disabled={busy} data-testid="banner-save">
          {pending ? t("saving") : t("save")}
        </Button>
        <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
        {editing ? (
          <Button
            variant="outline"
            className="ms-auto"
            onClick={() => setConfirmDelete(true)}
            disabled={pending}
            data-testid="banner-delete"
          >
            {t("delete")}
          </Button>
        ) : null}
      </DialogActions>
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => (open ? null : setConfirmDelete(false))}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogActions>
            <Button onClick={remove} disabled={pending} data-testid="banner-delete-confirm">
              {pending ? t("deleting") : t("deleteConfirm")}
            </Button>
            <AlertDialogClose render={<Button variant="outline" />}>{t("keep")}</AlertDialogClose>
          </AlertDialogActions>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

export type { Outcome as BannerDialogOutcome };
