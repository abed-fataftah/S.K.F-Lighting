import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { GallerySection } from "../gallery-section";

// The contrast table of tokens.css, as samples. Class names are written out in full
// so Tailwind sees them. tokens-contrast.test.ts proves the ratios.
const textPairs = [
  {
    id: "inkOnYellow",
    fg: "--skf-ink",
    bg: "--skf-yellow",
    ratio: "16.29",
    className: "bg-yellow text-ink",
  },
  {
    id: "inkOnWhite",
    fg: "--skf-ink",
    bg: "--skf-white",
    ratio: "18.88",
    className: "bg-white text-ink",
  },
  {
    id: "inkOnPage",
    fg: "--skf-ink",
    bg: "--skf-page",
    ratio: "17.30",
    className: "bg-page text-ink",
  },
  {
    id: "inkOnTint",
    fg: "--skf-ink",
    bg: "--skf-yellow-tint",
    ratio: "17.40",
    className: "bg-yellow-tint text-ink",
  },
  {
    id: "inkOnFill",
    fg: "--skf-ink",
    bg: "--skf-fill-muted",
    ratio: "14.53",
    className: "bg-fill-muted text-ink",
  },
  {
    id: "mutedOnWhite",
    fg: "--skf-muted",
    bg: "--skf-white",
    ratio: "7.46",
    className: "bg-white text-muted",
  },
  {
    id: "mutedOnPage",
    fg: "--skf-muted",
    bg: "--skf-page",
    ratio: "6.83",
    className: "bg-page text-muted",
  },
  {
    id: "mutedOnTint",
    fg: "--skf-muted",
    bg: "--skf-yellow-tint",
    ratio: "6.87",
    className: "bg-yellow-tint text-muted",
  },
  {
    id: "mutedOnFill",
    fg: "--skf-muted",
    bg: "--skf-fill-muted",
    ratio: "5.74",
    className: "bg-fill-muted text-muted",
  },
  {
    id: "whiteOnWhatsapp",
    fg: "--skf-white",
    bg: "--skf-whatsapp",
    ratio: "5.25",
    className: "bg-whatsapp text-white",
  },
  {
    id: "whatsappOnWhite",
    fg: "--skf-whatsapp",
    bg: "--skf-white",
    ratio: "5.25",
    className: "bg-white text-whatsapp",
  },
  {
    id: "yellowOnInk",
    fg: "--skf-yellow",
    bg: "--skf-ink",
    ratio: "16.29",
    className: "bg-ink text-yellow",
  },
  {
    id: "whiteOnInk",
    fg: "--skf-white",
    bg: "--skf-ink",
    ratio: "18.88",
    className: "bg-ink text-white",
  },
  {
    id: "onDarkMutedOnInk",
    fg: "--skf-on-dark-muted",
    bg: "--skf-ink",
    ratio: "13.19",
    className: "bg-ink text-on-dark-muted",
  },
  {
    id: "whiteOnSidebarActive",
    fg: "--skf-white",
    bg: "--skf-sidebar-active",
    ratio: "14.35",
    className: "bg-sidebar-active text-white",
  },
  {
    id: "dangerOnWhite",
    fg: "--skf-danger",
    bg: "--skf-white",
    ratio: "6.54",
    className: "bg-white text-danger",
  },
] as const;

const edgePairs = [
  {
    id: "controlOnWhite",
    fg: "--skf-control-border",
    bg: "--skf-white",
    ratio: "3.47",
    className: "bg-white",
  },
  {
    id: "controlOnPage",
    fg: "--skf-control-border",
    bg: "--skf-page",
    ratio: "3.18",
    className: "bg-page",
  },
] as const;

function TokenNames({ fg, bg }: { readonly fg: string; readonly bg: string }) {
  return (
    <code dir="ltr" className="type-caption break-all">
      {fg} / {bg}
    </code>
  );
}

export async function ColoursSection() {
  const t = await getTranslations("DesignSystem.colours");

  return (
    <GallerySection id="colours" title={t("title")} text={t("text")}>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {textPairs.map((pair) => (
          <li
            key={pair.id}
            className={cn(
              "flex flex-col gap-1 rounded-card border border-border p-3.5",
              pair.className,
            )}
          >
            <span className="type-lead">{t("sample")}</span>
            <span className="type-body">{t(`pairs.${pair.id}`)}</span>
            <TokenNames fg={pair.fg} bg={pair.bg} />
            <span className="type-caption font-extrabold">
              <bdi dir="ltr">{pair.ratio}:1</bdi> · {t("minimum", { min: "4.5" })}
            </span>
          </li>
        ))}
        {edgePairs.map((pair) => (
          <li
            key={pair.id}
            className={cn(
              "flex flex-col gap-1 rounded-card border border-border p-3.5 text-ink",
              pair.className,
            )}
          >
            <span className="flex h-12 items-center rounded-card border border-control-border bg-transparent px-3.5 type-control">
              {t("edge")}
            </span>
            <span className="type-body">{t(`pairs.${pair.id}`)}</span>
            <TokenNames fg={pair.fg} bg={pair.bg} />
            <span className="type-caption font-extrabold">
              <bdi dir="ltr">{pair.ratio}:1</bdi> · {t("minimum", { min: "3" })}
            </span>
          </li>
        ))}
      </ul>
    </GallerySection>
  );
}
