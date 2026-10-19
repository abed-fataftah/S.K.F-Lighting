import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import { whatsappUrl } from "./whatsapp";

// covers: AC-17 (spec 0003)
describe("whatsappUrl", () => {
  it("opens wa.me with the number and the encoded Arabic message W1", () => {
    const url = whatsappUrl("970500000000", ar.Shell.whatsappMessages.general);

    expect(url.startsWith("https://wa.me/970500000000?text=")).toBe(true);
    expect(new URL(url).searchParams.get("text")).toBe("مرحباً S.K.F lighting، أريد الاستفسار.");
  });

  it("encodes every character that would break the query", () => {
    const url = whatsappUrl("970500000000", "سؤال & جواب؟ #1 + 50%");

    const query = url.slice(url.indexOf("?text=") + "?text=".length);
    expect(query).not.toMatch(/[ &#+]/);
    expect(new URL(url).searchParams.get("text")).toBe("سؤال & جواب؟ #1 + 50%");
  });

  it("keeps digits only in the number", () => {
    expect(whatsappUrl("+970 50-000 0000", "مرحباً")).toMatch(/^https:\/\/wa\.me\/970500000000\?/);
  });
});
