import { describe, expect, it } from "vitest";
import { beaconTokenFor, browserDsnFor } from "./monitoring-env";
import type { PublicEnv } from "./public-env";

const env: PublicEnv = {
  whatsappNumber: "970500000000",
  siteUrl: "https://skf.example",
  sentryDsn: "https://abc@o1.ingest.sentry.io/42",
  cfBeaconToken: "a1b2c3",
};

// covers: AC-6 (spec 0027): the beacon loads only with a token, on the production host.
describe("beaconTokenFor", () => {
  it("gives the token on the production host", () => {
    expect(beaconTokenFor(env, "skf.example")).toBe("a1b2c3");
  });

  it.each(["skf-pro.someone.workers.dev", "www.skf.example", "localhost:8787"])(
    "leaves the beacon out on %s",
    (host) => {
      expect(beaconTokenFor(env, host)).toBeNull();
    },
  );

  it("leaves it out with no token, or no env at all", () => {
    expect(beaconTokenFor({ ...env, cfBeaconToken: null }, "skf.example")).toBeNull();
    expect(beaconTokenFor(null, "skf.example")).toBeNull();
  });
});

// covers: AC-13 (spec 0027): browser Sentry starts only with a DSN, on the production host.
describe("browserDsnFor", () => {
  it("gives the DSN on the production host", () => {
    expect(browserDsnFor(env, "skf.example")).toBe(env.sentryDsn);
  });

  it("starts nothing on a preview host, with no DSN, or with no env", () => {
    expect(browserDsnFor(env, "skf-pro.someone.workers.dev")).toBeNull();
    expect(browserDsnFor({ ...env, sentryDsn: null }, "skf.example")).toBeNull();
    expect(browserDsnFor(null, "skf.example")).toBeNull();
  });
});
