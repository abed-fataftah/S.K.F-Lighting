import { describe, expect, it } from "vitest";
import { isFreshRecovery, recoveryCookieValue, RECOVERY_WINDOW_SECONDS } from "./recovery-cookie";

// covers: AC-8 (spec 0017)

const USER = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const OTHER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const AT = 1_793_477_034;

describe("isFreshRecovery", () => {
  it("accepts the cookie for the same user from now up to 10 minutes later", () => {
    const value = recoveryCookieValue(USER, AT);
    expect(isFreshRecovery(value, USER, AT)).toBe(true);
    expect(isFreshRecovery(value, USER, AT + RECOVERY_WINDOW_SECONDS)).toBe(true);
  });

  it("refuses it one second past the window", () => {
    expect(isFreshRecovery(recoveryCookieValue(USER, AT), USER, AT + 601)).toBe(false);
  });

  it("refuses a cookie set for another account", () => {
    expect(isFreshRecovery(recoveryCookieValue(OTHER, AT), USER, AT)).toBe(false);
  });

  it("refuses a stamp from the future", () => {
    expect(isFreshRecovery(recoveryCookieValue(USER, AT + 5), USER, AT)).toBe(false);
  });

  it.each([
    undefined,
    "",
    USER,
    `${USER}.`,
    `.${AT}`,
    `${USER}.abc`,
    `${USER}.-5`,
    `${USER}.1e9`,
    `${USER}.${AT}.${AT}`,
  ])("refuses the malformed value %j", (raw) => {
    expect(isFreshRecovery(raw, USER, AT)).toBe(false);
  });
});
