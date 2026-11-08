import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-8 (spec 0017). The session helpers and the database are stand ins, so these prove
// where each account reader takes the user from: getVerifiedAccount asks Supabase Auth, so a
// session ended by a reset elsewhere reads as signed out, while getAccountProfile trusts the claims.

vi.mock("server-only", () => ({}));

const getClaims = vi.fn();
const getVerifiedUser = vi.fn();
vi.mock("@/server/auth/session", () => ({ getClaims, getVerifiedUser }));

const limit = vi.fn();
const where = vi.fn(() => ({ limit }));
const db = { select: vi.fn(() => ({ from: () => ({ where }) })) };
vi.mock("@/server/db", () => ({ getDb: async () => db }));

const { getAccountProfile, getVerifiedAccount } = await import("./profile");

const USER_ID = "5b0c7f1e-2d3a-4c5b-8e9f-0a1b2c3d4e5f";
const EMAIL = "ahmad.private@example.com";
const PROFILE = {
  fullName: "أحمد يوسف",
  phone: "0599123456",
  phoneE164: "+970599123456",
  role: "customer",
  removalPending: false,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  limit.mockResolvedValue([PROFILE]);
});

describe("getVerifiedAccount", () => {
  it("returns the account of the user Supabase Auth confirms, with its profile", async () => {
    getVerifiedUser.mockResolvedValue({ id: USER_ID, email: EMAIL });

    await expect(getVerifiedAccount()).resolves.toEqual({
      userId: USER_ID,
      email: EMAIL,
      profile: PROFILE,
    });
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("is null when Supabase Auth no longer knows the session, even if the claims still look valid", async () => {
    getClaims.mockResolvedValue({ sub: USER_ID, email: EMAIL });
    getVerifiedUser.mockResolvedValue(null);

    await expect(getVerifiedAccount()).resolves.toBeNull();
    expect(getClaims).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("reads the email as null when the user has none", async () => {
    getVerifiedUser.mockResolvedValue({ id: USER_ID, email: undefined });

    await expect(getVerifiedAccount()).resolves.toMatchObject({ userId: USER_ID, email: null });
  });

  it("keeps the account with a null profile when the profile row is missing", async () => {
    getVerifiedUser.mockResolvedValue({ id: USER_ID, email: EMAIL });
    limit.mockResolvedValue([]);

    await expect(getVerifiedAccount()).resolves.toEqual({
      userId: USER_ID,
      email: EMAIL,
      profile: null,
    });
  });

  it("lets a database failure throw to the error card", async () => {
    getVerifiedUser.mockResolvedValue({ id: USER_ID, email: EMAIL });
    limit.mockRejectedValue(new Error("connection lost"));

    await expect(getVerifiedAccount()).rejects.toThrow("connection lost");
  });
});

describe("getAccountProfile", () => {
  it("reads the account from the claims without a round trip to Supabase Auth", async () => {
    getClaims.mockResolvedValue({ sub: USER_ID, email: EMAIL });

    await expect(getAccountProfile()).resolves.toEqual({
      userId: USER_ID,
      email: EMAIL,
      profile: PROFILE,
    });
    expect(getVerifiedUser).not.toHaveBeenCalled();
  });

  it("is null when there are no claims", async () => {
    getClaims.mockResolvedValue(null);

    await expect(getAccountProfile()).resolves.toBeNull();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("reads a non string email claim as null", async () => {
    getClaims.mockResolvedValue({ sub: USER_ID, email: 42 });

    await expect(getAccountProfile()).resolves.toMatchObject({ email: null });
  });
});
