import { describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";
import { pageWindow, parseAdminPage, splitPage } from "./admin-list";

// covers: AC-13 (spec 0004)
describe("parseAdminPage", () => {
  it.each([
    [undefined, 1],
    ["", 1],
    ["abc", 1],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["2e3", 1],
    ["99999999999999999999", 1],
    ["1", 1],
    ["3", 3],
    [["4", "5"], 4],
  ])("reads %j as page %i", (value, page) => {
    expect(parseAdminPage(value)).toBe(page);
  });
});

describe("pageWindow and splitPage", () => {
  it("reads 51 rows from the page start and shows 50", () => {
    expect(pageWindow(1)).toEqual({ limit: 51, offset: 0 });
    expect(pageWindow(3)).toEqual({ limit: 51, offset: 100 });

    const rows = Array.from({ length: 51 }, (_, i) => i);
    expect(splitPage(rows)).toEqual({ rows: rows.slice(0, 50), hasNext: true });
    expect(splitPage(rows.slice(0, 50))).toEqual({ rows: rows.slice(0, 50), hasNext: false });
  });
});

describe("routes.admin.ordersPage", () => {
  it("leaves page 1 plain", () => {
    expect(routes.admin.ordersPage(1)).toBe("/admin/orders");
    expect(routes.admin.ordersPage(2)).toBe("/admin/orders?page=2");
  });
});
