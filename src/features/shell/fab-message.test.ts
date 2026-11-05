import { describe, expect, it } from "vitest";
import { orderNumberInPath } from "./fab-message";

// covers: AC-9 (spec 0013)
describe("orderNumberInPath", () => {
  it.each([
    ["/checkout/done/26-00042", "26-00042"],
    ["/checkout/done/26-00042/", "26-00042"],
    ["/checkout/done/26-123456", "26-123456"],
    ["/checkout/done/26%2D00042", "26-00042"],
  ])("finds the number in %s", (path, number) => {
    expect(orderNumberInPath(path)).toBe(number);
  });

  it.each([
    "/checkout/done/abc",
    "/checkout/done/%E0%A4%A",
    "/checkout/done/26-00042/x",
    "/checkout/done/26%2F00042",
    "/checkout/done/%D9%A2%D9%A6-00042",
    "/checkout/done/",
    "/checkout/done",
    "/checkout",
    "/",
    "/cart",
    "/x/checkout/done/26-00042",
  ])("gives null for %s", (path) => {
    expect(orderNumberInPath(path)).toBeNull();
  });
});

// covers: AC-12 (spec 0015). The order page sends W7 too; the lookup page stays on W1.
describe("orderNumberInPath on order pages", () => {
  it.each([
    ["/orders/26-00042", "26-00042"],
    ["/orders/26-00042/", "26-00042"],
    ["/orders/26%2D00042", "26-00042"],
  ])("finds the number in %s", (path, number) => {
    expect(orderNumberInPath(path)).toBe(number);
  });

  it.each(["/orders/track", "/orders/track/", "/orders/", "/orders", "/orders/26-00042/x"])(
    "gives null for %s",
    (path) => {
      expect(orderNumberInPath(path)).toBeNull();
    },
  );
});
