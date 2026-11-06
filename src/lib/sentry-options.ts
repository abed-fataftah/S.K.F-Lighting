import type { init } from "@sentry/nextjs";

type DataCollection = NonNullable<NonNullable<Parameters<typeof init>[0]>["dataCollection"]>;

// What the Sentry SDK may collect on its own, on both sides (spec 0027 AC-14): nothing personal.
// The scrubber still runs on every event; this keeps the data from being gathered at all.
export const NO_PERSONAL_DATA = {
  userInfo: false,
  cookies: false,
  // The host feeds the production gate; the user agent is the one header an event keeps.
  httpHeaders: { request: { allow: ["host", "user-agent"] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
} as const satisfies DataCollection;
