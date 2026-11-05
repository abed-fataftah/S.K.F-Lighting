"use client";

import { Film, Star, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ChangeEvent, type ReactNode } from "react";
import { ChevronBack, ChevronNext } from "@/components/icons/directional";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { makeMain, movePhoto, photosThenVideo, type MediaTile } from "../editor-state";
import { MEDIA_LIMITS, type MediaContentType, type MediaKind } from "../media-rules";
import { createMediaUpload } from "../server/actions";
import { useEditorField, type SectionProps } from "./editor-fields";
import { resizeImage } from "./resize-image";
import { uploadFile } from "./upload-file";

type Prepared = { readonly blob: Blob; readonly contentType: MediaContentType };

// Photos and one video (spec 0006 AC-8). Each file uploads the moment it is picked, straight to
// Storage through a signed URL, with its progress on its tile; the rows change only on save.
export function MediaSection({
  state,
  setState,
  errors,
  disabled,
  productId,
  newRowId,
}: SectionProps & { readonly productId: string; readonly newRowId: () => string }) {
  const t = useTranslations("AdminProducts");
  const { errorFor } = useEditorField(errors);
  const files = useRef(new Map<string, Prepared>());
  const previews = useRef(new Set<string>());
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const { photos, video } = photosThenVideo(state.media);

  // Local previews are released when the editor goes away.
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const patchTile = (tileId: string, patch: Partial<MediaTile>) =>
    setState((current) => ({
      ...current,
      media: current.media.map((tile) => (tile.tileId === tileId ? { ...tile, ...patch } : tile)),
    }));

  const send = async (tileId: string, kind: MediaKind) => {
    const prepared = files.current.get(tileId);
    if (!prepared) return;
    patchTile(tileId, { status: "uploading", progress: 0 });
    try {
      const grant = await createMediaUpload({
        productId,
        kind,
        contentType: prepared.contentType,
        size: prepared.blob.size,
      });
      if (!grant.ok) {
        patchTile(tileId, { status: grant.error === "forbidden" ? "failed" : "unusable" });
        return;
      }
      await uploadFile(grant.data.signedUrl, prepared.blob, prepared.contentType, (progress) =>
        patchTile(tileId, { progress }),
      );
      patchTile(tileId, { status: "ready", progress: 100, storageKey: grant.data.storageKey });
    } catch {
      patchTile(tileId, { status: "failed" });
    }
  };

  const prepare = async (tileId: string, kind: MediaKind, file: File) => {
    if (kind === "video") {
      if (file.type !== "video/mp4" || file.size > MEDIA_LIMITS.videoMaxBytes) {
        patchTile(tileId, { status: "unusable" });
        return;
      }
      files.current.set(tileId, { blob: file, contentType: "video/mp4" });
    } else {
      const resized = await resizeImage(file);
      if (!resized) {
        patchTile(tileId, { status: "unusable" });
        return;
      }
      const previewUrl = URL.createObjectURL(resized.blob);
      previews.current.add(previewUrl);
      files.current.set(tileId, { blob: resized.blob, contentType: resized.contentType });
      patchTile(tileId, { previewUrl, width: resized.width, height: resized.height });
    }
    await send(tileId, kind);
  };

  const pick = (kind: MediaKind, event: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(event.target.files ?? [])];
    event.target.value = "";
    const room =
      kind === "image"
        ? MEDIA_LIMITS.maxImages - photos.length
        : video
          ? 0
          : MEDIA_LIMITS.maxVideos;
    const added = picked.slice(0, Math.max(0, room)).map((file) => ({
      file,
      tile: {
        tileId: newRowId(),
        kind,
        status: "uploading",
        progress: 0,
        storageKey: null,
        width: null,
        height: null,
        previewUrl: null,
      } satisfies MediaTile,
    }));
    if (!added.length) return;
    setState((current) => {
      const now = photosThenVideo(current.media);
      const tiles = added.map(({ tile }) => tile);
      const media =
        kind === "image"
          ? [...now.photos, ...tiles, ...(now.video ? [now.video] : [])]
          : [...now.photos, ...tiles];
      return { ...current, media };
    });
    for (const { file, tile } of added) void prepare(tile.tileId, kind, file);
  };

  const remove = (tile: MediaTile) => {
    if (tile.previewUrl) {
      URL.revokeObjectURL(tile.previewUrl);
      previews.current.delete(tile.previewUrl);
    }
    files.current.delete(tile.tileId);
    setState((current) => ({
      ...current,
      media: current.media.filter((item) => item.tileId !== tile.tileId),
    }));
  };

  const reorder = (update: (media: readonly MediaTile[]) => readonly MediaTile[]) =>
    setState((current) => ({ ...current, media: update(current.media) }));

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h2 className="type-title-s">{t("media")}</h2>
        <p className="type-small text-muted">
          {t("mediaHelp", { photos: formatNumber(MEDIA_LIMITS.maxImages) })}
        </p>
      </div>

      <ul className="flex flex-wrap gap-3" data-testid="photo-tiles">
        {photos.map((tile, index) => {
          const n = formatNumber(index + 1);
          return (
            <li key={tile.tileId} className="flex w-33 flex-col gap-1" data-testid="photo-tile">
              <TileFrame tile={tile} label={t("photoN", { n })}>
                {index === 0 && tile.status === "ready" ? (
                  <Badge variant="new" className="absolute end-1 top-1">
                    {t("mainPhoto")}
                  </Badge>
                ) : null}
                {disabled ? null : (
                  <RemoveButton label={t("removePhoto", { n })} onClick={() => remove(tile)} />
                )}
              </TileFrame>
              <TileStatus
                tile={tile}
                kind="image"
                onRetry={() => void send(tile.tileId, "image")}
              />
              {disabled ? null : (
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("photoEarlier", { n })}
                    disabled={index === 0}
                    onClick={() => reorder((media) => movePhoto(media, tile.tileId, -1))}
                  >
                    <ChevronBack />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("photoLater", { n })}
                    disabled={index === photos.length - 1}
                    onClick={() => reorder((media) => movePhoto(media, tile.tileId, 1))}
                  >
                    <ChevronNext />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("makeMain", { n })}
                    disabled={index === 0}
                    onClick={() => reorder((media) => makeMain(media, tile.tileId))}
                  >
                    <Star aria-hidden />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
        {!disabled && photos.length < MEDIA_LIMITS.maxImages ? (
          <li>
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="flex size-30 cursor-pointer flex-col items-center justify-center gap-1 rounded-tile border-2 border-dashed border-control-border bg-white px-2 text-center type-body font-bold text-ink hover:bg-yellow-tint"
            >
              {t("addPhoto")}
            </button>
          </li>
        ) : null}
      </ul>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => pick("image", event)}
        data-testid="photo-input"
      />

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h3 className="type-lead">{t("video")}</h3>
        {video ? (
          <div className="flex w-33 flex-col gap-1" data-testid="video-tile">
            <TileFrame tile={video} label={t("video")}>
              {disabled ? null : (
                <RemoveButton label={t("removeVideo")} onClick={() => remove(video)} />
              )}
            </TileFrame>
            <TileStatus
              tile={video}
              kind="video"
              onRetry={() => void send(video.tileId, "video")}
            />
          </div>
        ) : !disabled ? (
          <Button
            variant="outline"
            className="self-start"
            onClick={() => videoInput.current?.click()}
          >
            {t("addVideo")}
          </Button>
        ) : null}
        <input
          ref={videoInput}
          type="file"
          accept="video/mp4"
          hidden
          onChange={(event) => pick("video", event)}
          data-testid="video-input"
        />
      </div>
      {errorFor("media")}
    </Card>
  );
}

/** The 120 by 120 tile on the dark product background: the photo, or a film icon for the video. */
function TileFrame({
  tile,
  label,
  children,
}: {
  readonly tile: MediaTile;
  readonly label: string;
  readonly children: ReactNode;
}) {
  const image =
    tile.kind === "image" && tile.status !== "unusable"
      ? (tile.previewUrl ?? (tile.status === "ready" ? tile.storageKey : null))
      : null;
  return (
    <div className="relative size-30 overflow-hidden rounded-tile bg-product-1">
      {image ? (
        <Image
          src={image}
          alt={label}
          width={120}
          height={120}
          unoptimized={image.startsWith("blob:")}
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-on-dark-muted">
          <Film aria-hidden className="size-10" strokeWidth={1.5} />
          <span className="sr-only">{label}</span>
        </span>
      )}
      {children}
    </div>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className="absolute start-1 top-1 rounded-full"
    >
      <X aria-hidden />
    </Button>
  );
}

function TileStatus({
  tile,
  kind,
  onRetry,
}: {
  readonly tile: MediaTile;
  readonly kind: MediaKind;
  readonly onRetry: () => void;
}) {
  const t = useTranslations("AdminProducts");
  if (tile.status === "ready") return null;
  if (tile.status === "uploading") {
    return (
      <div className="flex flex-col gap-1">
        <progress
          value={tile.progress}
          max={100}
          aria-label={t("uploading", { percent: formatNumber(tile.progress) })}
          className="h-1.5 w-full accent-ink"
        />
        <span aria-hidden className="type-caption text-muted">
          {tile.progress
            ? t("uploading", { percent: formatNumber(tile.progress) })
            : t("preparing")}
        </span>
      </div>
    );
  }
  if (tile.status === "unusable") {
    return (
      <p role="alert" className="type-caption font-bold text-danger">
        {kind === "image" ? t("photoUnusable") : t("videoUnusable")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <p role="alert" className="type-caption font-bold text-danger">
        {t("uploadFailed")}
      </p>
      <Button variant="outline" onClick={onRetry} className="w-full">
        {t("retry")}
      </Button>
    </div>
  );
}
