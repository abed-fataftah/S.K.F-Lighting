// The Postgres error behind a failed query: postgres.js puts `code` and `constraint_name` on the error,
// and Drizzle may wrap it in `cause`. Writes map expected violations by constraint name (spec 0006).

export type PgError = { readonly code?: string; readonly constraint_name?: string };

export function pgErrorOf(error: unknown): PgError | undefined {
  const candidate = error as ({ cause?: unknown } & PgError) | null | undefined;
  return candidate?.code ? candidate : (candidate?.cause as PgError | undefined);
}

/** `23505`: a unique index or constraint refused the row. */
export const isUniqueViolation = (error: unknown, constraint: string) => {
  const pg = pgErrorOf(error);
  return pg?.code === "23505" && pg.constraint_name === constraint;
};

/** `23503`: a foreign key refused it (for example a delete that lost a race with a new order line). */
export const isForeignKeyViolation = (error: unknown) => pgErrorOf(error)?.code === "23503";
