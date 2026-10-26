// The homepage editor's inputs (spec 0011, API surface), checked by the same schemas in the
// browser and in the actions. Ids are lower cased; free text is tidied (spec 0005).
import { z } from "zod";
import { isHomeImageKey } from "@/features/catalog/media-rules";
import { tidiedText } from "@/lib/text-schemas";

export const BANNER_ALT = { min: 3, max: 120 } as const;

const id = z.guid().transform((value) => value.toLowerCase());
const version = z.number().int().min(0);

export const bannerLinkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("category"), id }),
  z.object({ kind: z.literal("product"), id }),
]);

export type BannerLinkInput = z.input<typeof bannerLinkSchema>;
export type BannerLink = z.output<typeof bannerLinkSchema>;

export const saveBannerSchema = z.object({
  version,
  // Missing creates a banner; otherwise the banner being edited.
  id: id.optional(),
  imageKey: z
    .string({ error: "required" })
    .max(200)
    .refine((key) => isHomeImageKey(key, "banner"), { message: "required" }),
  alt: tidiedText({ min: BANNER_ALT.min, max: BANNER_ALT.max }),
  link: bannerLinkSchema,
});

export type SaveBannerInput = z.input<typeof saveBannerSchema>;
export type SaveBannerData = z.output<typeof saveBannerSchema>;

export const deleteBannerSchema = z.object({ version, id });

// The caps are checked by the save plan, so a long list says `too_many_*`, not `invalid`.
export const saveHomepageSchema = z.object({
  version,
  banners: z.array(z.object({ id, isActive: z.boolean() })).max(100),
  featured: z.array(id).max(100),
  homeCategoryIds: z.array(id).max(500),
});

export type SaveHomepageInput = z.input<typeof saveHomepageSchema>;

export const homeUploadSchema = z.object({
  target: z.enum(["banner", "category"]),
  contentType: z.string().max(100),
  size: z.number().int().min(1),
});

export const homeSearchSchema = z.object({
  q: z.string().max(100),
  // Products already picked, left out in SQL so up to ten new ones still come back (AC-12).
  exclude: z.array(id).max(20).default([]),
});
