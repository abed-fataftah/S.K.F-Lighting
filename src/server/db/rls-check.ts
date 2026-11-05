import "server-only";
import { sql } from "drizzle-orm";
import type { Database } from "./types";

export type RlsProblem = {
  readonly kind: "rls_disabled" | "table_access" | "sequence_access" | "function_access";
  readonly object: string;
  readonly role?: string;
};

// The browser roles. `has_*_privilege` also counts what they inherit from PUBLIC,
// which grant rows (information_schema) would miss.
const BROWSER_ROLES = ["anon", "authenticated"] as const;

/** Every way the public schema is open to the browser: tables without RLS, and any privilege anon or authenticated holds. */
export async function findRlsProblems(db: Database): Promise<readonly RlsProblem[]> {
  const withoutRls = await db.execute<{ object: string }>(sql`
    select c.relname as object from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
    order by 1`);

  const access = await db.execute<{ kind: RlsProblem["kind"]; object: string; role: string }>(sql`
    with roles(role) as (values ${sql.join(
      BROWSER_ROLES.map((role) => sql`(${role})`),
      sql`, `,
    )})
    select 'table_access' as kind, c.relname as object, r.role from pg_class c
      join pg_namespace n on n.oid = c.relnamespace cross join roles r
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
        and has_table_privilege(r.role, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
    union all
    select 'sequence_access', c.relname, r.role from pg_class c
      join pg_namespace n on n.oid = c.relnamespace cross join roles r
      where n.nspname = 'public' and c.relkind = 'S'
        and has_sequence_privilege(r.role, c.oid, 'USAGE, SELECT, UPDATE')
    union all
    select 'function_access', p.oid::regprocedure::text, r.role from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace cross join roles r
      where n.nspname = 'public' and has_function_privilege(r.role, p.oid, 'EXECUTE')
    order by 1, 2, 3`);

  return [
    ...Array.from(withoutRls, (row) => ({ kind: "rls_disabled" as const, object: row.object })),
    ...Array.from(access, (row) => ({ kind: row.kind, object: row.object, role: row.role })),
  ];
}
