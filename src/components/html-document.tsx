import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { ReactNode } from "react";
import { almarai } from "@/app/fonts";

// The <html> every layout renders (spec 0003, AC-4): Arabic, right to left, Almarai,
// and Base UI told the direction. `isolate` makes the app root its own stacking
// context, so a portalled popup (the menu sheet) always sits above the fixed parts.
export function HtmlDocument({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={almarai.variable}>
      <body>
        <DirectionProvider direction="rtl">
          <div className="isolate">{children}</div>
        </DirectionProvider>
      </body>
    </html>
  );
}
