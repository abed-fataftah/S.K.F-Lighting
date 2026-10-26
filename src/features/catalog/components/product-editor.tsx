"use client";

import { Archive, CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogActions,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckRow, FieldDescription } from "@/components/ui/field";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import { routes } from "@/lib/routes";
import {
  afterSave,
  changeKey,
  editorFromProduct,
  emptyEditor,
  toPayload,
  type EditorState,
} from "../editor-state";
import { productEditorSchema } from "../schemas";
import type { EditorLookups, ProductEditorState } from "../server/admin-queries";
import {
  deleteProduct,
  restoreProduct,
  saveProduct,
  type SaveProductError,
  type SavedProduct,
} from "../server/actions";
import { BasicsSection } from "./basics-section";
import { MediaSection } from "./media-section";
import { OptionsSection } from "./options-section";
import { SpecsSection } from "./specs-section";

type Banner = SaveProductError | "not_archived" | "uploads_pending";

const subscribeNothing = () => () => {};

/**
 * False in the server HTML and while React takes it over, true once the editor answers input. A
 * field typed into before then keeps the text on screen but not in state, and loses it on the next
 * render. Opened from another page in the app, the editor is ready from its first render.
 */
function useReady() {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** Row ids only need to be unique within this visit. */
function useRowIds() {
  const next = useRef(0);
  return useMemo(() => () => `row-${(next.current += 1)}`, []);
}

// The product editor (spec 0006; docs/design/pages/admin-product-editor.md). One whole form, one
// save: the server checks the version and writes everything in one transaction. An archived product
// opens read only with a single restore button.
export function ProductEditor({
  id,
  product,
  lookups,
}: {
  readonly id: string;
  readonly product: ProductEditorState | null;
  readonly lookups: EditorLookups;
}) {
  const t = useTranslations("AdminProducts");
  const router = useRouter();
  const newRowId = useRowIds();
  const [state, setState] = useState<EditorState>(() =>
    product ? editorFromProduct(product, newRowId) : emptyEditor(newRowId),
  );
  const [version, setVersion] = useState<number | null>(product?.version ?? null);
  const [baseline, setBaseline] = useState(() => changeKey(state));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<Banner | null>(null);
  const [saved, setSaved] = useState<(SavedProduct & { readonly name: string }) | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [pending, startTransition] = useTransition();
  const [startingAnother, startAnother] = useTransition();
  const ready = useReady();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Where a guarded link wants to go while there are unsaved changes (AC-14; spec 0008 AC-17).
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLHeadingElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const archived = product?.isArchived ?? false;
  const isNew = version === null;
  const dirty = changeKey(state) !== baseline;
  const uploadsBusy = state.media.some(
    (tile) => tile.status === "uploading" || tile.status === "failed",
  );
  const slug = saved?.slug ?? product?.slug ?? null;
  const visibleInShop = saved ? saved.visible : (product?.visible ?? false);

  // The browser's own leave warning while there are unsaved changes (AC-14).
  useEffect(() => {
    if (!dirty || archived) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, archived]);

  // After a refused save, focus goes to the first field in error, else to the banner.
  useEffect(() => {
    if (!focusRequest) return;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (field) field.focus();
    else bannerRef.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (saved) noticeRef.current?.focus();
  }, [saved]);

  const refuse = (error: Banner, errors: FieldErrors = {}) => {
    setFieldErrors(errors);
    setBanner(error);
    setSaved(null);
    setFocusRequest((n) => n + 1);
  };

  const submit = () => {
    if (pending || archived) return;
    if (uploadsBusy) return refuse("uploads_pending");
    const payload = toPayload(state, id, version);
    const checked = productEditorSchema.safeParse(payload);
    if (!checked.success) return refuse("invalid", fieldErrorsOf(checked.error));

    startTransition(async () => {
      const result = await saveProduct(payload);
      if (!result.ok) {
        if (result.error === "archived") return router.refresh();
        return refuse(result.error, result.fieldErrors);
      }
      const next = afterSave(state, result.data);
      setState(next);
      setBaseline(changeKey(next));
      setVersion(result.data.version);
      setFieldErrors({});
      setBanner(null);
      setSaved({ ...result.data, name: state.name.trim() });
      // A new product now has its own address; the editor stays as it is.
      if (isNew) window.history.replaceState(null, "", routes.admin.product(id));
    });
  };

  const reload = () => {
    if (isNew) router.replace(routes.admin.product(id));
    router.refresh();
  };

  const remove = () =>
    startTransition(async () => {
      if (version === null) return;
      const result = await deleteProduct({ id, version });
      setConfirmDelete(false);
      if (!result.ok) {
        if (result.error === "archived") return router.refresh();
        return refuse(result.error);
      }
      setBaseline(changeKey(state));
      if (result.data.outcome === "deleted") router.push(routes.admin.products);
      else router.refresh();
    });

  const restore = () =>
    startTransition(async () => {
      if (version === null) return;
      const result = await restoreProduct({ id, version });
      if (!result.ok) return refuse(result.error);
      router.refresh();
    });

  // After the first save the address moved to the product without leaving this page, so the router
  // still holds the new product page and a plain link to it would render nothing. Put the address
  // back, then refresh: the server renders the page again with a new id, and the editor starts again.
  // Replace, not push: an entry for the saved product would bring this page back on Back.
  const addAnother = product
    ? undefined
    : (event: { preventDefault: () => void }) => {
        event.preventDefault();
        window.history.replaceState(null, "", routes.admin.productNew);
        startAnother(() => router.refresh());
      };

  const leave = (href: string = routes.admin.products) =>
    dirty ? setLeaveTo(href) : router.push(href);

  const sectionProps = { state, setState, errors: fieldErrors, disabled: archived };
  const saveDisabled = pending || uploadsBusy || !ready;
  const saveButton = (testId: string) => (
    <Button
      onClick={submit}
      disabled={saveDisabled}
      focusableWhenDisabled
      aria-busy={pending || undefined}
      aria-describedby={uploadsBusy ? "product-uploads-note" : undefined}
      data-testid={testId}
    >
      {pending ? t("saving") : t("save")}
    </Button>
  );

  return (
    <form
      ref={formRef}
      noValidate
      // Nothing typed here survives the fresh editor, so the old one takes no input meanwhile.
      inert={startingAnother}
      aria-busy={startingAnother || !ready || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex max-w-(--admin-form-max) flex-col gap-4"
      data-testid="product-editor"
    >
      {/* Every field and button shows disabled until the editor is ready (see useReady). */}
      <fieldset disabled={!ready} className="contents">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="type-display-s">{isNew ? t("newTitle") : t("editTitle")}</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => leave()} disabled={!ready}>
              {archived ? t("backToList") : t("cancel")}
            </Button>
            {archived ? null : saveButton("product-save-top")}
          </div>
        </div>

        {archived ? (
          <Card className="border-ink bg-yellow-tint" data-testid="product-archived">
            <h2 className="flex items-center gap-2 type-title-s">
              <Archive aria-hidden className="size-6" />
              {t("archivedTitle")}
            </h2>
            <p>{t("archivedText")}</p>
            <Button
              className="self-start"
              onClick={restore}
              disabled={pending}
              focusableWhenDisabled
              data-testid="product-restore"
            >
              {pending ? t("restoring") : t("restore")}
            </Button>
          </Card>
        ) : null}

        {saved && !dirty ? (
          <Card role="status" data-testid="product-saved">
            <h2 ref={noticeRef} tabIndex={-1} className="flex items-center gap-2 type-title-s">
              <CircleCheck aria-hidden className="size-6" />
              {t("saved")}
            </h2>
            <p>
              {saved.visible
                ? t("savedText", { name: saved.name })
                : t("savedHidden", { name: saved.name })}
            </p>
            <div className="flex flex-wrap gap-3">
              {saved.visible ? (
                <ButtonLink
                  variant="outline"
                  render={<Link href={routes.product(saved.slug)} />}
                  data-testid="product-view"
                >
                  {t("view")}
                </ButtonLink>
              ) : null}
              <ButtonLink
                render={<Link href={routes.admin.productNew} onNavigate={addAnother} />}
                data-testid="product-add-another"
              >
                {t("addAnother")}
              </ButtonLink>
            </div>
          </Card>
        ) : null}

        {banner ? (
          <Alert id="product-banner" ref={bannerRef} tabIndex={-1} data-testid="product-banner">
            <AlertDescription>
              {banner === "uploads_pending" ? t("uploadsPending") : t(`errors.${banner}`)}
            </AlertDescription>
            {banner === "stale" ? (
              <Button variant="outline" className="mt-2 self-start" onClick={reload}>
                {t("reload")}
              </Button>
            ) : null}
            {banner === "not_found" ? (
              <ButtonLink
                variant="outline"
                className="mt-2 self-start"
                render={<Link href={routes.admin.products} />}
              >
                {t("backToList")}
              </ButtonLink>
            ) : null}
          </Alert>
        ) : null}

        <BasicsSection
          {...sectionProps}
          categories={lookups.categories}
          onLeave={leave}
          codeFixed={!isNew}
        />
        <MediaSection {...sectionProps} productId={id} newRowId={newRowId} />
        <SpecsSection {...sectionProps} newRowId={newRowId} />
        <OptionsSection {...sectionProps} newRowId={newRowId} colours={lookups.colours} />

        <Card>
          <h2 className="type-title-s">{t("shopStatus")}</h2>
          <div className="flex flex-col gap-1">
            <CheckRow>
              <Checkbox
                checked={state.visible}
                disabled={archived}
                onCheckedChange={(visible) => setState((current) => ({ ...current, visible }))}
                data-testid="product-visible"
              />
              {t("visible")}
            </CheckRow>
            <FieldDescription>{t("visibleHelp")}</FieldDescription>
          </div>
          <div className="flex flex-col gap-1">
            <CheckRow>
              <Checkbox
                checked={state.available}
                disabled={archived}
                onCheckedChange={(available) => setState((current) => ({ ...current, available }))}
                data-testid="product-available"
              />
              {t("availableProduct")}
            </CheckRow>
            <FieldDescription>{t("availableHelp")}</FieldDescription>
          </div>
        </Card>

        {archived ? null : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {saveButton("product-save")}
              {!isNew && slug && visibleInShop && !dirty ? (
                <ButtonLink variant="outline" render={<Link href={routes.product(slug)} />}>
                  {t("view")}
                </ButtonLink>
              ) : null}
            </div>
            {isNew ? null : (
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                disabled={!ready}
                data-testid="product-delete"
              >
                {t("delete")}
              </Button>
            )}
          </div>
        )}
        {uploadsBusy ? (
          <p id="product-uploads-note" className="type-small text-muted">
            {t("uploadsPending")}
          </p>
        ) : null}
      </fieldset>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogTitle>
            {product?.hasOrders ? t("archiveTitle") : t("deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {product?.hasOrders
              ? t("archiveText", { name: state.name })
              : t("deleteText", { name: state.name })}
          </AlertDialogDescription>
          <AlertDialogActions>
            <Button onClick={remove} disabled={pending} data-testid="delete-confirm">
              {pending
                ? t("deleting")
                : product?.hasOrders
                  ? t("archiveConfirm")
                  : t("deleteConfirm")}
            </Button>
            <AlertDialogClose render={<Button variant="outline" />}>{t("keep")}</AlertDialogClose>
          </AlertDialogActions>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={leaveTo !== null}
        onOpenChange={(open) => (open ? null : setLeaveTo(null))}
      >
        <AlertDialogContent data-testid="leave-dialog">
          <AlertDialogTitle>{t("leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("leaveText")}</AlertDialogDescription>
          <AlertDialogActions>
            <Button
              onClick={() => {
                const href = leaveTo ?? routes.admin.products;
                setLeaveTo(null);
                setBaseline(changeKey(state));
                router.push(href);
              }}
            >
              {t("leaveConfirm")}
            </Button>
            <AlertDialogClose render={<Button variant="outline" />}>{t("stay")}</AlertDialogClose>
          </AlertDialogActions>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
