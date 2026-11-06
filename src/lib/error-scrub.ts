// What may leave for Sentry (spec 0027 AC-9, AC-13, AC-14). Pure and shared by the browser and the
// server: `scrubEvent` is the `beforeSend` of both. It drops an event that is not from the
// production host, or is browser noise, and otherwise removes customer data before it is sent. It
// never throws; if scrubbing fails, the event is dropped.
import type { ErrorEvent, Event, Exception, StackFrame } from "@sentry/nextjs";
import { isProductionHost } from "@/features/seo/indexing";
import { toWesternDigits } from "@/lib/arabic";

const REMOVED = "[removed]";

/** True only for the `NEXT_PUBLIC_SITE_URL` host; no host at all is never production. */
export function shouldReport(host: string | null | undefined, siteUrl: string): boolean {
  if (!host) return false;
  try {
    return isProductionHost(host, siteUrl);
  } catch {
    return false;
  }
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** The host the gate reads: the `host` tag `reportError` sets, else the request URL's. */
export function eventHost(event: Event): string | null {
  const tag = event.tags?.host;
  return typeof tag === "string" && tag !== "" ? tag : hostOf(event.request?.url);
}

// Drizzle's `Failed query: ...\nparams: <the values>`: for an order insert, the phone and address.
const DRIZZLE_PARAMS = /(Failed query:[\s\S]*?params:)[\s\S]*/g;
// A Postgres `DETAIL:  Key (phone)=(0599...) already exists.` echoes the conflicting values.
const PG_KEY_DETAIL = /((?:DETAIL:\s*|^)Key \()[^\n]*/gm;
// Eight or more digits, maybe a leading `+`, with spaces, dashes, dots, or brackets between them.
const DIGIT_RUN = /\+?\(?\d(?:[\s\-.()]*\d){7,}\)?/g;
// The order number in a path segment, and in a `number=` query value.
const ORDER_SEGMENT = /(\/orders\/|\/checkout\/done\/)[^/?#\s"'`]+/g;
const ORDER_QUERY = /(\bnumber=)[^&#\s"'`]*/g;

/** One string, cleaned of anything that may carry customer data. */
export function scrubText(text: string): string {
  return toWesternDigits(text)
    .replace(DRIZZLE_PARAMS, `$1 ${REMOVED}`)
    .replace(PG_KEY_DETAIL, `$1${REMOVED}`)
    .replace(DIGIT_RUN, "[digits]")
    .replace(ORDER_SEGMENT, "$1[order]")
    .replace(ORDER_QUERY, "$1[order]");
}

/** A URL scrubbed, then without its query string. */
export function scrubUrl(url: string): string {
  return scrubText(url).replace(/\?[^#\s]*/, "");
}

/** Every string at any depth, scrubbed. Other values are kept as they are. */
function scrubDeep<T>(value: T): T {
  if (typeof value === "string") return scrubText(value) as T;
  if (Array.isArray(value)) return value.map(scrubDeep) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, scrubDeep(inner)]),
    ) as T;
  }
  return value;
}

// Frames keep their file, line, and function (the source maps need them), never their locals.
function scrubFrame(frame: StackFrame): StackFrame {
  return Object.fromEntries(Object.entries(frame).filter(([key]) => key !== "vars"));
}

// The main error and every linked `cause` sit side by side in `exception.values`.
function scrubException(exception: Exception): Exception {
  return {
    ...exception,
    type: exception.type === undefined ? undefined : scrubText(exception.type),
    value: exception.value === undefined ? undefined : scrubText(exception.value),
    mechanism: exception.mechanism === undefined ? undefined : scrubDeep(exception.mechanism),
    stacktrace:
      exception.stacktrace === undefined
        ? undefined
        : { ...exception.stacktrace, frames: exception.stacktrace.frames?.map(scrubFrame) },
  };
}

// Keys whose string is a URL: a breadcrumb's, and the path the Next.js context keeps.
const URL_KEYS = new Set(["url", "to", "from", "request_path"]);

/** Every string at any depth, scrubbed; a URL key's string also loses its query. */
function scrubBreadcrumbData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      URL_KEYS.has(key) && typeof value === "string"
        ? scrubUrl(value)
        : value !== null && typeof value === "object" && !Array.isArray(value)
          ? scrubBreadcrumbData(value as Record<string, unknown>)
          : scrubDeep(value),
    ]),
  );
}

const EXTENSION_FRAME = /^(chrome|moz|safari(-web)?)-extension:\/\//;

/** Browser noise (AC-9): the `ResizeObserver loop` warnings and errors only in extensions. */
export function isBrowserNoise(event: Event): boolean {
  const exceptions = event.exception?.values ?? [];
  if (exceptions.some((exception) => exception.value?.includes("ResizeObserver loop"))) {
    return true;
  }
  if (event.message?.includes("ResizeObserver loop")) return true;
  const files = exceptions
    .flatMap((exception) => exception.stacktrace?.frames ?? [])
    .map((frame) => frame.filename ?? frame.abs_path ?? "")
    .filter((file) => file !== "");
  return files.length > 0 && files.every((file) => EXTENSION_FRAME.test(file));
}

// What the SDK itself fills in about the runtime: trace ids (hex), start times, memory, the OS.
// No customer data, and a digit mask would only break the ids and dates.
const SDK_CONTEXTS = new Set([
  "trace",
  "runtime",
  "app",
  "device",
  "os",
  "culture",
  "cloud_resource",
]);

function scrubKnownEvent<E extends Event>(event: E): E {
  const { request, user, contexts, breadcrumbs, extra, tags, fingerprint } = event;
  const userAgent = request?.headers?.["user-agent"] ?? request?.headers?.["User-Agent"];
  const machine = Object.fromEntries(
    Object.entries(contexts ?? {}).filter(([key]) => SDK_CONTEXTS.has(key)),
  );
  const others = Object.fromEntries(
    Object.entries(contexts ?? {}).filter(([key]) => !SDK_CONTEXTS.has(key)),
  );
  return {
    ...event,
    message: event.message === undefined ? undefined : scrubText(event.message),
    logentry: event.logentry === undefined ? undefined : scrubDeep(event.logentry),
    transaction: event.transaction === undefined ? undefined : scrubUrl(event.transaction),
    exception:
      event.exception === undefined
        ? undefined
        : { ...event.exception, values: event.exception.values?.map(scrubException) },
    breadcrumbs: breadcrumbs?.map((crumb) => ({
      ...crumb,
      message: crumb.message === undefined ? undefined : scrubText(crumb.message),
      data: crumb.data === undefined ? undefined : scrubBreadcrumbData(crumb.data),
    })),
    extra: extra === undefined ? undefined : scrubDeep(extra),
    tags: tags === undefined ? undefined : scrubDeep(tags),
    contexts: contexts === undefined ? undefined : { ...scrubBreadcrumbData(others), ...machine },
    fingerprint: fingerprint === undefined ? undefined : fingerprint.map(scrubText),
    // No body, cookies, query string, IP, or headers but the user agent.
    request:
      request === undefined
        ? undefined
        : {
            url: request.url === undefined ? undefined : scrubUrl(request.url),
            method: request.method,
            headers: userAgent === undefined ? undefined : { "user-agent": userAgent },
          },
    // The Supabase account id only (AC-14).
    user: user?.id === undefined ? undefined : { id: user.id },
  };
}

/**
 * The `beforeSend` of both sides: null drops the event (not the production host, browser noise,
 * or a scrub that failed); otherwise the event with no customer data left in it.
 */
export function scrubEvent<E extends Event = ErrorEvent>(event: E, siteUrl: string): E | null {
  try {
    if (!shouldReport(eventHost(event), siteUrl)) return null;
    if (isBrowserNoise(event)) return null;
    return scrubKnownEvent(event);
  } catch {
    return null;
  }
}
