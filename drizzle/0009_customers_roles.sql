CREATE TYPE "public"."account_event_type" AS ENUM('role_changed', 'details_edited', 'removed');--> statement-breakpoint
CREATE TABLE "account_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"type" "account_event_type" NOT NULL,
	"actor_user_id" uuid,
	"from_role" "user_role",
	"to_role" "user_role",
	"fields" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_events_roles_check" CHECK ((("account_events"."type" = 'role_changed') = ("account_events"."from_role" is not null and "account_events"."to_role" is not null)) and ("account_events"."type" = 'role_changed' or ("account_events"."from_role" is null and "account_events"."to_role" is null))),
	CONSTRAINT "account_events_fields_check" CHECK ((("account_events"."type" = 'details_edited') = ("account_events"."fields" is not null)) and ("account_events"."fields" is null or (cardinality("account_events"."fields") between 1 and 2 and "account_events"."fields" <@ array['full_name','phone']::text[])))
);
--> statement-breakpoint
ALTER TABLE "account_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account_events" ADD CONSTRAINT "account_events_actor_user_id_profiles_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_events_profile_id_created_at_idx" ON "account_events" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "account_events_actor_user_id_idx" ON "account_events" USING btree ("actor_user_id");