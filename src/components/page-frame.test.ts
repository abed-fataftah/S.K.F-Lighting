import { describe, expect, it } from "vitest";
import { PageFrame, pageFrameClass } from "./page-frame";

// covers: AC-1, AC-3, AC-17 (spec 0029): each page width maps to its one max width token.
describe("pageFrameClass", () => {
  it.each([
    ["phone", "max-w-(--page-max)"],
    ["wide", "max-w-(--content-max)"],
    ["form", "max-w-(--form-max)"],
    ["prose", "max-w-(--prose-max)"],
  ] as const)("centres a %s page at %s", (width, max) => {
    expect(pageFrameClass(width).split(" ")).toEqual(["mx-auto", "w-full", max]);
  });

  it("keeps the page's own classes after the frame's", () => {
    expect(pageFrameClass("wide", "flex flex-col pb-8")).toBe(
      "mx-auto w-full max-w-(--content-max) flex flex-col pb-8",
    );
  });
});

describe("PageFrame", () => {
  it("renders a div with the frame classes and passes other props through", () => {
    const frame = PageFrame({ width: "form", className: "pt-3", id: "x" });

    expect(frame.type).toBe("div");
    expect(frame.props).toMatchObject({
      className: "mx-auto w-full max-w-(--form-max) pt-3",
      id: "x",
    });
  });
});
