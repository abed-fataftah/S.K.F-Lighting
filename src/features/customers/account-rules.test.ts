import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import {
  changedFields,
  customerTotals,
  historyLine,
  removalBlock,
  type AccountEventView,
  type MoneyOrder,
} from "./account-rules";

const t = createTranslator({ locale: "ar", messages: ar, namespace: "AdminCustomers" });

const phone = (typed: string, e164: string) => ({ typed, e164 });
const current = { fullName: "سامي خليل", phone: "0599123456", phoneE164: "+970599123456" };

// covers: AC-10 (spec 0019)
describe("changedFields", () => {
  it("is empty when nothing changed", () => {
    expect(
      changedFields(current, { name: "سامي خليل", phone: phone("0599123456", "+970599123456") }),
    ).toEqual([]);
  });

  it("names the name alone", () => {
    expect(
      changedFields(current, { name: "سامي", phone: phone("0599123456", "+970599123456") }),
    ).toEqual(["full_name"]);
  });

  it("counts a phone typed another way as a change, even with the same E.164", () => {
    expect(
      changedFields(current, { name: "سامي خليل", phone: phone("+970599123456", "+970599123456") }),
    ).toEqual(["phone"]);
  });

  it("names both, and a first name on an account without one", () => {
    expect(
      changedFields(
        { fullName: null, phone: null, phoneE164: null },
        { name: "سامي", phone: phone("0569000000", "+970569000000") },
      ),
    ).toEqual(["full_name", "phone"]);
  });
});

const order = (status: MoneyOrder["status"], total = 25_000, amountPaid = 0): MoneyOrder => ({
  status,
  total,
  amountPaid,
});

// covers: AC-11 (spec 0019)
describe("removalBlock", () => {
  it("allows an account with no orders, or only delivered and paid or cancelled ones", () => {
    expect(removalBlock([])).toBeNull();
    expect(removalBlock([order("delivered", 25_000, 25_000), order("cancelled")])).toBeNull();
  });

  it("ignores money on a cancelled order", () => {
    expect(removalBlock([order("cancelled", 25_000, 10_000)])).toBeNull();
  });

  it.each(["new", "confirmed", "preparing", "ready", "out_for_delivery"] as const)(
    "blocks on an open %s order",
    (status) => {
      expect(removalBlock([order(status, 25_000, 25_000)])).toBe("has_open_orders");
    },
  );

  it("blocks on a delivered order still owing", () => {
    expect(removalBlock([order("delivered", 25_000, 24_999)])).toBe("has_balance");
  });

  it("reports open orders before a balance", () => {
    expect(removalBlock([order("delivered", 25_000, 0), order("new")])).toBe("has_open_orders");
  });
});

// covers: AC-5 (spec 0019)
describe("customerTotals", () => {
  it("is zero with no orders", () => {
    expect(customerTotals([])).toEqual({ orderCount: 0, spent: 0, owed: 0 });
  });

  it("counts every order but cancelled, and only delivered ones in the money", () => {
    expect(
      customerTotals([
        order("new", 10_000),
        order("delivered", 27_000, 27_000),
        order("delivered", 25_000, 5_000),
        order("delivered", 12_000, 15_000),
        order("cancelled", 40_000, 40_000),
      ]),
    ).toEqual({ orderCount: 4, spent: 64_000, owed: 20_000 });
  });
});

const say = (event: AccountEventView) => {
  const line = historyLine(event);
  switch (line.key) {
    case "historyRoleChanged":
      return t(line.key, { from: t(`role.${line.from}`), to: t(`role.${line.to}`) });
    case "historyDetailsEdited":
      return t(line.key, { fields: t(`fields.${line.fields}`) });
    case "historyRemoved":
      return t(line.key);
  }
};

// covers: AC-13 (spec 0019)
describe("historyLine", () => {
  it("words a role change", () => {
    expect(say({ type: "role_changed", fromRole: "customer", toRole: "electrician" })).toBe(
      "تحويل من عميل إلى كهربائي",
    );
    expect(say({ type: "role_changed", fromRole: "electrician", toRole: "customer" })).toBe(
      "تحويل من كهربائي إلى عميل",
    );
  });

  it("words a details edit by its fields", () => {
    expect(say({ type: "details_edited", fields: ["full_name"] })).toBe("تعديل الاسم");
    expect(say({ type: "details_edited", fields: ["phone"] })).toBe("تعديل الهاتف");
    expect(say({ type: "details_edited", fields: ["full_name", "phone"] })).toBe(
      "تعديل الاسم والهاتف",
    );
  });

  it("words a removal start", () => {
    expect(say({ type: "removed" })).toBe("بدء حذف الحساب");
  });
});
