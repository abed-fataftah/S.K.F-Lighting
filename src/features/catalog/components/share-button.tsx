"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { productLink } from "../product-view";
import { useProductSelection } from "./product-selection";

const NOTICE_MS = 2000;

type Notice = "copied" | "copyFailed";

// "مشاركة المنتج" (spec 0009 AC-13): the system share sheet with the same link as W3; without it,
// or when it fails for any reason but a cancel, the link is copied instead. The notice region is
// always rendered so screen readers announce it.
export function ShareButton({ siteUrl }: { readonly siteUrl: string }) {
  const t = useTranslations("Catalog");
  const { data, selectedId } = useProductSelection();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const copy = async (url: string) => {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setNotice("copied");
    } catch {
      setNotice("copyFailed");
    }
  };

  const share = async () => {
    const url = productLink(siteUrl, data, selectedId);
    if (typeof navigator.share !== "function") return copy(url);
    try {
      await navigator.share({ title: data.name, url });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy(url);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label={t("share")}
        onClick={share}
        data-testid="share-product"
      >
        <Share2 aria-hidden />
      </Button>
      <span
        aria-live="polite"
        className="type-caption whitespace-nowrap text-muted"
        data-testid="share-notice"
      >
        {notice === "copied" ? t("linkCopied") : notice === "copyFailed" ? t("copyFailed") : null}
      </span>
    </div>
  );
}
