import { describe, expect, it } from "vitest";
import {
  hasArabicLetter,
  normalizeForSearch,
  stripArabicMarks,
  tidyText,
  toWesternDigits,
} from "./arabic";

// covers: AC-9, AC-10, AC-11, AC-12 (spec 0005)

describe("toWesternDigits", () => {
  it.each([
    ["٠١٢٣٤٥٦٧٨٩", "0123456789"],
    ["۰۱۲۳۴۵۶۷۸۹", "0123456789"],
    ["١٬٢٥٠", "1,250"],
    ["١٩٫٩٠", "19.90"],
    ["CH-١٠٢٠", "CH-1020"],
    ["ثريا 12W", "ثريا 12W"],
    ["", ""],
  ])("%j becomes %j", (text, expected) => {
    expect(toWesternDigits(text)).toBe(expected);
  });
});

describe("stripArabicMarks", () => {
  it("drops tashkeel and tatweel and keeps the letters", () => {
    expect(stripArabicMarks("ثُرَيّـــا كْرِيسْتَالٌ")).toBe("ثريا كريستال");
  });

  it("keeps hamza letters and digits", () => {
    expect(stripArabicMarks("إنارة ٣ أضواء")).toBe("إنارة ٣ أضواء");
  });
});

describe("tidyText", () => {
  it("tidies the spec example to a clean name", () => {
    expect(tidyText("  ثريـــا   كريستال\u200f ")).toBe("ثريا كريستال");
  });

  it.each([
    ["tatweel", "ثريـــا", "ثريا"],
    ["double spaces", "ثريا  كريستال", "ثريا كريستال"],
    ["a no break space", "ثريا\u00a0كريستال", "ثريا كريستال"],
    ["a tab", "ثريا\tكريستال", "ثريا كريستال"],
    ["an RLM and an LRM", "\u200fثريا\u200e", "ثريا"],
    ["a BOM and a zero width space", "\ufeffثر\u200bيا", "ثريا"],
    ["an ALM and the isolates", "\u061c\u2066ثريا\u2069", "ثريا"],
    ["a right to left override", "\u202e0599\u202c", "0599"],
    ["a soft hyphen", "كري\u00adستال", "كريستال"],
    ["NUL and other controls", "ثر\u0000يا\u0007\u0085", "ثريا"],
    ["an ideographic space", "a\u3000b", "a b"],
  ])("removes %s", (_name, text, expected) => {
    expect(tidyText(text)).toBe(expected);
  });

  it("composes a decomposed hamza (alef + U+0654 becomes أ)", () => {
    expect(tidyText("أحمد")).toBe("أحمد");
  });

  it("composes a hamza that an invisible character had split", () => {
    expect(tidyText("ا\u200bٔحمد")).toBe("أحمد");
  });

  it("keeps tashkeel as written", () => {
    expect(tidyText("ثُرَيّا")).toBe("ثُرَيّا");
  });

  it("keeps ZWJ, so an emoji sequence survives", () => {
    const family = "👨\u200d👩\u200d👧";
    expect(tidyText(`شكرا ${family}`)).toBe(`شكرا ${family}`);
  });

  it("keeps ZWNJ", () => {
    expect(tidyText("می\u200cخواهم")).toBe("می\u200cخواهم");
  });

  it("joins lines with one space in a single line field", () => {
    expect(tidyText("نابلس\r\n\r\n  شارع فيصل \n")).toBe("نابلس شارع فيصل");
  });

  it("keeps line breaks, at most one empty line in a row, in a multi line field", () => {
    expect(tidyText("\n سطر أول  \r\n\r\n\r\n\n سطر ثان\u2028ثالث\n\n", { multiline: true })).toBe(
      "سطر أول\n\nسطر ثان\nثالث",
    );
  });

  it("returns an empty string for blank text", () => {
    expect(tidyText(" \u200f\u00a0\n\t ")).toBe("");
  });

  it.each([
    ["  ثريـــا   كريستال\u200f ", false],
    ["\n سطر  أول \r\n\r\n\r\nسطر\u00a0ثان ", true],
    ["ا\u200bٔحمد\u0000", false],
    ["تم ✔️ 👨\u200d👩\u200d👧", true],
  ])("is idempotent on %j", (text, multiline) => {
    const once = tidyText(text, { multiline });
    expect(tidyText(once, { multiline })).toBe(once);
  });
});

describe("hasArabicLetter", () => {
  it.each([
    "ثريا كريستال",
    "ثريا كريستال Philips 60W",
    "S.K.F lighting للإنارة",
    "پنکه",
    "ﻻ",
    "a ب",
  ])("accepts %j", (text) => {
    expect(hasArabicLetter(text)).toBe(true);
  });

  it.each(["Philips 60W", "S.K.F lighting", "ــــ", "١٢٣", "۱۲۳", "،؟؛", "", "ً"])(
    "rejects %j",
    (text) => {
      expect(hasArabicLetter(tidyText(text))).toBe(false);
    },
  );
});

describe("normalizeForSearch", () => {
  it("matches the spec pair", () => {
    expect(normalizeForSearch("إنارةُ  الزينة")).toBe(normalizeForSearch("انارة الزينه"));
  });

  it.each([
    ["أ", "ا"],
    ["إ", "ا"],
    ["آ", "ا"],
    ["ٱ", "ا"],
    ["ى", "ي"],
    ["ة", "ه"],
    ["ؤ", "و"],
    ["ئ", "ي"],
    ["ثُرَيّا", "ثريا"],
    ["ثريـــا", "ثريا"],
    ["ﻻ", "لا"],
    ["٦٠W", "60w"],
    ["LED  Spot", "led spot"],
    ["ＬＥＤ", "led"],
  ])("folds %j into %j", (text, expected) => {
    expect(normalizeForSearch(text)).toBe(expected);
  });

  it("leaves no stray space from a shadda presentation form (U+FC5E)", () => {
    expect(normalizeForSearch("ثرياﱞ")).toBe("ثريا");
    expect(normalizeForSearch("ثرﱞيا")).toBe("ثريا");
  });

  it.each(["إنارةُ  الزينة", "ثرياﱞ ذهبية", "مصباح ٦٠ واط LED", "  ﻻمبة  "])(
    "is idempotent on %j",
    (text) => {
      const once = normalizeForSearch(text);
      expect(normalizeForSearch(once)).toBe(once);
    },
  );
});
