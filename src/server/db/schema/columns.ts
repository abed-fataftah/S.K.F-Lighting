import { timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").primaryKey().defaultRandom();

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// Set by Drizzle on every update; all writes go through Drizzle (spec 0002, Conventions).
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** `created_at` and `updated_at`, for every table that is edited after insert. */
export const timestamps = () => ({ createdAt: createdAt(), updatedAt: updatedAt() });
