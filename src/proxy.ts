import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { refreshSession } from "@/server/auth/proxy-session";

const handleI18nRouting = createIntlMiddleware(routing);

// The dashboard and auth callbacks are not translated routes.
function isOutsideLocaleRouting(pathname: string) {
  return /^\/(admin|auth)(\/|$)/.test(pathname);
}

export async function proxy(request: NextRequest) {
  const applySession = await refreshSession(request);

  const response = isOutsideLocaleRouting(request.nextUrl.pathname)
    ? NextResponse.next({ request })
    : handleI18nRouting(request);

  return applySession(response);
}

export const config = {
  // Skip Next internals and any path with a file extension (static files, images).
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
