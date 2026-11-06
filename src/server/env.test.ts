import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { parseServerEnv, CF_GRAPHQL_DEFAULT_URL } = await import("./env");

// covers: AC-19 (spec 0003): the gallery is on only when DESIGN_SYSTEM_PAGE is "1".
describe("parseServerEnv", () => {
  it.each([
    [{}, false],
    [{ DESIGN_SYSTEM_PAGE: "" }, false],
    [{ DESIGN_SYSTEM_PAGE: "0" }, false],
    [{ DESIGN_SYSTEM_PAGE: "1" }, true],
  ])("reads %o as designSystemPage %s", (env, on) => {
    expect(parseServerEnv(env)).toEqual({ designSystemPage: on, cf: null });
  });

  it("fails loudly on a value that is not 0 or 1", () => {
    expect(() => parseServerEnv({ DESIGN_SYSTEM_PAGE: "yes" })).toThrow();
  });
});

const CF = {
  CF_ACCOUNT_ID: "acc123",
  CF_WEB_ANALYTICS_SITE_TAG: "site456",
  CF_ANALYTICS_API_TOKEN: "token789",
};

// covers: AC-7 (spec 0027): all three Web Analytics values or none, and a safe stub address.
describe("parseServerEnv: Web Analytics", () => {
  it("builds the read settings when all three are set, on the real endpoint", () => {
    expect(parseServerEnv(CF).cf).toEqual({
      accountId: "acc123",
      siteTag: "site456",
      token: "token789",
      graphqlUrl: CF_GRAPHQL_DEFAULT_URL,
    });
  });

  it("reads none set, or all empty, as not set up", () => {
    expect(parseServerEnv({}).cf).toBeNull();
    expect(
      parseServerEnv({
        CF_ACCOUNT_ID: "",
        CF_WEB_ANALYTICS_SITE_TAG: "",
        CF_ANALYTICS_API_TOKEN: "",
      }).cf,
    ).toBeNull();
  });

  it("fails at startup on a partial set, naming the missing ones", () => {
    expect(() => parseServerEnv({ CF_ACCOUNT_ID: "acc123" })).toThrow(
      /missing: CF_WEB_ANALYTICS_SITE_TAG, CF_ANALYTICS_API_TOKEN/,
    );
  });

  it.each(["http://127.0.0.1:8790/graphql", "http://localhost:8790/graphql"])(
    "accepts the local stub %s",
    (url) => {
      expect(parseServerEnv({ ...CF, CF_GRAPHQL_URL: url }).cf?.graphqlUrl).toBe(url);
    },
  );

  it.each(["https://evil.example/graphql", "https://127.0.0.1.evil.example/graphql", "nope"])(
    "rejects %s, so the token never leaves for another address",
    (url) => {
      expect(() => parseServerEnv({ ...CF, CF_GRAPHQL_URL: url })).toThrow(/CF_GRAPHQL_URL/);
    },
  );
});
