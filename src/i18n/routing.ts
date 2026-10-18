import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // The shop is Arabic only, served at `/` with no prefix (`/ar` redirects to `/`).
  locales: ["ar"],
  defaultLocale: "ar",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});
