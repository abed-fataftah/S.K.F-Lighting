import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import { sendNoticeKey, type SendNotice } from "./send-check";

// covers: AC-13 (spec 0020), the send outcome mapping. parseDraftCustomer is covered in
// schemas.test.ts.

/** The message a key names under `QuickOrder`, or undefined when it does not exist. */
function messageOf(key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      ar.QuickOrder,
    );
}

describe("sendNoticeKey", () => {
  it("gives each refusal the spec names its own message", () => {
    expect(messageOf(sendNoticeKey("price_changed"))).toBe(
      "تغيّرت بعض الأسعار. راجع الإجمالي ثم أرسل مرة أخرى.",
    );
    expect(messageOf(sendNoticeKey("not_sellable"))).toBe(
      "بعض الأسطر غير متوفرة. احذفها أو استبدلها ثم أرسل.",
    );
    expect(messageOf(sendNoticeKey("zone_invalid"))).toBe(
      "منطقة التوصيل لم تعد متاحة. اختر منطقة أخرى.",
    );
    expect(messageOf(sendNoticeKey("empty"))).toBe("أضف سطراً واحداً على الأقل.");
    expect(messageOf(sendNoticeKey("save_first"))).toBe("احفظ التغييرات أولاً.");
    expect(messageOf(sendNoticeKey("restore_failed"))).toBe("تعذّر إرجاع السطر.");
  });

  it("shows checkout's rate limit message", () => {
    expect(messageOf(sendNoticeKey("rate_limited"))).toBe(ar.Checkout.errors.rate_limited);
  });

  it("falls back to the general message for anything else", () => {
    for (const notice of ["forbidden", "not_found", "save_failed"] as const) {
      expect(messageOf(sendNoticeKey(notice))).toBe("تعذّر إرسال الطلب. حاول مرة أخرى.");
    }
  });

  it("names a message that exists for every notice", () => {
    const all: readonly SendNotice[] = [
      "forbidden",
      "rate_limited",
      "not_found",
      "empty",
      "incomplete",
      "invalid",
      "not_sellable",
      "zone_invalid",
      "price_changed",
      "save_failed",
      "save_first",
      "restore_failed",
    ];
    for (const notice of all)
      expect(typeof messageOf(sendNoticeKey(notice)), notice).toBe("string");
  });
});
