import { describe, expect, it } from "vitest";
import { colourMatches } from "./colour-match";

// covers: AC-5 (spec 0006)
const GOLD = { id: "g", name: "ذهبي" };
const BLACK = { id: "b", name: "أسود" };
const BLACK_MATTE = { id: "m", name: "أسود مطفي" };
const listed = [GOLD, BLACK, BLACK_MATTE];

describe("colourMatches", () => {
  it("lists every free colour for an empty query, without the ones on the product", () => {
    const match = colourMatches("", listed, [{ colourId: "g", name: "ذهبي" }]);
    expect(match.choices).toEqual([BLACK, BLACK_MATTE]);
    expect(match.canAdd).toBe(false);
  });

  it("picks the listed colour instead of offering add when the typed name matches it", () => {
    const match = colourMatches("  أسود ", listed, []);
    expect(match.exact).toEqual(BLACK);
    expect(match.canAdd).toBe(false);
    expect(match.choices).toEqual([BLACK, BLACK_MATTE]);
  });

  it("offers add «name» for a name the list does not have, tidied", () => {
    const match = colourMatches(" فضي   لامع ", listed, []);
    expect(match).toMatchObject({ canAdd: true, name: "فضي لامع", choices: [], exact: null });
  });

  it("says already added for a colour or a new name the product has", () => {
    expect(colourMatches("ذهبي", listed, [{ colourId: "g", name: "ذهبي" }]).already).toBe(true);
    const typed = colourMatches("نحاسي", listed, [{ colourId: null, name: "نحاسي" }]);
    expect(typed).toMatchObject({ already: true, canAdd: false });
  });
});
