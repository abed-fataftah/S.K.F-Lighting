import { describe, expect, it } from "vitest";
import { addPlaced, parsePlaced, serializePlaced } from "./placed-cookie";

// covers: AC-7, AC-9, AC-11 (spec 0004)

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("placed cookie", () => {
  it("keeps the newest 5, newest first, with no repeats", () => {
    const ids = [1, 2, 3, 4, 5, 6].reduce<readonly string[]>(
      (kept, n) => addPlaced(kept, id(n)),
      [],
    );
    expect(ids).toEqual([id(6), id(5), id(4), id(3), id(2)]);
    expect(addPlaced(ids, id(3))).toEqual([id(3), id(6), id(5), id(4), id(2)]);
  });

  it("round trips", () => {
    expect(parsePlaced(serializePlaced([id(1), id(2)]))).toEqual([id(1), id(2)]);
  });

  it.each([undefined, "", "bad", "{}", JSON.stringify(["nope", 3])])("empties %j", (raw) => {
    expect(parsePlaced(raw)).toEqual([]);
  });

  it("drops non uuids and repeats, and cuts to 5", () => {
    const raw = JSON.stringify([
      "x",
      id(1),
      id(1).toUpperCase(),
      id(2),
      id(3),
      id(4),
      id(5),
      id(6),
    ]);
    expect(parsePlaced(raw)).toEqual([id(1), id(2), id(3), id(4), id(5)]);
  });
});
