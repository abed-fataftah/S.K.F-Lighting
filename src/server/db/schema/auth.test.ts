import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { authUsers } from "./auth";

describe("authUsers stub", () => {
  const table = getTableConfig(authUsers);

  it("points at Supabase's auth.users, outside the public schema Drizzle migrates", () => {
    expect(table.schema).toBe("auth");
    expect(table.name).toBe("users");
  });

  it("exposes the uuid id that public tables reference", () => {
    const id = table.columns.find((column) => column.name === "id");

    expect(id?.getSQLType()).toBe("uuid");
    expect(id?.primary).toBe(true);
  });
});
