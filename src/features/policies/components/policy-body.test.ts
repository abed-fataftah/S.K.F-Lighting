import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PolicyBody, safeUrl } from "./policy-body";

// covers: AC-9 (spec 0025): only the allow list is drawn, raw HTML shows as text, and only safe
// links survive.

const html = (markdown: string) => renderToStaticMarkup(createElement(PolicyBody, { markdown }));
const inner = (markdown: string) =>
  html(markdown)
    .replace(/^<div[^>]*>/, "")
    .replace(/<\/div>$/, "");

describe("PolicyBody", () => {
  it("draws # and ## as h2, and #### as h3", () => {
    expect(inner("# أ\n\n## ب\n\n#### ج")).toMatch(
      /^<h2[^>]*>أ<\/h2>\n?<h2[^>]*>ب<\/h2>\n?<h3[^>]*>ج<\/h3>$/,
    );
    expect(html("# أ")).not.toContain("<h1");
  });

  it("turns a single Enter into a line break", () => {
    expect(inner("سطر أول\nسطر ثان")).toBe("<p>سطر أول<br/>\nسطر ثان</p>");
  });

  it("draws lists, bold, and italic", () => {
    const out = html("- بند **عريض** و*مائل*\n\n1. أول");
    expect(out).toContain("<strong>عريض</strong>");
    expect(out).toContain("<em>مائل</em>");
    expect(out).toMatch(/<ul[^>]*>\s*<li>بند/);
    expect(out).toMatch(/<ol[^>]*>\s*<li>أول<\/li>/);
  });

  it("shows raw HTML as plain text, never as an element", () => {
    const out = html('<script>alert(1)</script>\n\nنص <b onclick="x()">عريض</b>');
    expect(out).not.toMatch(/<script|<b[ >]/);
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).toContain("&lt;b onclick=&quot;x()&quot;&gt;");
  });

  it("drops images, and unwraps quotes and code to their text", () => {
    const out = html("![صورة](https://example.com/a.png)\n\n> اقتباس\n\n`رمز`\n\n```\nكتلة\n```");
    expect(out).not.toMatch(/<img|<blockquote|<code|<pre/);
    expect(out).toContain("اقتباس");
    expect(out).toContain("رمز");
    expect(out).toContain("كتلة");
  });

  it("keeps https, mailto, tel, and same site links, and drops javascript ones", () => {
    const out = html(
      "[أ](https://example.com) [ب](mailto:a@b.co) [ج](tel:+970599) [د](/policies/terms) [هـ](javascript:alert(1)) [و](http://example.com)",
    );
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('href="mailto:a@b.co"');
    expect(out).toContain('href="tel:+970599"');
    expect(out).toContain('href="/policies/terms"');
    expect(out).not.toContain("javascript");
    expect(out).not.toContain("http://example.com");
    expect(out).toContain("هـ");
  });

  it("has no tables, since GFM is off", () => {
    expect(html("| أ | ب |\n|---|---|\n| 1 | 2 |")).not.toContain("<table");
  });
});

describe("safeUrl", () => {
  it("refuses protocol relative and backslash paths", () => {
    expect(safeUrl("//evil.example")).toBeNull();
    expect(safeUrl("/\\evil.example")).toBeNull();
    expect(safeUrl(" JavaScript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl("HTTPS://example.com")).toBe("HTTPS://example.com");
  });
});
