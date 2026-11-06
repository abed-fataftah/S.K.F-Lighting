import type { ErrorEvent } from "@sentry/nextjs";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  eventHost,
  isBrowserNoise,
  scrubEvent,
  scrubText,
  scrubUrl,
  shouldReport,
} from "./error-scrub";

const SITE = "https://skf.example";

/** A server event on the production host, carrying `value` as its error message. */
const eventWith = (value: string, extra: Partial<ErrorEvent> = {}): ErrorEvent => ({
  type: undefined,
  tags: { host: "skf.example" },
  exception: { values: [{ type: "Error", value }] },
  ...extra,
});

const scrubbedValue = (value: string) =>
  scrubEvent(eventWith(value), SITE)?.exception?.values?.[0]?.value;

// covers: AC-13 (spec 0027): only the NEXT_PUBLIC_SITE_URL host reports.
describe("shouldReport", () => {
  it.each(["skf.example", "SKF.example", "skf.example:443", "skf.example."])(
    "reports from the production host %s",
    (host) => {
      expect(shouldReport(host, SITE)).toBe(true);
    },
  );

  it.each([
    "skf-pro.someone.workers.dev",
    "feat-cart-skf-pro.someone.workers.dev",
    "www.skf.example",
    "localhost:8787",
    "localhost",
    "",
    null,
    undefined,
  ])("stays silent on %j", (host) => {
    expect(shouldReport(host, SITE)).toBe(false);
  });

  it("never throws on a broken site URL", () => {
    expect(shouldReport("skf.example", "not a url")).toBe(false);
  });
});

describe("eventHost", () => {
  it("prefers the host tag reportError sets", () => {
    expect(eventHost({ tags: { host: "skf.example" }, request: { url: "https://x.test/" } })).toBe(
      "skf.example",
    );
  });

  it("falls back to the request URL, and to nothing", () => {
    expect(eventHost({ request: { url: "https://skf.example/c/lamps" } })).toBe("skf.example");
    expect(eventHost({ request: { url: "/relative" } })).toBeNull();
    expect(eventHost({})).toBeNull();
  });
});

// covers: AC-13 (spec 0027): the gate runs inside beforeSend on both sides.
describe("scrubEvent: the production gate", () => {
  it("drops an event from a preview host", () => {
    expect(scrubEvent(eventWith("boom", { tags: { host: "skf.someone.workers.dev" } }), SITE)).toBe(
      null,
    );
  });

  it("drops an event with no known host", () => {
    expect(scrubEvent({ exception: { values: [{ type: "Error", value: "boom" }] } }, SITE)).toBe(
      null,
    );
  });

  it("keeps a browser event whose page is on the production host", () => {
    const event: ErrorEvent = {
      type: undefined,
      request: { url: "https://skf.example/p/lamp" },
      exception: { values: [{ type: "TypeError", value: "x is undefined" }] },
    };
    expect(scrubEvent(event, SITE)?.exception?.values?.[0]?.value).toBe("x is undefined");
  });
});

// covers: AC-14 (spec 0027): real error samples, with no phone, address, or order number left.
describe("scrubEvent: real error samples", () => {
  it("cuts a Drizzle insert error after params:, so the phone and address never leave", () => {
    const error = new DrizzleQueryError(
      'insert into "orders" ("number", "phone", "address") values ($1, $2, $3)',
      ["1042", "0599123456", "Hebron, Ein Sara St"],
      new Error("connection reset"),
    );
    const value = scrubbedValue(error.message) ?? "";
    expect(value).toContain('insert into "orders"');
    expect(value).toMatch(/params: \[removed\]$/);
    expect(value).not.toContain("0599123456");
    expect(value).not.toContain("Ein Sara");
    expect(value).not.toMatch(/\d{8}/);
  });

  it("cuts a Postgres unique key DETAIL after Key (", () => {
    const message =
      'duplicate key value violates unique constraint "profiles_phone_key"\n' +
      "DETAIL:  Key (phone)=(0599123456) already exists.";
    const value = scrubbedValue(message) ?? "";
    expect(value).toContain('violates unique constraint "profiles_phone_key"');
    expect(value).toContain("DETAIL:  Key ([removed]");
    expect(value).not.toContain("phone)=(");
    expect(value).not.toContain("already exists");
  });

  it("cuts a bare Key ( detail, as postgres.js keeps it in its own field", () => {
    expect(scrubText("Key (address)=(Hebron, Ein Sara St) already exists.")).toBe("Key ([removed]");
  });

  it("masks the input value a Zod error message carries", () => {
    const result = z
      .object({ phone: z.string().length(9) })
      .safeParse({ phone: "0599123456" }, { reportInput: true });
    expect(result.success).toBe(false);
    const value = scrubbedValue(result.error?.message ?? "") ?? "";
    expect(value).toContain("[digits]");
    expect(value).not.toContain("0599123456");
  });

  it("masks a value in a postgres.js error message", () => {
    expect(scrubbedValue('invalid input syntax for type integer: "0599123456"')).toBe(
      'invalid input syntax for type integer: "[digits]"',
    );
  });

  it.each([
    ["Arabic digits", "٠٥٩٩١٢٣٤٥٦"],
    ["dashes", "059-912-3456"],
    ["brackets and a dot", "(059) 912.3456"],
    ["a country code and spaces", "+970 59 912 3456"],
  ])("masks a phone written with %s", (_name, phone) => {
    expect(scrubText(`call ${phone} now`)).toBe("call [digits] now");
  });

  it("keeps short numbers like a quantity or a line number", () => {
    expect(scrubText("stock 1234567 left at line 42")).toBe("stock 1234567 left at line 42");
  });

  it("masks the order number in a path and in a number= lookup", () => {
    expect(scrubText("/orders/1042")).toBe("/orders/[order]");
    expect(scrubText("/checkout/done/1042")).toBe("/checkout/done/[order]");
    expect(scrubText("/admin/orders/1042/edit")).toBe("/admin/orders/[order]/edit");
    expect(scrubText("number=1042&x=1")).toBe("number=[order]&x=1");
  });

  it("scrubs an order page URL and strips its query string", () => {
    expect(scrubUrl("https://skf.example/orders/1042?number=1042")).toBe(
      "https://skf.example/orders/[order]",
    );
  });
});

describe("scrubEvent: every place a string can hide", () => {
  const event: ErrorEvent = {
    type: undefined,
    message: "failed for 0599123456",
    transaction: "/orders/1042?number=1042",
    fingerprint: ["order_save_failed"],
    tags: { host: "skf.example", area: "checkout", note: "0599123456" },
    extra: { nested: { deeper: ["phone 0599123456"] }, count: 3 },
    contexts: {
      trace: { trace_id: "12345678901234567890123456789012", span_id: "1234567890123456" },
      nextjs: { request_path: "/orders/1042?number=1042", router_path: "/orders/[number]" },
      app: { app_start_time: "2026-11-06T22:49:26.566Z" },
    },
    breadcrumbs: [
      {
        category: "navigation",
        data: { from: "/orders/track?number=1042", to: "/orders/1042?x=1" },
      },
      { category: "fetch", message: "POST /orders/1042", data: { url: "/api/x?phone=0599" } },
    ],
    request: {
      url: "https://skf.example/orders/1042?number=1042",
      method: "POST",
      query_string: "number=1042",
      cookies: { "sb-access-token": "secret" },
      data: { phone: "0599123456", address: "Ein Sara St" },
      headers: { "user-agent": "Mozilla/5.0", cookie: "secret", "x-forwarded-for": "1.2.3.4" },
    },
    user: { id: "user-uuid", email: "a@b.test", ip_address: "1.2.3.4", username: "x" },
    exception: {
      values: [
        {
          type: "PostgresError",
          value: "DETAIL:  Key (phone)=(0599123456) already exists.",
        },
        {
          type: "DrizzleQueryError",
          value: "Failed query: insert into orders\nparams: 0599123456,Ein Sara St",
          stacktrace: {
            frames: [
              {
                filename: "app:///_next/server/chunks/8412345678.js",
                function: "placeOrder",
                lineno: 10,
                vars: { phone: "0599123456" },
              },
            ],
          },
        },
      ],
    },
  };
  const out = scrubEvent(event, SITE);
  const text = JSON.stringify(out);

  it("leaves no phone or address anywhere", () => {
    expect(text).not.toContain("0599123456");
    expect(text).not.toContain("Ein Sara");
    expect(text).not.toContain("1042");
  });

  it("drops the body, cookies, query string, other headers, and the IP", () => {
    expect(out?.request).toEqual({
      url: "https://skf.example/orders/[order]",
      method: "POST",
      headers: { "user-agent": "Mozilla/5.0" },
    });
    expect(text).not.toContain("secret");
    expect(text).not.toContain("1.2.3.4");
  });

  it("keeps only the account id of the user", () => {
    expect(out?.user).toEqual({ id: "user-uuid" });
  });

  it("drops frame locals but keeps the file and function for the source maps", () => {
    const frame = out?.exception?.values?.[1]?.stacktrace?.frames?.[0];
    expect(frame).toEqual({
      filename: "app:///_next/server/chunks/8412345678.js",
      function: "placeOrder",
      lineno: 10,
    });
  });

  it("keeps the SDK's own contexts, the fingerprint, and the plain tags", () => {
    expect(out?.contexts?.trace).toEqual(event.contexts?.trace);
    expect(out?.contexts?.app).toEqual(event.contexts?.app);
    expect(out?.fingerprint).toEqual(["order_save_failed"]);
    expect(out?.tags?.area).toBe("checkout");
    expect(out?.extra?.count).toBe(3);
  });

  it("strips query strings from the transaction, the Next.js path, and breadcrumb URLs", () => {
    expect(out?.transaction).toBe("/orders/[order]");
    expect(out?.contexts?.nextjs).toEqual({
      request_path: "/orders/[order]",
      // The route template's segment is masked too, which costs nothing.
      router_path: "/orders/[order]",
    });
    expect(out?.breadcrumbs?.[0]?.data).toEqual({
      // Every segment after /orders/ is masked, the lookup page's too.
      from: "/orders/[order]",
      to: "/orders/[order]",
    });
    expect(out?.breadcrumbs?.[1]?.data?.url).toBe("/api/x");
  });
});

// covers: AC-9 (spec 0027): browser noise is dropped.
describe("isBrowserNoise", () => {
  const inFrames = (...files: string[]) => ({
    exception: {
      values: [
        {
          type: "Error",
          value: "x",
          stacktrace: { frames: files.map((filename) => ({ filename })) },
        },
      ],
    },
  });

  it.each([
    "chrome-extension://abc/x.js",
    "moz-extension://abc/x.js",
    "safari-extension://a/x.js",
    "safari-web-extension://a/x.js",
  ])("drops an error only in %s", (file) => {
    expect(isBrowserNoise(inFrames(file))).toBe(true);
  });

  it("keeps an error with one frame of our own", () => {
    expect(
      isBrowserNoise(inFrames("chrome-extension://abc/x.js", "https://skf.example/_next/a.js")),
    ).toBe(false);
  });

  it("drops the ResizeObserver loop warnings", () => {
    expect(
      isBrowserNoise({
        exception: { values: [{ type: "Error", value: "ResizeObserver loop limit exceeded" }] },
      }),
    ).toBe(true);
    expect(
      isBrowserNoise({ message: "ResizeObserver loop completed with undelivered notifications." }),
    ).toBe(true);
  });

  it("keeps an error with no frames at all", () => {
    expect(isBrowserNoise({ exception: { values: [{ type: "Error", value: "x" }] } })).toBe(false);
  });
});

describe("scrubEvent: never throws", () => {
  it("drops the event if scrubbing fails", () => {
    const hostile = eventWith("x");
    Object.defineProperty(hostile, "extra", {
      get() {
        throw new Error("boom");
      },
    });
    expect(scrubEvent(hostile, SITE)).toBeNull();
  });
});
