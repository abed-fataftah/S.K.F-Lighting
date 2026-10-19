import { getTranslations } from "next-intl/server";
import { GallerySection } from "../gallery-section";

// Number samples hold no words, so they live here rather than in ar.json (whose test wants Arabic in every message).
const samples = { price: "₪1,250", kpi: "₪48,300", notFound: "404" } as const;

// Every type-* role from tokens.css (design.md section 3): size / weight / line height.
const roles = [
  { id: "caption", className: "type-caption", spec: "type-caption · 12 / 400 / 1.6" },
  { id: "small", className: "type-small", spec: "type-small · 13 / 400 / 1.5" },
  { id: "body", className: "type-body", spec: "type-body · 14 / 400 / 1.6" },
  { id: "control", className: "type-control", spec: "type-control · 15 / 400 / 1.5" },
  { id: "lead", className: "type-lead", spec: "type-lead · 16 / 800 / 1.5" },
  { id: "titleS", className: "type-title-s", spec: "type-title-s · 18 / 800 / 1.3" },
  { id: "titleM", className: "type-title-m", spec: "type-title-m · 22 / 800 / 1.35" },
  { id: "titleL", className: "type-title-l", spec: "type-title-l · 24 / 800 / 1.3" },
  { id: "displayS", className: "type-display-s", spec: "type-display-s · 26 / 800 / 1.3" },
  { id: "price", className: "type-price", spec: "type-price · 28 / 800 / 1.3" },
  { id: "kpi", className: "type-kpi", spec: "type-kpi · 30 / 800 / 1.3" },
  { id: "hero", className: "type-hero", spec: "type-hero · 32 / 800 / 1.25" },
  { id: "notFound", className: "type-404", spec: "type-404 · 64 / 800 / 1.1" },
  { id: "prose", className: "type-prose", spec: "type-prose · 14 / 400 / 1.8" },
] as const;

export async function TypeSection() {
  const t = await getTranslations("DesignSystem.type");

  return (
    <GallerySection id="type" title={t("title")} text={t("text")}>
      <ul className="flex flex-col rounded-card border border-border bg-white">
        {roles.map((role) => (
          <li
            key={role.id}
            className="flex flex-col gap-1 border-b border-border p-3.5 last:border-b-0"
          >
            <span className="type-caption text-muted">
              {t(`roles.${role.id}`)} · <bdi dir="ltr">{role.spec}</bdi>
            </span>
            <span className={role.className}>
              {role.id in samples ? (
                <bdi dir="ltr">{samples[role.id as keyof typeof samples]}</bdi>
              ) : (
                t("sample")
              )}
            </span>
          </li>
        ))}
      </ul>
    </GallerySection>
  );
}
