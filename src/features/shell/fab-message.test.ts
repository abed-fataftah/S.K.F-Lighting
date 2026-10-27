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
    "/checkout/done/",
    "/checkout/done",
    "/checkout",
    "/",
    "/cart",
    "/orders/26-00042",
    "/x/checkout/done/26-00042",
  ])("gives null for %s", (path) => {
    expect(orderNumberInPath(path)).toBeNull();
  });
});
