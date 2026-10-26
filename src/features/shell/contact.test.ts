import { describe, expect, it } from "vitest";
import { contactLine } from "./contact";

// covers: AC-15 (spec 0003)
describe("contactLine", () => {
  it("shows both parts when both are set", () => {
    expect(contactLine({ phone: "0599 123 456", address: "نابلس، شارع فيصل" })).toEqual({
      phone: "0599 123 456",
      address: "نابلس، شارع فيصل",
    });
  });

  it("shows the phone only", () => {
    expect(contactLine({ phone: "0599 123 456", address: null })).toEqual({
      phone: "0599 123 456",
      address: null,
    });
  });

  it("shows the address only", () => {
    expect(contactLine({ phone: null, address: "نابلس" })).toEqual({
      phone: null,
      address: "نابلس",
    });
  });

  it("hides the line when neither is set, or both are blank", () => {
    expect(contactLine({ phone: null, address: null })).toBeNull();
    expect(contactLine({ phone: "  ", address: "" })).toBeNull();
  });
});
