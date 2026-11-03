import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./columns";
import { accountEventType, userRole } from "./enums";
import { profiles } from "./profiles";

// What the owner changed on a registered account (spec 0019 AC-17), append only. `profile_id` has
// no FK, so the row outlives the profile after a removal; no row ever holds a name, phone, or
// email, so nothing personal outlives it (AC-13).
export const accountEvents = pgTable(
  "account_events",
  {
    id: id(),
    profileId: uuid("profile_id").notNull(),
    type: accountEventType("type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
    fromRole: userRole("from_role"),
    toRole: userRole("to_role"),
    fields: text("fields").array(),
    createdAt: createdAt(),
  },
  (t) => [
    index("account_events_profile_id_created_at_idx").on(t.profileId, t.createdAt),
    index("account_events_actor_user_id_idx").on(t.actorUserId),
    check(
      "account_events_roles_check",
      sql`((${t.type} = 'role_changed') = (${t.fromRole} is not null and ${t.toRole} is not null)) and (${t.type} = 'role_changed' or (${t.fromRole} is null and ${t.toRole} is null))`,
    ),
    check(
      "account_events_fields_check",
      sql`((${t.type} = 'details_edited') = (${t.fields} is not null)) and (${t.fields} is null or (cardinality(${t.fields}) between 1 and 2 and ${t.fields} <@ array['full_name','phone']::text[]))`,
    ),
  ],
).enableRLS();
