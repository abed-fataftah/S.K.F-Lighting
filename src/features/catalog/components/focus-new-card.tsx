"use client";

import { useEffect } from "react";

const CARD_HASH = /^#p-\d+$/;

// "Load more" (spec 0008 AC-11) is a link to the next `?page` with `#p-<position>` of the first new
// card. After each render of a page, this moves focus to that card's name link, so a keyboard or
// screen reader user carries on from the first new product. No matching card, no move.
export function FocusNewCard({ page }: { readonly page: number }) {
  useEffect(() => {
    // The router updates the address after the new page commits, so read it on the next frame.
    const frame = requestAnimationFrame(() => {
      const { hash } = window.location;
      if (!CARD_HASH.test(hash)) return;
      document.getElementById(hash.slice(1))?.querySelector<HTMLElement>("h2 a")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [page]);
  return null;
}
