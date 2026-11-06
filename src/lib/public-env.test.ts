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
    expect(parsePublicEnv(env({}))).toEqual({
      whatsappNumber: "970500000000",
      siteUrl: SITE,
      sentryDsn: null,
      cfBeaconToken: null,
    });
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

// covers: AC-6, AC-13 (spec 0027): both monitoring values are optional, and empty means off.
describe("parsePublicEnv: Sentry DSN and beacon token", () => {
  const DSN = "https://abc123@o1.ingest.sentry.io/42";

  it("reads both when set", () => {
    const parsed = parsePublicEnv(
      env({ NEXT_PUBLIC_SENTRY_DSN: DSN, NEXT_PUBLIC_CF_BEACON_TOKEN: "a1b2c3d4e5" }),
    );
    expect(parsed.sentryDsn).toBe(DSN);
    expect(parsed.cfBeaconToken).toBe("a1b2c3d4e5");
  });

  it.each([undefined, ""])("reads %j as off", (value) => {
    const parsed = parsePublicEnv(
      env({ NEXT_PUBLIC_SENTRY_DSN: value, NEXT_PUBLIC_CF_BEACON_TOKEN: value }),
    );
    expect(parsed.sentryDsn).toBeNull();
    expect(parsed.cfBeaconToken).toBeNull();
  });

  it("rejects a DSN that is not a URL", () => {
    expect(() => parsePublicEnv(env({ NEXT_PUBLIC_SENTRY_DSN: "abc123" }))).toThrow(
      /NEXT_PUBLIC_SENTRY_DSN/,
    );
  });

  it("rejects a beacon token with a script in it", () => {
    expect(() => parsePublicEnv(env({ NEXT_PUBLIC_CF_BEACON_TOKEN: '"><script>' }))).toThrow(
      /NEXT_PUBLIC_CF_BEACON_TOKEN/,
    );
  });
});
