import { describe, expect, it } from "vitest";
import { adminRedirect, decideAdminAccess } from "./access";

// covers: AC-1 (spec 0004)
describe("decideAdminAccess", () => {
  const sub = "8c1f0e9e-1d0a-4c55-9a51-7f3c1b0f2d11";

  it("lets an admin with a verified code in", () => {
    expect(decideAdminAccess({ sub, aal: "aal2" }, "admin", sub)).toEqual({
      kind: "admin",
      userId: sub,
    });
  });

  it("asks an admin who only gave a password for a code", () => {
    expect(decideAdminAccess({ sub, aal: "aal1" }, "admin", sub)).toEqual({
      kind: "needs_mfa",
      userId: sub,
    });
    expect(decideAdminAccess({ sub }, "admin", sub)).toEqual({ kind: "needs_mfa", userId: sub });
  });

  it.each(["customer", "electrician", null])("refuses role %j, even at aal2", (role) => {
    expect(decideAdminAccess({ sub, aal: "aal2" }, role, sub)).toEqual({ kind: "not_admin" });
  });

  it("treats missing claims or a missing subject as signed out", () => {
    expect(decideAdminAccess(null, "admin", sub)).toEqual({ kind: "signed_out" });
    expect(decideAdminAccess({ aal: "aal2" }, "admin", sub)).toEqual({ kind: "signed_out" });
  });

  // A token still inside its hour, for a session revoked by sign out or `admin:mfa-reset`.
  it("treats a session Supabase no longer accepts as signed out, whatever the token says", () => {
    expect(decideAdminAccess({ sub, aal: "aal2" }, "admin", null)).toEqual({
      kind: "signed_out",
    });
    expect(decideAdminAccess({ sub, aal: "aal2" }, "admin", "someone-else")).toEqual({
      kind: "signed_out",
    });
  });
});

describe("adminRedirect", () => {
  const userId = "u";

  it("lets an admin through", () => {
    expect(adminRedirect({ kind: "admin", userId }, "/admin/orders")).toBeNull();
  });

  it("sends a password only admin to the code page, keeping where they were going", () => {
    expect(adminRedirect({ kind: "needs_mfa", userId }, "/admin/products/new")).toBe(
      "/admin/mfa?next=%2Fadmin%2Fproducts%2Fnew",
    );
  });

  it("sends everyone else to sign in", () => {
    expect(adminRedirect({ kind: "signed_out" }, "/admin/orders/26-00001")).toBe(
      "/admin/login?next=%2Fadmin%2Forders%2F26-00001",
    );
    expect(adminRedirect({ kind: "not_admin" }, null)).toBe("/admin/login");
  });
});
