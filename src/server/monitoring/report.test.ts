import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-10, AC-13 (spec 0027). Sentry, the Worker context, and the request headers are spies,
// so these tests prove what `reportError` hands them.

vi.mock("server-only", () => ({}));

const scope = { setFingerprint: vi.fn(), setTag: vi.fn(), setTags: vi.fn(), setExtras: vi.fn() };
const captureException = vi.fn();
const flush = vi.fn(async () => true);
vi.mock("@sentry/nextjs", () => ({
  withScope: (run: (s: typeof scope) => void) => run(scope),
  captureException,
  flush,
}));

const waitUntil = vi.fn();
const getCloudflareContext = vi.fn(() => ({ ctx: { waitUntil } }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

const headers = vi.fn(async () => new Headers({ host: "skf.example" }));
vi.mock("next/headers", () => ({ headers }));

const { reportError } = await import("./report");

let logged: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  logged = [];
  vi.spyOn(console, "error").mockImplementation((line: unknown) => void logged.push(String(line)));
});

describe("reportError", () => {
  it("writes the log line and sends one event grouped by its name, with the host", async () => {
    const error = new TypeError("boom");
    await reportError("report_test_a", error, { section: "visits", count: 2 }, { area: "stats" });

    expect(logged).toEqual([
      JSON.stringify({ event: "report_test_a", section: "visits", count: 2, error: "TypeError" }),
    ]);
    expect(scope.setFingerprint).toHaveBeenCalledWith(["report_test_a"]);
    expect(scope.setTag).toHaveBeenCalledWith("host", "skf.example");
    expect(scope.setTags).toHaveBeenCalledWith({ area: "stats" });
    expect(scope.setExtras).toHaveBeenCalledWith({ section: "visits", count: 2 });
    expect(captureException).toHaveBeenCalledWith(error);
    // The send leaves after the response, through the Worker's waitUntil.
    expect(waitUntil).toHaveBeenCalledOnce();
    expect(flush).toHaveBeenCalledWith(2000);
  });

  it("turns a failure code into an Error, so Sentry has a stack", async () => {
    await reportError("report_test_b", "timeout");
    const sent = captureException.mock.calls[0]?.[0] as Error;
    expect(sent).toBeInstanceOf(Error);
    expect(sent.message).toBe("report_test_b: timeout");
  });

  it("sends one event per name per minute, but always writes the log line", async () => {
    await reportError("report_test_c", new Error("x"));
    await reportError("report_test_c", new Error("y"));
    expect(captureException).toHaveBeenCalledOnce();
    expect(logged).toHaveLength(2);
  });

  it("never throws: no request, no Worker context, or a Sentry failure only loses the Sentry copy", async () => {
    headers.mockRejectedValueOnce(new Error("outside a request"));
    getCloudflareContext.mockImplementationOnce(() => {
      throw new Error("no context");
    });
    await expect(reportError("report_test_d", new Error("x"))).resolves.toBeUndefined();
    expect(scope.setTag).not.toHaveBeenCalledWith("host", expect.anything());

    captureException.mockImplementationOnce(() => {
      throw new Error("sentry down");
    });
    await expect(reportError("report_test_e", new Error("x"))).resolves.toBeUndefined();
    expect(logged).toHaveLength(2);
  });
});
