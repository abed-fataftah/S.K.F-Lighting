import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, serializeJsonLd } from "./seo";

// covers: AC-16 (spec 0008); AC-15 (spec 0009)
describe("breadcrumbJsonLd", () => {
  it("numbers the items from 1", () => {
    expect(
      breadcrumbJsonLd([
        { name: "الرئيسية", url: "https://skf.example/" },
        { name: "ثريات", url: "https://skf.example/c/ch" },
      ]).itemListElement,
    ).toEqual([
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: "https://skf.example/" },
      { "@type": "ListItem", position: 2, name: "ثريات", item: "https://skf.example/c/ch" },
    ]);
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so product text cannot close the script tag", () => {
    const json = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
