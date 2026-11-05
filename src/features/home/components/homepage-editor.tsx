"use client";

import { CircleCheck, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckRow } from "@/components/ui/field";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  activeCount,
  addFeatured,
  canTick,
  changeKey,
  editorFrom,
  moveItem,
  removeFeatured,
  savePayload,
  setActive,
  setHomeMain,
  withSavedBanner,
  withoutBanner,
  type EditorState,
} from "../editor-state";
import { HOME_LIMITS } from "../home-rules";
import { saveHomepage } from "../server/actions";
import type { HomepageEditorData } from "../server/editor-queries";
import type { EditorBanner } from "../server/homepage-db";
import { BannerDialog, type BannerDialogOutcome, type BannerDialogTarget } from "./banner-dialog";
import { ProductLine, ProductPicker } from "./product-picker";

type Notice = "stale" | "too_many_active" | "too_many_featured" | "failed" | "savedInactive" | null;

const subscribeNothing = () => () => {};

/** False in the server HTML and while React takes over, so nothing is typed into a dead page. */
function useReady() {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

// The homepage editor (spec 0011 AC-8 to AC-10; docs/design/pages/admin-homepage.md). Ticks, ↑ ↓,
// the featured list, and the category ticks change the page state only; "حفظ التغييرات" sends it
// all at once. The banner dialog saves at once and its result is folded into the page, so it never
// counts as an unsaved change. A save from another tab makes the next one `stale`.
export function HomepageEditor({ data }: { readonly data: HomepageEditorData }) {
  const t = useTranslations("AdminHomepage");
  const ready = useReady();
  const [state, setState] = useState<EditorState>(() => editorFrom(data));
  const [baseline, setBaseline] = useState<EditorState>(state);
  const [version, setVersion] = useState(data.version);
  const [notice, setNotice] = useState<Notice>(null);
  const [saved, setSaved] = useState(false);
  const [unavailable, setUnavailable] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<BannerDialogTarget | null>(null);
  const [pending, startTransition] = useTransition();
  const leaving = useRef(false);
  const noticeRef = useRef<HTMLDivElement>(null);

  const dirty = changeKey(state) !== changeKey(baseline);
  const atActiveCap = activeCount(state.banners) >= HOME_LIMITS.maxActiveBanners;

  // The browser's own leave warning while there are unsaved changes (the product editor's guard).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  const change = (update: (current: EditorState) => EditorState) => {
    setState(update);
    setSaved(false);
  };

  const reload = () => {
    leaving.current = true;
    window.location.reload();
  };

  const save = () =>
    startTransition(async () => {
      setNotice(null);
      setUnavailable(new Set());
      try {
        const result = await saveHomepage(savePayload(state, version));
        if (result.ok) {
          setVersion(result.data.version);
          setBaseline(state);
          setSaved(true);
          return;
        }
        if (result.error === "product_unavailable") {
          setUnavailable(new Set(result.productIds));
          return;
        }
        setNotice(
          result.error === "stale" ||
            result.error === "too_many_active" ||
            result.error === "too_many_featured"
            ? result.error
            : "failed",
        );
      } catch {
        setNotice("failed");
      }
    });

  const onBannerOutcome = (outcome: BannerDialogOutcome) => {
    switch (outcome.kind) {
      case "saved":
        setVersion(outcome.version);
        setState((current) => withSavedBanner(current, outcome.banner, true));
        setBaseline((current) => withSavedBanner(current, outcome.banner, false));
        setNotice(outcome.created && !outcome.banner.isActive ? "savedInactive" : null);
        setDialog(null);
        return;
      case "deleted":
        if (outcome.version !== null) setVersion(outcome.version);
        setState((current) => withoutBanner(current, outcome.id));
        setBaseline((current) => withoutBanner(current, outcome.id));
        setDialog(null);
        return;
      case "gone":
        setState((current) => withoutBanner(current, outcome.id));
        setBaseline((current) => withoutBanner(current, outcome.id));
        if (outcome.close) setDialog(null);
        return;
      case "stale":
        setDialog(null);
        setNotice("stale");
        return;
    }
  };

  return (
    <div className="flex max-w-(--admin-form-max) flex-col gap-4" aria-busy={!ready || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display-s">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="flex items-center gap-1.5 font-bold">
            {saved && !dirty ? (
              <>
                <CircleCheck aria-hidden className="size-5 text-whatsapp" />
                {t("saved")}
              </>
            ) : null}
          </p>
          <Button
            onClick={save}
            disabled={!ready || !dirty || pending || notice === "stale"}
            data-testid="homepage-save"
          >
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      </div>

      {notice ? (
        <div ref={noticeRef} tabIndex={-1}>
          <Alert data-testid="homepage-notice">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {notice === "stale"
                ? t("stale")
                : notice === "savedInactive"
                  ? t("dialog.savedInactive")
                  : t(`errors.${notice}`)}
              {notice === "stale" ? (
                <Button variant="outline" onClick={reload} data-testid="homepage-reload">
                  {t("reload")}
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <fieldset disabled={!ready} className="contents">
        <BannersCard
          banners={state.banners}
          atActiveCap={atActiveCap}
          onTick={(id, on) => change((current) => setActive(current, id, on))}
          onMove={(index, by) =>
            change((current) => ({ ...current, banners: moveItem(current.banners, index, by) }))
          }
          onEdit={(banner) => setDialog({ kind: "edit", banner })}
          onAdd={() => setDialog({ kind: "add" })}
        />
        <FeaturedCard
          featured={state.featured}
          unavailable={unavailable}
          onPick={(product) => change((current) => addFeatured(current, product))}
          onMove={(index, by) =>
            change((current) => ({ ...current, featured: moveItem(current.featured, index, by) }))
          }
          onRemove={(id) => {
            change((current) => removeFeatured(current, id));
            setUnavailable((ids) => new Set([...ids].filter((other) => other !== id)));
          }}
        />
        <MainsCard
          mains={data.mains}
          homeIds={state.homeIds}
          onTick={(id, on) => change((current) => setHomeMain(current, id, on))}
        />
      </fieldset>

      <BannerDialog
        target={dialog}
        version={version}
        categories={data.categories}
        onOutcome={onBannerOutcome}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function MoveButtons({
  name,
  index,
  count,
  onMove,
}: {
  readonly name: string;
  readonly index: number;
  readonly count: number;
  readonly onMove: (index: number, by: -1 | 1) => void;
}) {
  const t = useTranslations("AdminHomepage");
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        disabled={index === 0}
        focusableWhenDisabled
        onClick={() => onMove(index, -1)}
        aria-label={t("moveUp", { name })}
      >
        <span aria-hidden>↑</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        disabled={index === count - 1}
        focusableWhenDisabled
        onClick={() => onMove(index, 1)}
        aria-label={t("moveDown", { name })}
      >
        <span aria-hidden>↓</span>
      </Button>
    </>
  );
}

function CardHead({ title, text }: { readonly title: string; readonly text?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="type-title-s">{title}</h2>
      {text ? <p className="text-muted">{text}</p> : null}
    </div>
  );
}

function BannersCard({
  banners,
  atActiveCap,
  onTick,
  onMove,
  onEdit,
  onAdd,
}: {
  readonly banners: readonly EditorBanner[];
  readonly atActiveCap: boolean;
  readonly onTick: (id: string, on: boolean) => void;
  readonly onMove: (index: number, by: -1 | 1) => void;
  readonly onEdit: (banner: EditorBanner) => void;
  readonly onAdd: () => void;
}) {
  const t = useTranslations("AdminHomepage");
  const capId = "banner-active-cap";
  const add =
    banners.length >= HOME_LIMITS.maxBanners ? (
      <p className="text-muted" data-testid="banner-cap">
        {t("bannerCap")}
      </p>
    ) : (
      <Button variant="outline" className="self-start" onClick={onAdd} data-testid="banner-add">
        {t("addBanner")}
      </Button>
    );

  return (
    <Card data-testid="homepage-banners">
      <CardHead title={t("bannersTitle")} text={t("bannersText")} />
      {banners.length === 0 ? (
        <p className="font-bold">{t("noBanners")}</p>
      ) : (
        <ul aria-label={t("bannersTitle")} className="flex flex-col border-t border-border">
          {banners.map((banner, index) => (
            <li
              key={banner.id}
              className="flex flex-wrap items-center gap-3 border-b border-border py-2.5"
              data-testid="banner-row"
            >
              <span className="relative h-14 w-30 shrink-0 overflow-hidden rounded-btn bg-fill-muted">
                <Image src={banner.imageKey} alt="" fill sizes="120px" className="object-cover" />
              </span>
              <span className="flex min-w-0 flex-1 basis-48 flex-col">
                <span className="font-extrabold">{banner.alt}</span>
                <span className="type-small text-muted">
                  {t("linkLabel", { name: banner.link?.label ?? t("noLink") })}
                  {banner.link && !banner.link.live ? (
                    <span className="ms-2 font-bold text-ink">{t("linkNotLive")}</span>
                  ) : null}
                </span>
              </span>
              <CheckRow className="min-w-24">
                <Checkbox
                  checked={banner.isActive}
                  disabled={!canTick(banners, banner)}
                  onCheckedChange={(on) => onTick(banner.id, on)}
                  aria-describedby={atActiveCap && !banner.isActive ? capId : undefined}
                  data-testid="banner-active"
                />
                <span aria-hidden>{t("active")}</span>
                <span className="sr-only">{t("activeLabel", { name: banner.alt })}</span>
              </CheckRow>
              <span className="flex items-center gap-2">
                <MoveButtons
                  name={banner.alt}
                  index={index}
                  count={banners.length}
                  onMove={onMove}
                />
                <Button
                  variant="outline"
                  onClick={() => onEdit(banner)}
                  aria-label={t("editLabel", { name: banner.alt })}
                  data-testid="banner-edit"
                >
                  {t("edit")}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {atActiveCap ? (
        <p id={capId} className="type-small text-muted">
          {t("activeLimit")}
        </p>
      ) : null}
      {add}
    </Card>
  );
}

function FeaturedCard({
  featured,
  unavailable,
  onPick,
  onMove,
  onRemove,
}: {
  readonly featured: EditorState["featured"];
  readonly unavailable: ReadonlySet<string>;
  readonly onPick: Parameters<typeof ProductPicker>[0]["onPick"];
  readonly onMove: (index: number, by: -1 | 1) => void;
  readonly onRemove: (id: string) => void;
}) {
  const t = useTranslations("AdminHomepage");
  return (
    <Card data-testid="homepage-featured">
      <CardHead title={t("featuredTitle")} />
      {featured.length >= HOME_LIMITS.maxFeatured ? (
        <p className="text-muted" data-testid="featured-cap">
          {t("featuredCap")}
        </p>
      ) : (
        <ProductPicker
          label={t("picker.label")}
          exclude={featured.map((product) => product.id)}
          onPick={onPick}
        />
      )}
      {featured.length === 0 ? (
        <p className="font-bold">{t("noFeatured")}</p>
      ) : (
        <ul aria-label={t("featuredTitle")} className="flex flex-col border-t border-border">
          {featured.map((product, index) => {
            const gone = unavailable.has(product.id);
            return (
              <li
                key={product.id}
                className="flex flex-col gap-1 border-b border-border py-2"
                data-testid="featured-row"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <ProductLine product={product} />
                  <span className="flex items-center gap-2">
                    <MoveButtons
                      name={product.name}
                      index={index}
                      count={featured.length}
                      onMove={onMove}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onRemove(product.id)}
                      aria-label={t("removeFeatured", { name: product.name })}
                      data-testid="featured-remove"
                    >
                      <X aria-hidden />
                    </Button>
                  </span>
                </div>
                {gone ? (
                  <p role="alert" className="type-small font-bold text-danger">
                    {t("productUnavailable")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function MainsCard({
  mains,
  homeIds,
  onTick,
}: {
  readonly mains: HomepageEditorData["mains"];
  readonly homeIds: readonly string[];
  readonly onTick: (id: string, on: boolean) => void;
}) {
  const t = useTranslations("AdminHomepage");
  const ticked = new Set(homeIds);
  return (
    <Card data-testid="homepage-mains">
      <CardHead title={t("mainsTitle")} />
      {mains.length === 0 ? (
        <p className="flex flex-wrap items-center gap-3 font-bold">
          {t("noMains")}
          <Link
            href={routes.admin.categories}
            className="inline-flex min-h-11 items-center underline"
          >
            {t("manageCategories")}
          </Link>
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-6">
          {mains.map((main) => (
            <li key={main.id} className="basis-55">
              <CheckRow>
                <Checkbox
                  checked={ticked.has(main.id)}
                  onCheckedChange={(on) => onTick(main.id, on)}
                  data-testid="main-tick"
                />
                <span className={cn(!main.isVisible || main.isEmpty ? "text-muted" : undefined)}>
                  {main.name}
                  {main.isVisible ? null : ` ${t("mainHidden")}`}
                  {main.isEmpty ? ` ${t("mainEmpty")}` : null}
                </span>
              </CheckRow>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
