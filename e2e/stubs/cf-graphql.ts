// A local stand in for the Cloudflare GraphQL Analytics API (spec 0027, CF_GRAPHQL_URL), started by
// playwright.config.ts so the stats page runs end to end with no real account. It checks the
// bearer token, reads the section from the query's dimension and the window from the filter.
import { createServer } from "node:http";
import {
  productRows,
  SLOW_MS,
  sourceRows,
  STUB_PORT,
  STUB_TOKEN,
  visitRows,
  windowDays,
  type StubRow,
} from "./cf-graphql-data";

type Body = {
  readonly query?: string;
  readonly variables?: {
    readonly filter?: { readonly AND?: readonly Record<string, string>[] };
  };
};

const answer = (rows: readonly StubRow[]) =>
  JSON.stringify({
    data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: rows }] } },
    errors: null,
  });

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.end("ok");
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    if (req.headers.authorization !== `Bearer ${STUB_TOKEN}`) {
      res.writeHead(403).end();
      return;
    }
    const body = JSON.parse(Buffer.concat(chunks).toString()) as Body;
    const query = body.query ?? "";
    const window = body.variables?.filter?.AND?.[0] ?? {};
    const failing = windowDays(window.datetime_geq ?? "", window.datetime_lt ?? "") === 1;
    const send = (rows: readonly StubRow[]) => {
      res.writeHead(200, { "content-type": "application/json" }).end(answer(rows));
    };

    if (query.includes("{ datetimeHour }")) {
      send(visitRows(window.datetime_geq ?? "", window.datetime_lt ?? ""));
    } else if (query.includes("{ requestPath }")) {
      if (failing) setTimeout(() => send(productRows), SLOW_MS);
      else send(productRows);
    } else if (query.includes("{ refererHost }")) {
      if (failing) res.writeHead(500).end("stub failure");
      else send(sourceRows);
    } else {
      res.writeHead(400).end();
    }
  });
});

server.listen(STUB_PORT, "127.0.0.1", () => {
  console.log(`Web Analytics stub on ${STUB_PORT}`);
});
