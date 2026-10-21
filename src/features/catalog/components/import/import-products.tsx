"use client";

import { CircleCheck, FileSpreadsheet, Images } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Ltr } from "@/components/ltr";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { contextCodes, orderProblems, reviewImport, type ImportContext } from "../../import-plan";
import { runImport, runProblems, runTotals, type RunProgress } from "../../import-run";
import { PHOTO_ACCEPT, type FileError } from "../../import-schemas";
import { parseSheet, type ImportProblem, type ParsedSheet } from "../../import-sheet";
import { PROBLEMS_FILE, TEMPLATE_FILE, problemsSheet, templateSheets } from "../../import-template";
import type { PhotoFile } from "../../photo-names";
import { createMediaUpload } from "../../server/actions";
import {
  getImportLookups,
  importProducts,
  readImportContext,
  setProductPhotos,
} from "../../server/import-actions";
import { resizeImage } from "../resize-image";
import { uploadFile } from "../upload-file";
import { DropZone } from "./drop-zone";
import { readSheetFile } from "./read-sheet";
import { downloadSheets } from "./write-sheet";

// The import page (spec 0007; docs/design/pages/admin-import.md). Client state only:
// empty → reading → reviewed → running → done. The browser reads the sheet and the photo names,
// the server says which codes exist, and the review shows what confirm will do. Nothing is stored
// about the run itself: "تنزيل المشاكل" is how the owner keeps the problems.

type Phase = "empty" | "reading" | "reviewed" | "running" | "done";

type Banner =
  | { readonly kind: "file"; readonly error: FileError; readonly column?: string }
  | { readonly kind: "forbidden" }
  | { readonly kind: "context" }
  | { readonly kind: "template" };

type Sheet = { readonly name: string; readonly parsed: ParsedSheet };
type Photos = { readonly list: readonly PhotoFile[]; readonly files: ReadonlyMap<string, File> };

type Done = {
  readonly totals: ReturnType<typeof runTotals>;
  readonly problems: readonly ImportProblem[];
};

export function ImportProducts() {
  const t = useTranslations("AdminImport");
  const [phase, setPhase] = useState<Phase>("empty");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [photos, setPhotos] = useState<Photos | null>(null);
  const [context, setContext] = useState<ImportContext | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const review = useMemo(
    () => (context ? reviewImport(sheet?.parsed ?? null, context, photos?.list ?? []) : null),
    [context, sheet, photos],
  );
  const running = phase === "running";
  const busy = running || phase === "reading";

  // Closing or reloading the tab while the run is going warns first (AC-15).
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  useEffect(() => {
    if (phase === "done") resultRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (banner) bannerRef.current?.focus();
  }, [banner]);

  // Reads run one after another, each on the latest sheet and photos, so a photo pick made while
  // the sheet is still being read is kept rather than dropped.
  const latest = useRef<{ sheet: Sheet | null; photos: Photos | null }>({
    sheet: null,
    photos: null,
  });
  const queue = useRef<Promise<void>>(Promise.resolve());
  const enqueue = (work: () => Promise<void>) => {
    queue.current = queue.current.then(work, work);
    return queue.current;
  };

  /** Asks the server about the codes on the page, then shows the review (or returns to empty). */
  const reread = async (nextSheet: Sheet | null, nextPhotos: Photos | null) => {
    latest.current = { sheet: nextSheet, photos: nextPhotos };
    setSheet(nextSheet);
    setPhotos(nextPhotos);
    setDone(null);
    if (!nextSheet && !nextPhotos) {
      setContext(null);
      setPhase("empty");
      return;
    }
    const answer = await readImportContext({
      codes: contextCodes(nextSheet?.parsed ?? null, nextPhotos?.list ?? []),
    }).catch(() => null);
    if (!answer?.ok) {
      setBanner({ kind: answer?.error === "forbidden" ? "forbidden" : "context" });
      setContext(null);
      setPhase("empty");
      return;
    }
    setContext(answer.data);
    setPhase("reviewed");
  };

  const chooseSheet = (files: readonly File[]) => {
    const [file] = files;
    if (!file || running) return;
    setPhase("reading");
    setBanner(null);
    void enqueue(async () => {
      const read = await readSheetFile(file);
      const parsed = read.ok ? parseSheet(read.data) : read;
      if (!parsed.ok) {
        setBanner({ kind: "file", error: parsed.error, column: parsed.column });
        return reread(null, latest.current.photos);
      }
      return reread({ name: file.name, parsed: parsed.sheet }, latest.current.photos);
    });
  };

  const choosePhotos = (files: readonly File[]) => {
    if (!files.length || running) return;
    setPhase("reading");
    setBanner(null);
    const entries = files.map((file, index) => [`${index}-${file.name}`, file] as const);
    const picked = {
      list: entries.map(([id, file]) => ({ id, name: file.name, size: file.size })),
      files: new Map(entries),
    };
    void enqueue(() => reread(latest.current.sheet, picked));
  };

  const cancel = () => {
    setBanner(null);
    setProgress(null);
    void enqueue(() => reread(null, null));
  };

  const downloadTemplate = async () => {
    setTemplateBusy(true);
    try {
      const lookups = await getImportLookups();
      if (!lookups.ok) return setBanner({ kind: "forbidden" });
      await downloadSheets(templateSheets(lookups.data), TEMPLATE_FILE);
    } catch {
      setBanner({ kind: "template" });
    } finally {
      setTemplateBusy(false);
    }
  };

  const confirm = async () => {
    if (!review?.canConfirm || busy) return;
    setPhase("running");
    setBanner(null);
    const files = photos?.files ?? new Map<string, File>();
    const result = await runImport(review, {
      importBatch: async (products) => {
        const answer = await importProducts({ products });
        if (answer.ok) return { ok: true, results: answer.data.results };
        return { ok: false, error: answer.error === "forbidden" ? "forbidden" : "failed" };
      },
      preparePhoto: (fileId) => resizeImage(files.get(fileId)!),
      uploadPhoto: async (productId, photo) => {
        const grant = await createMediaUpload({
          productId,
          kind: "image",
          contentType: photo.contentType,
          size: photo.blob.size,
        });
        if (!grant.ok) return grant.error === "forbidden" ? "forbidden" : null;
        await uploadFile(grant.data.signedUrl, photo.blob, photo.contentType, () => {});
        return grant.data.storageKey;
      },
      setPhotos: async (productId, images) => {
        const answer = await setProductPhotos({ productId, images });
        return answer.ok ? "ok" : answer.error === "forbidden" ? "forbidden" : "failed";
      },
      onProgress: setProgress,
    });
    setDone({
      totals: runTotals(sheet?.parsed.products.length ?? 0, result),
      problems: orderProblems([...review.problems, ...runProblems(review, result)]),
    });
    if (result.forbidden) setBanner({ kind: "forbidden" });
    setPhase("done");
  };

  const problems = done?.problems ?? review?.problems ?? [];
  const problemText = (problem: ImportProblem) =>
    t(`problems.${problem.problem}`, {
      column: problem.column ?? "",
      row: formatNumber(problem.withRow ?? 0),
    });
  const fixText = (problem: ImportProblem) =>
    t(`fixes.${problem.problem}`, { row: formatNumber(problem.withRow ?? 0) });

  const downloadProblems = () =>
    void downloadSheets(
      [
        problemsSheet(
          t("problemsSheet"),
          [t("rowColumn"), t("codeColumn"), t("fileColumn"), t("problemColumn"), t("fixColumn")],
          problems.map((problem) => ({
            row: problem.row === null ? "" : formatNumber(problem.row),
            code: problem.code ?? "",
            file: problem.file ?? "",
            problem: problemText(problem),
            fix: fixText(problem),
          })),
        ),
      ],
      PROBLEMS_FILE,
    );

  const status =
    phase === "reading"
      ? t("reading")
      : running && progress
        ? t(progress.stage === "products" ? "runningProducts" : "runningPhotos", {
            done: formatNumber(progress.done),
            total: formatNumber(progress.total),
          })
        : done
          ? t("result", {
              created: formatNumber(done.totals.created),
              updated: formatNumber(done.totals.updated),
              photos: formatNumber(done.totals.photos),
              notImported: formatNumber(done.totals.notImported),
            })
          : "";

  return (
    <div className="flex max-w-(--admin-form-max) flex-col gap-4" data-testid="product-import">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display-s">{t("title")}</h1>
        <ButtonLink variant="outline" render={<Link href={routes.admin.products} />}>
          {t("back")}
        </ButtonLink>
      </div>
      <p className="max-w-prose text-muted">{t("intro")}</p>

      {banner ? (
        <Alert ref={bannerRef} tabIndex={-1} data-testid="import-banner">
          <AlertDescription>
            {banner.kind === "file"
              ? t(`fileErrors.${banner.error}`, { column: banner.column ?? "" })
              : banner.kind === "forbidden"
                ? t("forbidden")
                : banner.kind === "template"
                  ? t("templateFailed")
                  : t("contextFailed")}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <h2 className="flex items-center gap-2 type-title-s">
          <FileSpreadsheet aria-hidden className="size-6" />
          {t("sheetTitle")}
        </h2>
        <DropZone
          title={t("sheetDrop")}
          help={t("sheetHelp")}
          buttonLabel={t("chooseFile")}
          accept=".xlsx,.csv"
          disabled={busy}
          onFiles={chooseSheet}
          inputTestId="sheet-input"
        >
          {sheet ? (
            <p className="type-small font-bold" data-testid="sheet-chosen">
              {t("sheetChosen", { name: sheet.name })} ·{" "}
              {t("sheetProducts", { shown: formatNumber(sheet.parsed.products.length) })}
            </p>
          ) : null}
        </DropZone>
        <Button
          variant="link"
          className="self-start"
          onClick={() => void downloadTemplate()}
          disabled={templateBusy}
          focusableWhenDisabled
          data-testid="template-download"
        >
          {t("template")}
        </Button>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 type-title-s">
          <Images aria-hidden className="size-6" />
          {t("photosTitle")}
        </h2>
        <DropZone
          title={t("photosDrop")}
          help={t("photosHelp")}
          buttonLabel={t("choosePhotos")}
          accept={PHOTO_ACCEPT}
          multiple
          disabled={busy}
          onFiles={choosePhotos}
          inputTestId="photos-input"
        >
          {photos ? (
            <p className="type-small font-bold" data-testid="photos-chosen">
              {t("photosChosen", { shown: formatNumber(photos.list.length) })}
            </p>
          ) : null}
        </DropZone>
      </Card>

      <p
        role="status"
        // Once done, the result card shows the line; this one stays for the announcement.
        className={status && !done ? "type-body font-bold" : "sr-only"}
        data-testid="import-status"
      >
        {status}
      </p>
      {running ? <p className="type-small text-muted">{t("runningNote")}</p> : null}

      {done ? (
        <Card className="border-ink bg-yellow-tint" data-testid="import-done">
          <h2 ref={resultRef} tabIndex={-1} className="flex items-center gap-2 type-title-s">
            <CircleCheck aria-hidden className="size-6" />
            {t("resultTitle")}
          </h2>
          <p className="font-bold" data-testid="import-result">
            {status}
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink render={<Link href={routes.admin.products} />}>
              {t("viewProducts")}
            </ButtonLink>
            <Button variant="outline" onClick={cancel}>
              {t("startOver")}
            </Button>
          </div>
        </Card>
      ) : null}

      {review && (sheet || photos) ? (
        <Card data-testid="import-review">
          <h2 className="type-title-s">{t("reviewTitle")}</h2>
          <ul className="flex flex-wrap gap-2" data-testid="review-chips">
            <li>
              <Badge className="px-3 py-1 type-body" data-testid="chip-ok">
                {t("okRows", { shown: formatNumber(review.okRows) })}
              </Badge>
            </li>
            <li>
              <Badge className="px-3 py-1 type-body" data-testid="chip-problems">
                {t("problemRows", { shown: formatNumber(review.problemRows) })}
              </Badge>
            </li>
            <li>
              <Badge className="px-3 py-1 type-body" data-testid="chip-photos">
                {t("unmatchedPhotos", { shown: formatNumber(review.unmatchedPhotos) })}
              </Badge>
            </li>
          </ul>
          <p className="font-bold" data-testid="review-counts">
            {t("counts", {
              created: formatNumber(review.created),
              updated: formatNumber(review.updated),
            })}
          </p>

          <NewNames
            title={t("newCategories")}
            names={review.newCategories}
            testId="new-categories"
          />
          <NewNames title={t("newColours")} names={review.newColours} testId="new-colours" />

          {review.items.length ? (
            <section className="flex flex-col gap-2" aria-labelledby="import-items-title">
              <h3 id="import-items-title" className="type-lead">
                {t("toWrite")}
              </h3>
              <ul
                aria-label={t("toWriteLabel")}
                className="flex max-h-80 flex-col overflow-y-auto rounded-card border border-border"
                data-testid="review-items"
              >
                {review.items.map((item) => (
                  <li
                    key={item.code}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2 last:border-b-0"
                    data-testid={`review-item-${item.code}`}
                  >
                    <Badge variant={item.kind === "create" ? "new" : "proc"}>
                      {item.kind === "create" ? t("kindCreate") : t("kindUpdate")}
                    </Badge>
                    <span className="font-bold">
                      <Ltr>{item.code}</Ltr>
                    </span>
                    {item.name ? <span>{item.name}</span> : null}
                    <span className="ms-auto type-small text-muted">
                      {item.photos ? t("photoCount", { shown: formatNumber(item.photos) }) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-muted" data-testid="nothing-to-import">
              {t("nothingToImport")}
            </p>
          )}

          <section className="flex flex-col gap-2" aria-labelledby="import-problems-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="import-problems-title" className="type-lead">
                {t("problemsTitle")}
              </h3>
              {problems.length ? (
                <Button
                  variant="outline"
                  onClick={downloadProblems}
                  data-testid="problems-download"
                >
                  {t("downloadProblems")}
                </Button>
              ) : null}
            </div>
            {problems.length ? (
              <Table aria-label={t("problemsTitle")} data-testid="import-problems">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("rowColumn")}</TableHead>
                    <TableHead scope="col">{t("problemColumn")}</TableHead>
                    <TableHead scope="col">{t("fixColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {problems.map((problem, index) => (
                    <TableRow
                      key={`${problem.row ?? problem.file}-${problem.problem}-${index}`}
                      data-testid="problem-row"
                    >
                      <TableCell className="font-bold whitespace-nowrap">
                        {problem.row !== null ? (
                          formatNumber(problem.row)
                        ) : (
                          <Ltr>{problem.file}</Ltr>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal">{problemText(problem)}</TableCell>
                      <TableCell className="whitespace-normal text-muted">
                        {fixText(problem)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted">{t("noProblems")}</p>
            )}
          </section>

          {done ? null : (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={cancel} disabled={running} focusableWhenDisabled>
                {t("cancel")}
              </Button>
              <Button
                onClick={() => void confirm()}
                disabled={!review.canConfirm || busy}
                focusableWhenDisabled
                aria-busy={running || undefined}
                data-testid="import-confirm"
              >
                {t("confirm")}
              </Button>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function NewNames({
  title,
  names,
  testId,
}: {
  readonly title: string;
  readonly names: readonly string[];
  readonly testId: string;
}) {
  if (!names.length) return null;
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <h3 className="type-lead">{title}</h3>
      <ul className="flex flex-wrap gap-2">
        {names.map((name) => (
          <li key={name}>
            <Badge variant="spec">{name}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
