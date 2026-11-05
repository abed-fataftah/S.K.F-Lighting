import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./public-env";

const SITE = "https://skf.example";
const env = (overrides: Record<string, string | undefined>) => ({
  NEXT_PUBLIC_WHATSAPP_NUMBER: "970500000000",
  NEXT_PUBLIC_SITE_URL: SITE,
  ...overrides,
});

// covers: AC-17 (spec 0003): a missing or malformed WhatsApp number fails the parse.
describe("parsePublicEnv: WhatsApp number", () => {
  it("accepts digits with the country code", () => {
    expect(parsePublicEnv(env({}))).toEqual({ whatsappNumber: "970500000000", siteUrl: SITE });
  });

  it.each(["12345678", "123456789012345"])("accepts the edge length %s", (number) => {
    expect(parsePublicEnv(env({ NEXT_PUBLIC_WHATSAPP_NUMBER: number })).whatsappNumber).toBe(
      number,
    );
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["too short", "1234567"],
    ["too long", "1234567890123456"],
    ["with a plus", "+970500000000"],
    ["with spaces", "970 50 000 0000"],
  ])("rejects a number that is %s", (_name, number) => {
    expect(() => parsePublicEnv(env({ NEXT_PUBLIC_WHATSAPP_NUMBER: number }))).toThrow(
      /NEXT_PUBLIC_WHATSAPP_NUMBER/,
    );
  });
});

// covers: AC-12 (spec 0004): the W5 order link base.
describe("parsePublicEnv: site URL", () => {
  it.each(["http://localhost:3000", "http://localhost:8787", "https://skf.example"])(
    "accepts %s",
    (url) => {
      expect(parsePublicEnv(env({ NEXT_PUBLIC_SITE_URL: url })).siteUrl).toBe(url);
    },
  );

  it.each([undefined, "", "skf.example", "/shop", "https://skf.example/", "ftp://skf.example"])(
    "rejects %j",
    (url) => {
      expect(() => parsePublicEnv(env({ NEXT_PUBLIC_SITE_URL: url }))).toThrow(
        /NEXT_PUBLIC_SITE_URL/,
      );
    },
  );
});
