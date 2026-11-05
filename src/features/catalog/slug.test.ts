import { describe, expect, it } from "vitest";
import { buildProductSlug, nextFreeSlug, slugify } from "./slug";

describe("buildProductSlug", () => {
  it.each([
    ["ثريا كريستال", "CH-1020", "ثريا-كريستال-CH-1020"],
    ["ثُرَيّا كْرِيسْتَال", "CH-1020", "ثريا-كريستال-CH-1020"],
    ["ثريـــا كريستال", "CH-1020", "ثريا-كريستال-CH-1020"],
    ["  ثريا،  كريستال!  ", "CH-1020", "ثريا-كريستال-CH-1020"],
    ["لمبة LED ٩ واط", "LB-9W", "لمبة-led-٩-واط-LB-9W"],
    ["Spot Light 12W", "SP-12", "spot-light-12w-SP-12"],
    ["ثريا / ذهبي (كبير)", "CH-7", "ثريا-ذهبي-كبير-CH-7"],
  ])("%s with code %s gives %s", (name, code, expected) => {
    expect(buildProductSlug(name, code)).toBe(expected);
  });

  it("keeps the code in its own case", () => {
    expect(buildProductSlug("Lamp", "AB-1x")).toBe("lamp-AB-1x");
  });

  it("falls back to the code alone when the name has nothing to keep", () => {
    expect(buildProductSlug("— ★ —", "CH-1")).toBe("CH-1");
  });
});

describe("slugify", () => {
  it("cleans a category name the same way, without a code", () => {
    expect(slugify("إنارة داخلية")).toBe("إنارة-داخلية");
  });

  it("removes Arabic question marks and commas, which are Arabic script but not letters", () => {
    expect(slugify("ماذا؟ هذا، ذاك")).toBe("ماذا-هذا-ذاك");
  });

  it("gives an empty string for punctuation only", () => {
    expect(slugify("---")).toBe("");
  });
});

// covers: AC-2 (spec 0004), a new category's slug
describe("nextFreeSlug", () => {
  it("keeps a free slug", () => {
    expect(nextFreeSlug("ثريات", ["إنارة"])).toBe("ثريات");
  });

  it("adds -2, -3 on a clash, filling the first gap", () => {
    expect(nextFreeSlug("ثريات", ["ثريات"])).toBe("ثريات-2");
    expect(nextFreeSlug("ثريات", ["ثريات", "ثريات-2", "ثريات-3"])).toBe("ثريات-4");
    expect(nextFreeSlug("ثريات", ["ثريات", "ثريات-3"])).toBe("ثريات-2");
  });
});
