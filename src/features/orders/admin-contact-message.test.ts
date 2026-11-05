import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import { adminContactMessage } from "./admin-contact-message";
import { ORDER_STATUSES } from "./status";

// covers: AC-7 (spec 0014)

const t = createTranslator({ locale: "ar", messages: ar, namespace: "AdminOrders" });
const translate = (key: "contactMessage", values: Record<string, string>) => t(key, values);

describe("adminContactMessage", () => {
  it("writes the exact text for every status", () => {
    for (const status of ORDER_STATUSES) {
      const label = t(`status.${status}`);
      expect(
        adminContactMessage(
          { name: "أحمد خليل", number: "26-00042", statusLabel: label },
          translate,
        ),
      ).toBe(
        `مرحباً أحمد خليل، معك S.K.F للإنارة بخصوص طلبك رقم 26-00042. حالة الطلب الآن: ${label}.`,
      );
    }
  });

  it("drops direction marks and line breaks from the name and the number", () => {
    const message = adminContactMessage(
      { name: "أحمد\nخليل‏", number: "‎26-00042‎", statusLabel: "جاهز" },
      translate,
    );
    expect(message).toContain("مرحباً أحمد خليل،");
    expect(message).toContain("رقم 26-00042.");
    expect(message).not.toMatch(/[‎‏\n]/);
  });

  it("holds no price and no address", () => {
    const message = adminContactMessage(
      { name: "أحمد خليل", number: "26-00042", statusLabel: "جديد" },
      translate,
    );
    expect(message).not.toMatch(/₪|العنوان/);
  });
});
