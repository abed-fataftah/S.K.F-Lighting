import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const boundary = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  postgres: vi.fn(),
  drizzle: vi.fn(),
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: boundary.getCloudflareContext }));
vi.mock("postgres", () => ({ default: boundary.postgres }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: boundary.drizzle }));

const sqlClient = { kind: "postgres.js client" };
const dbClient = { kind: "drizzle client" };

// covers: DW-1 (spec 0001, DB client lifecycle row)
describe("getDb", () => {
  beforeEach(() => {
    vi.resetModules();
    const context = { env: { HYPERDRIVE: { connectionString: "postgres://hyperdrive.local/db" } } };
    boundary.getCloudflareContext.mockReset().mockResolvedValue(context);
    boundary.postgres.mockReset().mockReturnValue(sqlClient);
    boundary.drizzle.mockReset().mockReturnValue(dbClient);
  });

  it("opens no database connection when the module is imported", async () => {
    await import("./index");

    expect(boundary.postgres).not.toHaveBeenCalled();
    expect(boundary.getCloudflareContext).not.toHaveBeenCalled();
  });

  it("connects through the Hyperdrive binding of the current request", async () => {
    const { getDb } = await import("./index");

    await getDb();

    expect(boundary.getCloudflareContext).toHaveBeenCalledWith({ async: true });
    expect(boundary.postgres).toHaveBeenCalledWith(
      "postgres://hyperdrive.local/db",
      expect.anything(),
    );
  });

  it("uses one connection with prepared statements off, as the Supabase pooler requires", async () => {
    const { getDb } = await import("./index");

    await getDb();

    expect(boundary.postgres).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ max: 1, prepare: false }),
    );
  });

  it("returns a Drizzle client built on that connection with the app schema", async () => {
    const { getDb } = await import("./index");

    const db = await getDb();

    expect(db).toBe(dbClient);
    expect(boundary.drizzle).toHaveBeenCalledWith(sqlClient, {
      schema: expect.objectContaining({ authUsers: expect.anything() }),
    });
  });

  it("fails when there is no Cloudflare request context", async () => {
    boundary.getCloudflareContext.mockRejectedValue(
      new Error("getCloudflareContext has been called outside a request"),
    );
    const { getDb } = await import("./index");

    await expect(getDb()).rejects.toThrow(/outside a request/);
    expect(boundary.postgres).not.toHaveBeenCalled();
  });
});
