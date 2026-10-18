import { describe, expect, it } from "vitest";
import { routing } from "./routing";

describe("routing", () => {
  it("serves Arabic as the only locale", () => {
    expect(routing.locales).toEqual(["ar"]);
    expect(routing.defaultLocale).toBe("ar");
  });

  it("keeps Arabic URLs unprefixed", () => {
    expect(routing.localePrefix).toBe("as-needed");
  });

  it("never picks a language from the browser or a cookie", () => {
    expect(routing.localeDetection).toBe(false);
    expect(routing.localeCookie).toBe(false);
  });
});
