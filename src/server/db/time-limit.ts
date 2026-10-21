import { fail, ok, type Result } from "@/lib/result";

// A database read the page can live without, raced against a time limit (spec 0003 AC-15,
// spec 0004 AC-3). A hung database never holds a page past the limit: the caller gets
// `timeout` or `failed` and decides what to show. Nothing is logged here, so callers
// choose what to log and never log the values.
export type TimeLimitError = "timeout" | "failed";

const TIMED_OUT = Symbol("timed out");

export async function withTimeLimit<T>(
  read: () => Promise<T>,
  timeoutMs: number,
): Promise<Result<T, TimeLimitError, { readonly cause?: unknown }>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
  });
  try {
    const result = await Promise.race([read(), timeout]);
    return result === TIMED_OUT ? fail("timeout") : ok(result);
  } catch (cause) {
    return { ...fail("failed"), cause };
  } finally {
    clearTimeout(timer);
  }
}
