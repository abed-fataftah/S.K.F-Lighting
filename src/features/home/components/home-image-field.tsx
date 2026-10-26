"use client";

import { ImagePlus, Lamp } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ChangeEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { cropImage, type ResizedImage } from "@/features/catalog/components/resize-image";
import { uploadFile } from "@/features/catalog/components/upload-file";
import { HOME_CROPS, type HomeImageTarget } from "@/features/catalog/media-rules";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createHomeImageUpload } from "../server/actions";

/** Where the picture stands: nothing, the stored key, or a new file on its way to Storage. */
export type HomeImageValue =
  | { readonly status: "empty" }
  | { readonly status: "stored"; readonly key: string }
  | { readonly status: "uploading"; readonly progress: number; readonly preview: string }
  | { readonly status: "ready"; readonly key: string; readonly preview: string }
  | { readonly status: "failed"; readonly preview: string }
  | { readonly status: "too_small" | "unusable" };

export const imageValueOf = (key: string | null): HomeImageValue =>
  key ? { status: "stored", key } : { status: "empty" };

/** The key to save: the stored one, or the new upload once it is in Storage. */
export const imageKeyOf = (value: HomeImageValue): string | null =>
  value.status === "stored" || value.status === "ready" ? value.key : null;

/** Saving waits while an upload runs or has failed (AC-10). */
export const imageBusy = (value: HomeImageValue): boolean =>
  value.status === "uploading" || value.status === "failed";

// A banner picture or a circle photo (spec 0011 AC-10, AC-11). The picked file is cropped in the
// browser to the centred area, uploads at once through a signed URL with its progress on the
// preview, and a failed upload offers a retry. Nothing here touches the saved rows: the dialog's
// save does. A file left behind by a closed dialog is the weekly sweep's (AC-13).
export function HomeImageField({
  target,
  value,
  onChange,
  labelId,
  helpId,
  help,
  tooSmallText,
  alt,
  error,
  removable = false,
}: {
  readonly target: HomeImageTarget;
  readonly value: HomeImageValue;
  readonly onChange: (value: HomeImageValue) => void;
  /** The visible label's id; the pick button reads it as part of its name. */
  readonly labelId: string;
  readonly helpId: string;
  readonly help: ReactNode;
  readonly tooSmallText: string;
  /** Names the preview for screen readers. */
  readonly alt: string;
  /** A message from the save (`media_invalid`, required). */
  readonly error?: string | null;
  /** The category photo can be removed; a banner always has one. */
  readonly removable?: boolean;
}) {
  const t = useTranslations("AdminHomepage.image");
  const input = useRef<HTMLInputElement>(null);
  const prepared = useRef<ResizedImage | null>(null);
  const previews = useRef(new Set<string>());
  // Each upload's number: a newer pick or retry makes an older one's progress stale.
  const attempt = useRef(0);
  const errorId = useId();

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const send = async (preview: string) => {
    const file = prepared.current;
    if (!file) return;
    const current = ++attempt.current;
    onChange({ status: "uploading", progress: 0, preview });
    try {
      const grant = await createHomeImageUpload({
        target,
        contentType: file.contentType,
        size: file.blob.size,
      });
      if (!grant.ok) {
        onChange(
          grant.error === "forbidden" ? { status: "failed", preview } : { status: "unusable" },
        );
        return;
      }
      await uploadFile(grant.data.signedUrl, file.blob, file.contentType, (progress) => {
        if (current === attempt.current) onChange({ status: "uploading", progress, preview });
      });
      if (current === attempt.current)
        onChange({ status: "ready", key: grant.data.storageKey, preview });
    } catch {
      if (current === attempt.current) onChange({ status: "failed", preview });
    }
  };

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const cropped = await cropImage(file, HOME_CROPS[target]);
    if (cropped === "too_small" || cropped === null) {
      prepared.current = null;
      attempt.current += 1;
      onChange({ status: cropped ?? "unusable" });
      return;
    }
    prepared.current = cropped;
    const preview = URL.createObjectURL(cropped.blob);
    previews.current.add(preview);
    await send(preview);
  };

  const shown =
    value.status === "stored"
      ? { src: value.key, local: false }
      : "preview" in value
        ? { src: value.preview, local: true }
        : null;
  const message =
    value.status === "too_small"
      ? tooSmallText
      : value.status === "unusable"
        ? t("unusable")
        : value.status === "failed"
          ? t("failed")
          : (error ?? null);
  const describedBy = message ? `${helpId} ${errorId}` : helpId;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden border border-control-border bg-fill-muted",
          target === "banner" ? "aspect-video w-full rounded-card" : "size-30 rounded-full",
        )}
        data-testid="home-image-preview"
      >
        {shown ? (
          shown.local ? (
            // A local preview of the cropped file: not in Storage yet, so no loader.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown.src} alt={alt} className="size-full object-cover" />
          ) : (
            <Image src={shown.src} alt={alt} fill sizes="480px" className="object-cover" />
          )
        ) : (
          <Lamp aria-hidden className="size-10 text-muted" strokeWidth={1.5} />
        )}
        {value.status === "uploading" ? (
          <span
            role="status"
            className="absolute start-0 end-0 bottom-0 bg-ink/70 px-2 py-1 text-center type-caption font-bold text-white"
          >
            {t("uploading", { percent: formatNumber(value.progress) })}
          </span>
        ) : null}
      </div>
      <FieldDescription id={helpId}>{help}</FieldDescription>
      <FieldError id={errorId}>{message}</FieldError>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => void pick(event)}
          data-testid="home-image-input"
        />
        <Button
          variant="outline"
          onClick={() => input.current?.click()}
          disabled={value.status === "uploading"}
          aria-describedby={describedBy}
          aria-labelledby={`${labelId} ${labelId}-pick`}
        >
          <ImagePlus aria-hidden />
          <span id={`${labelId}-pick`}>
            {value.status === "empty" || value.status === "too_small" || value.status === "unusable"
              ? t("pick")
              : t("replace")}
          </span>
        </Button>
        {value.status === "failed" ? (
          <Button variant="outline" onClick={() => void send(value.preview)}>
            {t("retry")}
          </Button>
        ) : null}
        {removable && (value.status === "stored" || value.status === "ready") ? (
          <Button variant="outline" onClick={() => onChange({ status: "empty" })}>
            {t("remove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
