import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { assertDesignSystemPageOn } = await import("./gate");

// covers: AC-19 (spec 0003): the gallery returns 404 unless the flag is on.
describe("design system gallery gate", () => {
  it("shows the not found page when the flag is off", () => {
    expect(() => assertDesignSystemPageOn({ designSystemPage: false })).toThrow("NEXT_NOT_FOUND");
  });

  it("lets the page render when the flag is on", () => {
    expect(() => assertDesignSystemPageOn({ designSystemPage: true })).not.toThrow();
  });
});
