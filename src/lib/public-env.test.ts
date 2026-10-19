import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./public-env";

// covers: AC-17 (spec 0003): a missing or malformed WhatsApp number fails the parse.
describe("parsePublicEnv", () => {
  it("accepts digits with the country code", () => {
    expect(parsePublicEnv({ NEXT_PUBLIC_WHATSAPP_NUMBER: "970500000000" })).toEqual({
      whatsappNumber: "970500000000",
    });
  });

  it.each(["12345678", "123456789012345"])("accepts the edge length %s", (number) => {
    expect(parsePublicEnv({ NEXT_PUBLIC_WHATSAPP_NUMBER: number }).whatsappNumber).toBe(number);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["too short", "1234567"],
    ["too long", "1234567890123456"],
    ["with a plus", "+970500000000"],
    ["with spaces", "970 50 000 0000"],
  ])("rejects a number that is %s", (_name, number) => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_WHATSAPP_NUMBER: number })).toThrow(
      /NEXT_PUBLIC_WHATSAPP_NUMBER/,
    );
  });
});
