// The three policy pages (spec 0025), in tab order. The `pages_slug_check` constraint holds the
// same list.
export const policySlugs = ["privacy", "terms", "returns"] as const;

export type PolicySlug = (typeof policySlugs)[number];

export const isPolicySlug = (text: string): text is PolicySlug =>
  (policySlugs as readonly string[]).includes(text);
