import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-2, AC-3, AC-5, AC-7, AC-8, AC-9, AC-10, AC-11, AC-17 (spec 0017). Supabase Auth, the
// session, and the profile writes are stand ins, so these prove what each action checks, calls,
// returns, and logs.

vi.mock("server-only", () => ({}));

class Redirected extends Error {
  constructor(readonly url: string) {
    super(url);
  }
}
const redirect = vi.fn((url: string) => {
  throw new Redirected(url);
});
vi.mock("next/navigation", () => ({ redirect }));

const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));

const getVerifiedUser = vi.fn();
vi.mock("@/server/auth/session", () => ({ getVerifiedUser }));

const db = { name: "db" };
vi.mock("@/server/db", () => ({ getDb: async () => db }));

const savePhoneAfterSignUp = vi.fn();
const updateProfileInDb = vi.fn();
vi.mock("./profile", () => ({ savePhoneAfterSignUp, updateProfileInDb }));

vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "970599123456");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example");

const actions = await import("./actions");

const NAME = "أحمد يوسف";
const PHONE = "0599123456";
const EMAIL = "ahmad.private@example.com";
const PASSWORD = "secret pass 1";
const NEW_PASSWORD = "brand new pass";
const USER_ID = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const PERSONAL = [NAME, PHONE, EMAIL, PASSWORD, NEW_PASSWORD, "ahmad.private"];

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const refused = (status: number, code: string) => ({ error: { status, code }, data: {} });
const redirectOf = (promise: Promise<unknown>) =>
  promise.then(
    (value) => ({ returned: value }),
    (error: unknown) => (error instanceof Redirected ? error.url : Promise.reject(error)),
  );

let logged: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  logged = [];
  const keep = (line: unknown) => void logged.push(String(line));
  vi.spyOn(console, "info").mockImplementation(keep);
  vi.spyOn(console, "warn").mockImplementation(keep);
  vi.spyOn(console, "error").mockImplementation(keep);
  auth.signUp.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  auth.signInWithPassword.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
  auth.updateUser.mockResolvedValue({ data: {}, error: null });
  auth.signOut.mockResolvedValue({ error: null });
  getVerifiedUser.mockResolvedValue({ id: USER_ID, email: EMAIL });
  savePhoneAfterSignUp.mockResolvedValue(undefined);
  updateProfileInDb.mockResolvedValue(undefined);
});

afterEach(() => {
  // No log line ever carries what the customer typed (AC-17).
  for (const value of PERSONAL) expect(logged.join("\n")).not.toContain(value);
  vi.restoreAllMocks();
});

const lines = () => logged.map((line) => JSON.parse(line));

describe("registerCustomer", () => {
  const valid = { name: NAME, phone: PHONE, email: EMAIL, password: PASSWORD };

  it("signs up with the name only in metadata, saves the phone, and goes to next", async () => {
    const url = await redirectOf(
      actions.registerCustomer(null, form({ ...valid, next: "/p/lamp?size=2" })),
    );
    expect(url).toBe("/p/lamp?size=2");
    expect(auth.signUp).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      options: { data: { full_name: NAME } },
    });
    expect(savePhoneAfterSignUp).toHaveBeenCalledWith(db, USER_ID, {
      fullName: NAME,
      phone: { typed: PHONE, e164: "+970599123456" },
    });
    expect(lines()).toEqual([{ event: "account_sign_up", ok: true }]);
  });

  it("sends an unsafe next to the account page", async () => {
    expect(
      await redirectOf(actions.registerCustomer(null, form({ ...valid, next: "//x.y" }))),
    ).toBe("/account");
  });

  it("keeps the account when the phone write throws, and logs the user id only", async () => {
    savePhoneAfterSignUp.mockRejectedValue(new Error("connection lost"));
    expect(await redirectOf(actions.registerCustomer(null, form(valid)))).toBe("/account");
    expect(lines()).toEqual([
      { event: "profile_phone_save_failed", userId: USER_ID },
      { event: "account_sign_up", ok: true },
    ]);
  });

  it("creates nothing for a filled honeypot", async () => {
    const result = await actions.registerCustomer(null, form({ ...valid, company_fax_2: "x" }));
    expect(result).toEqual({ ok: false, error: "failed" });
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(lines()).toEqual([{ event: "account_sign_up", ok: false, code: "honeypot" }]);
  });

  it("returns field errors without calling Supabase", async () => {
    const result = await actions.registerCustomer(null, form({ ...valid, email: "nope" }));
    expect(result).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { email: { code: "email_invalid" } },
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it.each([
    [refused(422, "user_already_exists"), "email_taken"],
    [refused(422, "email_exists"), "email_taken"],
    [refused(422, "weak_password"), "weak_password"],
    [refused(429, "over_request_rate_limit"), "too_many"],
    [refused(500, "unexpected_failure"), "failed"],
    [refused(422, "same_password"), "failed"],
  ])("maps a refusal to %s", async (answer, error) => {
    auth.signUp.mockResolvedValue(answer);
    expect(await actions.registerCustomer(null, form(valid))).toEqual({ ok: false, error });
    expect(savePhoneAfterSignUp).not.toHaveBeenCalled();
    expect(lines()).toEqual([{ event: "account_sign_up", ok: false, code: error }]);
  });
});

describe("signInCustomer", () => {
  it("signs in and goes to next", async () => {
    const url = await redirectOf(
      actions.signInCustomer(
        null,
        form({ email: ` ${EMAIL.toUpperCase()} `, password: PASSWORD, next: "/cart" }),
      ),
    );
    expect(url).toBe("/cart");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
  });

  it.each([
    [refused(400, "invalid_credentials"), "invalid_credentials"],
    [refused(400, "email_not_confirmed"), "invalid_credentials"],
    [refused(429, "over_request_rate_limit"), "too_many"],
  ])("refuses %j as %s", async (answer, error) => {
    auth.signInWithPassword.mockResolvedValue(answer);
    expect(await actions.signInCustomer(null, form({ email: EMAIL, password: "x" }))).toEqual({
      ok: false,
      error,
    });
  });
});

describe("requestPasswordReset", () => {
  it("sends the link back to /auth/confirm on this site", async () => {
    expect(await actions.requestPasswordReset(null, form({ email: EMAIL }))).toEqual({
      ok: true,
      data: { sent: true },
    });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(EMAIL, {
      redirectTo: "https://shop.example/auth/confirm",
    });
  });

  it.each([
    refused(429, "over_email_send_rate_limit"),
    refused(400, "over_request_rate_limit"),
    refused(500, "unexpected_failure"),
  ])("answers sent for a Supabase refusal %j and only logs it", async (answer) => {
    auth.resetPasswordForEmail.mockResolvedValue(answer);
    expect(await actions.requestPasswordReset(null, form({ email: EMAIL }))).toEqual({
      ok: true,
      data: { sent: true },
    });
    expect(lines()[0]).toMatchObject({ event: "account_reset_requested", ok: false });
  });

  it("sends nothing for a filled honeypot, and still answers sent", async () => {
    expect(
      await actions.requestPasswordReset(null, form({ email: EMAIL, company_fax_2: "y" })),
    ).toEqual({ ok: true, data: { sent: true } });
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("returns a field error for a bad email", async () => {
    expect(await actions.requestPasswordReset(null, form({ email: "" }))).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { email: { code: "required" } },
    });
  });
});

describe("confirmRecovery", () => {
  const expired = "/account/sign-in?tab=reset&error=link_expired";

  it("checks the token and goes to the new password page", async () => {
    const url = await redirectOf(
      actions.confirmRecovery(form({ token_hash: "abc123", type: "recovery" })),
    );
    expect(url).toBe("/account/reset-password");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc123" });
  });

  it.each([
    [{ type: "recovery" }],
    [{ token_hash: "", type: "recovery" }],
    [{ token_hash: "abc123", type: "signup" }],
    [{ token_hash: "abc123" }],
  ])("sends %j to the expired message without a Supabase call", async (fields) => {
    expect(await redirectOf(actions.confirmRecovery(form(fields)))).toBe(expired);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("sends a used or expired token to the expired message", async () => {
    auth.verifyOtp.mockResolvedValue(refused(403, "otp_expired"));
    expect(
      await redirectOf(actions.confirmRecovery(form({ token_hash: "abc", type: "recovery" }))),
    ).toBe(expired);
  });
});

describe("setNewPassword", () => {
  const valid = { password: NEW_PASSWORD, confirm: NEW_PASSWORD };

  it("sets the password, ends other sessions, and goes to /account with the notice", async () => {
    expect(await redirectOf(actions.setNewPassword(null, form(valid)))).toBe(
      "/account?notice=password_set",
    );
    expect(auth.updateUser).toHaveBeenCalledWith({ password: NEW_PASSWORD });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("refuses a signed out visitor before anything else", async () => {
    getVerifiedUser.mockResolvedValue(null);
    expect(await actions.setNewPassword(null, form(valid))).toEqual({
      ok: false,
      error: "not_signed_in",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("needs the confirmation to match", async () => {
    expect(
      await actions.setNewPassword(null, form({ password: NEW_PASSWORD, confirm: "other one" })),
    ).toMatchObject({ error: "invalid", fieldErrors: { confirm: { code: "password_mismatch" } } });
  });

  it.each([
    [refused(422, "weak_password"), "weak_password"],
    [refused(422, "same_password"), "same_password"],
    [refused(401, "insufficient_aal"), "owner_needs_runbook"],
    [refused(500, "unexpected_failure"), "failed"],
  ])("maps a refusal to %s and keeps the other sessions", async (answer, error) => {
    auth.updateUser.mockResolvedValue(answer);
    expect(await actions.setNewPassword(null, form(valid))).toEqual({ ok: false, error });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe("changePassword", () => {
  const valid = { current: PASSWORD, password: NEW_PASSWORD, confirm: NEW_PASSWORD };

  it("checks the current password, then sets the new one and ends other sessions", async () => {
    expect(await actions.changePassword(null, form(valid))).toEqual({
      ok: true,
      data: { changed: true },
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: NEW_PASSWORD });
    expect(auth.signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(
      auth.updateUser.mock.invocationCallOrder[0],
    );
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(lines()).toEqual([{ event: "account_password_changed", ok: true }]);
  });

  it("refuses a signed out visitor", async () => {
    getVerifiedUser.mockResolvedValue(null);
    expect(await actions.changePassword(null, form(valid))).toEqual({
      ok: false,
      error: "not_signed_in",
    });
  });

  it("says the current password is wrong without touching the password", async () => {
    auth.signInWithPassword.mockResolvedValue(refused(400, "invalid_credentials"));
    expect(await actions.changePassword(null, form(valid))).toEqual({
      ok: false,
      error: "wrong_current",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("refuses a new password equal to the current one before any call", async () => {
    expect(
      await actions.changePassword(
        null,
        form({ current: PASSWORD, password: PASSWORD, confirm: PASSWORD }),
      ),
    ).toMatchObject({ error: "invalid", fieldErrors: { password: { code: "password_same" } } });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    [refused(422, "weak_password"), "weak_password"],
    [refused(401, "insufficient_aal"), "owner_needs_runbook"],
  ])("maps an update refusal to %s", async (answer, error) => {
    auth.updateUser.mockResolvedValue(answer);
    expect(await actions.changePassword(null, form(valid))).toEqual({ ok: false, error });
  });

  it("passes a sign in rate limit on as too_many", async () => {
    auth.signInWithPassword.mockResolvedValue(refused(429, "over_request_rate_limit"));
    expect(await actions.changePassword(null, form(valid))).toEqual({
      ok: false,
      error: "too_many",
    });
  });
});

describe("updateProfile", () => {
  it("saves the cleaned name and phone for the verified user", async () => {
    expect(
      await actions.updateProfile(null, form({ name: ` ${NAME} `, phone: "+970 599 123 456" })),
    ).toEqual({ ok: true, data: { saved: true } });
    expect(updateProfileInDb).toHaveBeenCalledWith(db, USER_ID, {
      name: NAME,
      phone: { typed: "+970 599 123 456", e164: "+970599123456" },
    });
  });

  it("refuses a signed out visitor and a bad phone", async () => {
    getVerifiedUser.mockResolvedValueOnce(null);
    expect(await actions.updateProfile(null, form({ name: NAME, phone: PHONE }))).toEqual({
      ok: false,
      error: "not_signed_in",
    });
    expect(await actions.updateProfile(null, form({ name: NAME, phone: "0222" }))).toMatchObject({
      error: "invalid",
      fieldErrors: { phone: { code: "phone_mobile" } },
    });
    expect(updateProfileInDb).not.toHaveBeenCalled();
  });

  it("answers failed when the write throws", async () => {
    updateProfileInDb.mockRejectedValue(new Error("down"));
    expect(await actions.updateProfile(null, form({ name: NAME, phone: PHONE }))).toEqual({
      ok: false,
      error: "failed",
    });
  });
});

describe("signOutCustomer", () => {
  it("ends this browser's session only, then goes home", async () => {
    expect(await redirectOf(actions.signOutCustomer())).toBe("/");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
