import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { ADMIN_PATH_HEADER } from "@/features/admin-auth/next-path";
import { routing } from "@/i18n/routing";
import { refreshSession } from "@/server/auth/proxy-session";

const handleI18nRouting = createIntlMiddleware(routing);

// The dashboard, auth callbacks, and the design system gallery are not translated routes.
function isOutsideLocaleRouting(pathname: string) {
  return /^\/(admin|auth|design-system)(\/|$)/.test(pathname);
}

const isAdminPath = (pathname: string) => /^\/admin(\/|$)/.test(pathname);

// The dashboard layout cannot read its own path, so the guard's `?next=` comes from this header.
// The session refresh above already wrote fresh cookies into these request headers.
function passThrough(request: NextRequest) {
  if (!isAdminPath(request.nextUrl.pathname)) return NextResponse.next({ request });
  const headers = new Headers(request.headers);
  headers.set(ADMIN_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export async function proxy(request: NextRequest) {
  const applySession = await refreshSession(request);

  const response = isOutsideLocaleRouting(request.nextUrl.pathname)
    ? passThrough(request)
    : handleI18nRouting(request);

  return applySession(response);
}

export const config = {
  // Skip Next internals and any path with a file extension (static files, images).
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
