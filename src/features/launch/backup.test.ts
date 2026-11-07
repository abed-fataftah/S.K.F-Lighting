import { describe, expect, it } from "vitest";
import {
  backupPrefix,
  backupStamp,
  mediaGuard,
  newestEarlierManifest,
  parseRecipients,
} from "./backup";

const KEY_A = "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p";
const KEY_B = "age1lggyhqrw2nlhcxprm67z43rta597azn8gknawjehu9d9dl0jq3yqqvfafg";
const KEY_C = "age1zvkyg2lqzraa2lnjvqej32nkuu0ues2s82hzrye869xeexvn73equnujwj";
const KEY_D = "age1yhm4gctwfmrpz87tdslm550wrx6m79y9f2hdzt0lndjnehwj0ukqrjpyx5";

// covers: AC-4 (spec 0028): the run's start in UTC to the minute.
describe("backupStamp", () => {
  it("names the minute in UTC", () => {
    expect(backupStamp(new Date("2026-11-08T01:00:42.123Z"))).toBe("20261108T0100Z");
  });

  it("stays on the UTC day at a day boundary, whatever the machine's zone", () => {
    expect(backupStamp(new Date("2026-11-07T23:59:59.999Z"))).toBe("20261107T2359Z");
    expect(backupStamp(new Date("2026-11-08T00:00:00.000Z"))).toBe("20261108T0000Z");
    // 01:30 on 8 November in Asia/Hebron is still 7 November in UTC.
    expect(backupStamp(new Date("2026-11-08T01:30:00+02:00"))).toBe("20261107T2330Z");
    expect(backupStamp(new Date("2026-11-08T02:30:00+02:00"))).toBe("20261108T0030Z");
  });
});

// covers: AC-4 (spec 0028): hand runs write beside, never over, the weekly copies.
describe("backupPrefix", () => {
  it("writes the Sunday run under db/", () => {
    expect(backupPrefix("20261108T0100Z", "schedule")).toBe("db/20261108T0100Z/");
  });

  it.each(["workflow_dispatch", undefined, "push"])("writes a %s run under db/manual/", (event) => {
    expect(backupPrefix("20261108T1215Z", event)).toBe("db/manual/20261108T1215Z/");
  });

  it("refuses a stamp that is not one", () => {
    expect(() => backupPrefix("2026-11-08", "schedule")).toThrow(RangeError);
    expect(() => backupPrefix("../20261108T0100Z", "schedule")).toThrow(RangeError);
  });
});

// covers: AC-4 (spec 0028): 2 different age public keys, or 3 during a rotation (AC-17),
// checked before anything is dumped.
describe("parseRecipients", () => {
  it("takes two keys, one per line, with blank lines and spaces around them", () => {
    expect(parseRecipients(`${KEY_A}\n${KEY_B}\n`)).toEqual({ ok: true, data: [KEY_A, KEY_B] });
    expect(parseRecipients(`  ${KEY_A}\r\n\r\n${KEY_B}  `)).toEqual({
      ok: true,
      data: [KEY_A, KEY_B],
    });
  });

  it("takes a third key while one is being rotated", () => {
    expect(parseRecipients(`${KEY_A}\n${KEY_B}\n${KEY_C}\n`)).toEqual({
      ok: true,
      data: [KEY_A, KEY_B, KEY_C],
    });
  });

  it.each([
    ["nothing", undefined],
    ["an empty value", ""],
    ["one key", KEY_A],
    ["four keys", `${KEY_A}\n${KEY_B}\n${KEY_C}\n${KEY_D}`],
    ["two keys on one line", `${KEY_A} ${KEY_B}`],
  ])("refuses %s", (_name, text) => {
    expect(parseRecipients(text)).toEqual({ ok: false, error: "not_two_or_three_keys" });
  });

  it("refuses a line that is not an age public key", () => {
    expect(parseRecipients(`${KEY_A}\nAGE-SECRET-KEY-1QQQQ`)).toEqual({
      ok: false,
      error: "not_age_keys",
    });
    expect(parseRecipients(`${KEY_A}\nssh-ed25519 AAAAC3Nz`)).toEqual({
      ok: false,
      error: "not_age_keys",
    });
  });

  it("refuses the same key twice, which would leave one key that opens nothing else", () => {
    expect(parseRecipients(`${KEY_A}\n${KEY_A}`)).toEqual({ ok: false, error: "same_key" });
    expect(parseRecipients(`${KEY_A}\n${KEY_B}\n${KEY_A}`)).toEqual({
      ok: false,
      error: "same_key",
    });
  });
});

// covers: AC-6 (spec 0028): the photo sync never runs on an empty or sharply shrunk source.
describe("mediaGuard", () => {
  it("refuses an empty source, with or without an earlier count", () => {
    expect(mediaGuard(0, null)).toBe("empty");
    expect(mediaGuard(0, 0)).toBe("empty");
  });

  it("refuses at 20% fewer and more, passes just under", () => {
    expect(mediaGuard(80, 100)).toBe("dropped");
    expect(mediaGuard(10, 100)).toBe("dropped");
    expect(mediaGuard(81, 100)).toBe("ok");
    expect(mediaGuard(4, 5)).toBe("dropped");
  });

  it("passes growth, the same count, and a first run with nothing to compare", () => {
    expect(mediaGuard(120, 100)).toBe("ok");
    expect(mediaGuard(100, 100)).toBe("ok");
    expect(mediaGuard(3, null)).toBe("ok");
  });
});

// covers: AC-6 (spec 0028): the drop check compares against the newest earlier manifest.
describe("newestEarlierManifest", () => {
  const listing = [
    "20261025T0100Z/auth.age",
    "20261025T0100Z/manifest.json",
    "20261101T0100Z/manifest.json",
    "manual/20261103T1200Z/manifest.json",
    "manual/20261103T1200Z/dump.age",
    "20261108T0100Z/manifest.json",
  ];

  it("picks the newest manifest before the stamp, hand runs included", () => {
    expect(newestEarlierManifest(listing, "20261108T0100Z")).toBe(
      "manual/20261103T1200Z/manifest.json",
    );
    expect(newestEarlierManifest(listing, "20261102T0000Z")).toBe("20261101T0100Z/manifest.json");
  });

  it("finds nothing on a first run", () => {
    expect(newestEarlierManifest([], "20261108T0100Z")).toBeNull();
    expect(newestEarlierManifest(listing, "20261025T0100Z")).toBeNull();
    expect(newestEarlierManifest(["20261101T0100Z/dump.age"], "20261108T0100Z")).toBeNull();
  });
});
