import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/lib/form-errors";
import { saveBannerSchema, saveHomepageSchema } from "./schemas";

const FILE = "9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
const ID = "8A1D2B3C-4D5E-4F60-8A71-B2C3D4E5F607";

const banner = (fields: Record<string, unknown> = {}) => ({
  version: 2,
  imageKey: `banners/${FILE}.webp`,
  alt: "  خصم   على الثريات ",
  link: { kind: "none" },
  ...fields,
});

const errorsOf = (fields: Record<string, unknown>) => {
  const result = saveBannerSchema.safeParse(banner(fields));
  return result.success ? {} : fieldErrorsOf(result.error);
};

// covers: AC-10, AC-11, AC-12 (spec 0011)
describe("saveBannerSchema", () => {
  it("tidies the title and lower cases the ids", () => {
    expect(saveBannerSchema.parse(banner({ id: ID, link: { kind: "category", id: ID } }))).toEqual({
      version: 2,
      id: ID.toLowerCase(),
      imageKey: `banners/${FILE}.webp`,
      alt: "خصم على الثريات",
      link: { kind: "category", id: ID.toLowerCase() },
    });
  });

  it("needs a title of 3 to 120 characters after tidying", () => {
    expect(errorsOf({ alt: " اب " }).alt).toEqual({ code: "too_short", params: { min: 3 } });
    expect(errorsOf({ alt: "ب".repeat(121) }).alt).toEqual({
      code: "too_long",
      params: { max: 120 },
    });
  });

  it("needs a banner key in the server's shape", () => {
    expect(errorsOf({ imageKey: "" }).imageKey).toBeDefined();
    expect(errorsOf({ imageKey: `categories/${FILE}.webp` }).imageKey).toBeDefined();
  });

  it("takes one link target at most", () => {
    const linkErrors = (link: unknown) =>
      Object.keys(errorsOf({ link })).filter((field) => field.startsWith("link"));
    expect(linkErrors({ kind: "product" })).not.toEqual([]);
    expect(linkErrors({ kind: "url", id: ID })).not.toEqual([]);
  });
});

describe("saveHomepageSchema", () => {
  it("lower cases every id and keeps the order", () => {
    expect(
      saveHomepageSchema.parse({
        version: 0,
        banners: [{ id: ID, isActive: true }],
        featured: [ID],
        homeCategoryIds: [],
      }),
    ).toEqual({
      version: 0,
      banners: [{ id: ID.toLowerCase(), isActive: true }],
      featured: [ID.toLowerCase()],
      homeCategoryIds: [],
    });
  });
});
