import { describe, expect, it } from "vitest";
import { otherRole } from "./roles";
import {
  CUSTOMER_SEARCH_MAX,
  changeRoleSchema,
  customerDetailsSchema,
  customerSearchSchema,
} from "./schemas";

const profileId = "0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e";

// covers: AC-7 (spec 0019)
describe("changeRoleSchema", () => {
  it("takes a switch between customer and electrician", () => {
    expect(changeRoleSchema.parse({ profileId, from: "customer", to: "electrician" })).toEqual({
      profileId,
      from: "customer",
      to: "electrician",
    });
    expect(
      changeRoleSchema.safeParse({ profileId, from: "electrician", to: "customer" }).success,
    ).toBe(true);
  });

  it.each([
    { profileId, from: "customer", to: "customer" },
    { profileId, from: "customer", to: "admin" },
    { profileId, from: "admin", to: "customer" },
    { profileId: "not-a-uuid", from: "customer", to: "electrician" },
    { from: "customer", to: "electrician" },
  ])("refuses %o", (input) => {
    expect(changeRoleSchema.safeParse(input).success).toBe(false);
  });
});

describe("otherRole", () => {
  it("offers the other assignable role", () => {
    expect(otherRole("customer")).toBe("electrician");
    expect(otherRole("electrician")).toBe("customer");
  });
});

// covers: AC-3 (spec 0019)
describe("customerSearchSchema", () => {
  it("takes up to an email's length", () => {
    expect(customerSearchSchema.safeParse({ text: "a".repeat(CUSTOMER_SEARCH_MAX) }).success).toBe(
      true,
    );
    expect(
      customerSearchSchema.safeParse({ text: "a".repeat(CUSTOMER_SEARCH_MAX + 1) }).success,
    ).toBe(false);
  });
});

// covers: AC-10 (spec 0019)
describe("customerDetailsSchema", () => {
  it("uses the account form's name and phone rules", () => {
    expect(
      customerDetailsSchema.parse({ profileId, name: " سامي  خليل ", phone: "٠٥٩٩١٢٣٤٥٦" }),
    ).toMatchObject({ profileId, name: "سامي خليل", phone: { e164: "+970599123456" } });
    expect(customerDetailsSchema.safeParse({ profileId, name: "", phone: "" }).success).toBe(false);
  });
});
