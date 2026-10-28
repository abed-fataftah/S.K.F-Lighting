import { describe, expect, it } from "vitest";
import { addOrderId, parseOrderIds, serializeOrderIds } from "./order-ids-cookie";
import { addTracked, MAX_TRACKED, parseTracked, TRACKED_COOKIE_MAX_AGE } from "./tracked-cookie";

// covers: AC-4 (spec 0015). The shared helpers behind `skf_placed` and `skf_tracked`.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("order id cookie helpers", () => {
  it("puts a new id first with no repeats and keeps the newest max", () => {
    const ids = [1, 2, 3, 4].reduce<readonly string[]>((kept, n) => addOrderId(kept, id(n), 3), []);
    expect(ids).toEqual([id(4), id(3), id(2)]);
    expect(addOrderId(ids, id(2), 3)).toEqual([id(2), id(4), id(3)]);
  });

  it("lower cases ids, so one order never appears twice", () => {
    expect(addOrderId([id(1)], id(1).toUpperCase(), 3)).toEqual([id(1)]);
  });

  it("round trips", () => {
    expect(parseOrderIds(serializeOrderIds([id(1), id(2)]), 5)).toEqual([id(1), id(2)]);
  });

  it.each([undefined, "", "bad", "{}", "null", JSON.stringify(["nope", 3])])(
    "empties %j",
    (raw) => {
      expect(parseOrderIds(raw, 5)).toEqual([]);
    },
  );

  it("drops non uuids and repeats, and cuts to max", () => {
    const raw = JSON.stringify(["x", id(1), id(1).toUpperCase(), 7, id(2), id(3)]);
    expect(parseOrderIds(raw, 2)).toEqual([id(1), id(2)]);
  });
});

describe("tracked cookie", () => {
  it("keeps the newest 10 for 30 days", () => {
    const ids = Array.from({ length: 12 }, (_, n) => n + 1).reduce<readonly string[]>(
      (kept, n) => addTracked(kept, id(n)),
      [],
    );
    expect(MAX_TRACKED).toBe(10);
    expect(ids).toHaveLength(10);
    expect(ids[0]).toBe(id(12));
    expect(ids.at(-1)).toBe(id(3));
    expect(TRACKED_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 30);
  });

  it("drops anything malformed", () => {
    expect(parseTracked(JSON.stringify([id(1), "not-a-uuid"]))).toEqual([id(1)]);
    expect(parseTracked("{")).toEqual([]);
  });
});
