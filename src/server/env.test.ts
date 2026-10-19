import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { parseServerEnv } = await import("./env");

// covers: AC-19 (spec 0003): the gallery is on only when DESIGN_SYSTEM_PAGE is "1".
describe("parseServerEnv", () => {
  it.each([
    [{}, false],
    [{ DESIGN_SYSTEM_PAGE: "" }, false],
    [{ DESIGN_SYSTEM_PAGE: "0" }, false],
    [{ DESIGN_SYSTEM_PAGE: "1" }, true],
  ])("reads %o as designSystemPage %s", (env, on) => {
    expect(parseServerEnv(env)).toEqual({ designSystemPage: on });
  });

  it("fails loudly on a value that is not 0 or 1", () => {
    expect(() => parseServerEnv({ DESIGN_SYSTEM_PAGE: "yes" })).toThrow();
  });
});
