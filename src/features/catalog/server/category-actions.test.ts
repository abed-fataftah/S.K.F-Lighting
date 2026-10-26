import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-2, AC-18 (spec 0008). The database is replaced by a spy, so these tests prove what
// each action does before it would touch it.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireAdmin = vi.fn();
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));

const getDb = vi.fn(async () => {
  throw new Error("the database must not be reached");
});
vi.mock("@/server/db", () => ({ getDb }));

const { createCategory, deleteCategory, moveCategory, updateCategory } =
  await import("./category-actions");

const ID = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ ok: true, data: { userId: "admin" } });
});

describe("every category action is admin only", () => {
  it("refuses a customer or an aal1 session and reads or writes nothing", async () => {
    requireAdmin.mockResolvedValue({ ok: false, error: "forbidden" });
    const forbidden = { ok: false, error: "forbidden" };

    expect(await createCategory(form({ name: "ثريات", isVisible: "on" }))).toEqual(forbidden);
    expect(await updateCategory(form({ id: ID, name: "ثريات" }))).toEqual(forbidden);
    expect(await moveCategory({ id: ID, direction: "up" })).toEqual(forbidden);
    expect(await deleteCategory({ id: ID })).toEqual(forbidden);
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("input is checked before the database", () => {
  it("returns field errors for a short name or a long description", async () => {
    expect(await createCategory(form({ name: " ث " }))).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { name: { code: "too_short" } },
    });
    expect(
      await updateCategory(form({ id: ID, name: "ثريات", description: "و".repeat(501) })),
    ).toMatchObject({ error: "invalid", fieldErrors: { description: { code: "too_long" } } });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("treats a bad id as not found", async () => {
    expect(await updateCategory(form({ id: "x", name: "ثريات" }))).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await moveCategory({ id: "x", direction: "up" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await deleteCategory({ id: "x" })).toEqual({ ok: false, error: "not_found" });
    expect(getDb).not.toHaveBeenCalled();
  });
});
