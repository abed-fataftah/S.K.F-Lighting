import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import { buildStripText, buildZoneLine } from "./fees";

const words = (zones: string) => ar.Home.strip.replace("{zones}", zones);
const launch = [
  { shortName: "الضفة", fee: 2000 },
  { shortName: "الداخل", fee: 7000 },
];

// covers: AC-6 (spec 0011)
describe("delivery fees on Home", () => {
  it("builds the strip from the active zones in order", () => {
    expect(buildStripText(launch, words)).toBe("توصيل: الضفة ₪20 · الداخل ₪70");
  });

  it("builds the delivery card line without the strip's words", () => {
    expect(buildZoneLine(launch)).toBe("الضفة ₪20 · الداخل ₪70");
  });

  it("shows agorot only when a fee has them", () => {
    expect(buildZoneLine([{ shortName: "القدس", fee: 1550 }])).toBe("القدس ₪15.50");
  });

  it("hides both with no active zone or a failed read", () => {
    expect(buildStripText([], words)).toBeNull();
    expect(buildStripText(null, words)).toBeNull();
    expect(buildZoneLine([])).toBeNull();
    expect(buildZoneLine(null)).toBeNull();
  });
});
