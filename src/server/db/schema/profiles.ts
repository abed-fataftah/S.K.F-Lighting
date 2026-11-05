import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { timestamps } from "./columns";
import { userRole } from "./enums";

// One row per auth user, created by the `handle_new_user()` trigger (custom migration).
// `phone` and `phone_e164` are set only by the profile form (feature 18).
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    fullName: text("full_name"),
    phone: text("phone"),
    phoneE164: text("phone_e164"),
    role: userRole("role").notNull().default("customer"),
    // Cache of coin_transactions (feature 31); changes only with a ledger row.
    coinBalance: integer("coin_balance").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("profiles_phone_e164_idx").on(t.phoneE164)],
).enableRLS();
