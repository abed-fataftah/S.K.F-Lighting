import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-14 (spec 0027): the account id and a known role, on the request's own scope.

vi.mock("server-only", () => ({}));

const scope = { setUser: vi.fn(), setTag: vi.fn() };
vi.mock("@sentry/nextjs", () => ({ getIsolationScope: () => scope }));

const { tagSentryRole, tagSentryUser } = await import("./user");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tagSentryUser", () => {
  it("sets the account id and nothing else", () => {
    tagSentryUser("3f6c1a52-8e1b-4c1e-9a55-2b1f0e7d9c11");
    expect(scope.setUser).toHaveBeenCalledWith({ id: "3f6c1a52-8e1b-4c1e-9a55-2b1f0e7d9c11" });
  });

  it("never throws", () => {
    scope.setUser.mockImplementationOnce(() => {
      throw new Error("sentry down");
    });
    expect(() => tagSentryUser("x")).not.toThrow();
  });
});

describe("tagSentryRole", () => {
  it.each(["customer", "electrician", "admin"])("tags %s", (role) => {
    tagSentryRole(role);
    expect(scope.setTag).toHaveBeenCalledWith("role", role);
  });

  it("tags nothing for no profile or an unknown value", () => {
    tagSentryRole(null);
    tagSentryRole("0599123456");
    expect(scope.setTag).not.toHaveBeenCalled();
  });
});
