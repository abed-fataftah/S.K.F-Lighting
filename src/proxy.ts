import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { ADMIN_PATH_HEADER } from "@/features/admin-auth/next-path";
import { isProductionHost, NOINDEX_HEADER } from "@/features/seo/indexing";
import { routing } from "@/i18n/routing";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { refreshSession } from "@/server/auth/proxy-session";

const handleI18nRouting = createIntlMiddleware(routing);

// The dashboard, auth callbacks, route handlers, and the design system gallery are not
// translated routes.
function isOutsideLocaleRouting(pathname: string) {
  return /^\/(admin|auth|api|design-system)(\/|$)/.test(pathname);
}

// Public catalog reads need no session, and a refresh would add a Supabase round trip to every
// count while the filters screen is open (spec 0010 AC-15).
const skipsSession = (pathname: string) => pathname.startsWith("/api/catalog/");

const isAdminPath = (pathname: string) => /^\/admin(\/|$)/.test(pathname);

// The dashboard layout cannot read its own path, so the guard's `?next=` comes from this header.
// The session refresh above already wrote fresh cookies into these request headers.
function passThrough(request: NextRequest) {
  if (!isAdminPath(request.nextUrl.pathname)) return NextResponse.next({ request });
  const headers = new Headers(request.headers);
  headers.set(ADMIN_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

function isBrokenPath(pathname: string) {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

// Any broken `%` on the storefront: Next fails to decode the `[...rest]` catch all's params and
// answers its bare 400 page. This internal address matches only the catch all, so the browser
// keeps its address and gets the designed 404 inside the shell (spec 0013 AC-2, spec 0029 AC-17).
const BROKEN_ADDRESS = `/${routing.defaultLocale}${routes.brokenAddress}`;

async function route(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const broken = isBrokenPath(pathname);

  // A broken `%` under `/orders/` never reaches the order page, so it goes to the plain lookup
  // here, never a 404 (spec 0015 AC-7).
  if (broken && pathname.startsWith(routes.order(""))) {
    return NextResponse.redirect(new URL(routes.orderTrack, request.url), 307);
  }
  if (skipsSession(pathname)) return NextResponse.next();
  const applySession = await refreshSession(request);

  // On purpose, a broken `%` here keeps Next's own answer: the dashboard, auth callbacks, and
  // route handlers are not storefront pages and have no shell to show the designed 404 in.
  if (isOutsideLocaleRouting(pathname)) return applySession(passThrough(request));
  if (broken) return applySession(NextResponse.rewrite(new URL(BROKEN_ADDRESS, request.url)));
  return applySession(handleI18nRouting(request));
}

// Off the production host (a `workers.dev` or branch preview) every answer says do not index,
// whichever path above produced it (spec 0026 AC-2).
export async function proxy(request: NextRequest) {
  const response = await route(request);
  if (!isProductionHost(request.nextUrl.host, parsePublicEnv().siteUrl)) {
    response.headers.set(NOINDEX_HEADER.name, NOINDEX_HEADER.value);
  }
  return response;
}

export const config = {
  // Skip Next internals and any path with a file extension (static files, images).
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
