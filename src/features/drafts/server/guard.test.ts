import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/lib/routes";

// covers: AC-1 (spec 0020), AC-8 (spec 0017). The account readers are spies, so these prove which
// reader each check uses and where each visitor is sent: the drafts pages ask Supabase Auth, so a
// session ended by a reset elsewhere goes to sign in; the catalog button still reads the claims.

vi.mock("server-only", () => ({}));

class Redirected extends Error {
  constructor(readonly url: string) {
    super(url);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));

const getAccountProfile = vi.fn();
const getVerifiedAccount = vi.fn();
vi.mock("@/features/accounts/server/profile", () => ({ getAccountProfile, getVerifiedAccount }));

const { requireElectricianPage, canAddToDraft } = await import("./guard");

const USER_ID = "5b0c7f1e-2d3a-4c5b-8e9f-0a1b2c3d4e5f";
const NEXT = routes.drafts;

const account = (role: "customer" | "electrician" | "admin", removalPending = false) => ({
  userId: USER_ID,
  email: null,
  profile: { fullName: null, phone: null, phoneE164: null, role, removalPending },
});

const redirectOf = async (run: Promise<unknown>) => {
  const error = await run.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(Redirected);
  return (error as Redirected).url;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireElectricianPage", () => {
  it("returns the verified account of an electrician", async () => {
    const electrician = account("electrician");
    getVerifiedAccount.mockResolvedValue(electrician);

    await expect(requireElectricianPage(NEXT)).resolves.toBe(electrician);
    expect(getAccountProfile).not.toHaveBeenCalled();
  });

  it("sends a session Supabase Auth no longer knows to sign in, coming back to next", async () => {
    getAccountProfile.mockResolvedValue(account("electrician"));
    getVerifiedAccount.mockResolvedValue(null);

    await expect(redirectOf(requireElectricianPage(NEXT))).resolves.toBe(
      routes.signInWith({ next: NEXT }),
    );
  });

  it.each([
    ["a customer", account("customer")],
    ["the owner", account("admin")],
    ["an electrician whose removal started", account("electrician", true)],
    ["an account with no profile row", { ...account("electrician"), profile: null }],
  ])("sends %s to the account page", async (_who, signedIn) => {
    getVerifiedAccount.mockResolvedValue(signedIn);

    await expect(redirectOf(requireElectricianPage(NEXT))).resolves.toBe(routes.account);
  });
});

describe("canAddToDraft", () => {
  it("is true for an electrician read from the claims", async () => {
    getAccountProfile.mockResolvedValue(account("electrician"));

    await expect(canAddToDraft()).resolves.toBe(true);
    expect(getVerifiedAccount).not.toHaveBeenCalled();
  });

  it.each([
    ["signed out", null],
    ["a customer", account("customer")],
    ["an electrician whose removal started", account("electrician", true)],
  ])("is false when %s", async (_who, signedIn) => {
    getAccountProfile.mockResolvedValue(signedIn);

    await expect(canAddToDraft()).resolves.toBe(false);
  });
});
