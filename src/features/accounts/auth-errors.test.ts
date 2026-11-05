import { describe, expect, it } from "vitest";
import { accountAuthError } from "./auth-errors";

// covers: AC-3, AC-4, AC-5, AC-10 (spec 0017)

describe("accountAuthError", () => {
  it.each([
    [{ status: 429 }, "too_many"],
    [{ status: 429, code: "invalid_credentials" }, "too_many"],
    [{ status: 400, code: "over_request_rate_limit" }, "too_many"],
    [{ status: 400, code: "over_email_send_rate_limit" }, "too_many"],
    [{ status: 422, code: "user_already_exists" }, "email_taken"],
    [{ status: 422, code: "email_exists" }, "email_taken"],
    [{ status: 422, code: "weak_password" }, "weak_password"],
    [{ status: 422, code: "same_password" }, "same_password"],
    [{ status: 400, code: "invalid_credentials" }, "invalid_credentials"],
    [{ status: 401, code: "insufficient_aal" }, "owner_needs_runbook"],
    [{ status: 500, code: "unexpected_failure" }, "failed"],
    [{ status: 400 }, "failed"],
    [{}, "failed"],
    [null, "failed"],
  ] as const)("maps %j to %s", (error, expected) => {
    expect(accountAuthError(error)).toBe(expected);
  });
});
