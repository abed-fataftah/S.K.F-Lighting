import "server-only";
import { checkOrderRate, rateKey, type OrderLimiter } from "@/features/checkout/rate-limit";
import { getDb } from "@/server/db";
import { withTimeLimit } from "@/server/db/time-limit";
import { readCountRequest, type CountRequest } from "../count-request";
import { getCategoryHead, readListCount } from "./queries";

// `GET /api/catalog/count` (spec 0010 AC-12, AC-15): rate limited per IP (60 a minute, failing
// open), then the scope and filters parsed as the pages parse them, then one 1.5 second limit
// around the catalog tree, the choices, and the count. Every answer is `no-store`. Logs name the
// event and what failed, never the query or the filters.

export const COUNT_TIMEOUT_MS = 1500;

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** The count for a parsed request: null for a category that is unknown or not shown. */
export async function countFor(
  request: Exclude<CountRequest, { kind: "bad_request" | "too_short" }>,
): Promise<number | null> {
  if (request.kind === "search") {
    const { words, folded, code } = request;
    return readListCount(await getDb(), { kind: "search", words, folded, code }, request.filters);
  }
  const head = await getCategoryHead(request.main, request.sub, 1);
  if (!head) return null;
  return readListCount(
    await getDb(),
    { kind: "category", categoryIds: head.categoryIds },
    request.filters,
    head.total,
  );
}

export type CountDeps = {
  readonly limiter: OrderLimiter | undefined;
  readonly count: typeof countFor;
  readonly production: boolean;
};

let warnedUnchecked = false;

export async function handleCount(request: Request, deps: CountDeps): Promise<Response> {
  const check = await checkOrderRate(
    deps.limiter,
    rateKey(request.headers.get("cf-connecting-ip")),
  );
  if (check === "limited") return json(429, { error: "too_many" });
  if (check === "unchecked" && !deps.production && !warnedUnchecked) {
    // Once per process, so `next dev` says why the limit is not applied.
    warnedUnchecked = true;
    console.warn(JSON.stringify({ event: "catalog_count_rate_unchecked" }));
  }

  const parsed = readCountRequest(new URL(request.url).searchParams);
  if (parsed.kind === "bad_request") return json(400, { error: "bad_request" });
  if (parsed.kind === "too_short") return json(200, { count: 0 });

  const result = await withTimeLimit(() => deps.count(parsed), COUNT_TIMEOUT_MS);
  if (!result.ok) {
    console.error(JSON.stringify({ event: "catalog_count_failed", error: result.error }));
    return json(503, { error: "unavailable" });
  }
  if (result.data === null) return json(404, { error: "not_found" });
  return json(200, { count: result.data });
}
