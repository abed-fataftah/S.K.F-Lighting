CREATE TABLE "draft_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"quantity" integer,
	"sort" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_lines_draft_variant_unique" UNIQUE("draft_id","variant_id"),
	CONSTRAINT "draft_lines_variant_needs_product_check" CHECK ("draft_lines"."variant_id" is null or "draft_lines"."product_id" is not null),
	CONSTRAINT "draft_lines_quantity_check" CHECK ("draft_lines"."quantity" between 1 and 999)
);
--> statement-breakpoint
ALTER TABLE "draft_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"customer_phone_e164" text,
	"fulfilment" "fulfilment_method",
	"delivery_zone_id" uuid,
	"city" text,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drafts_name_check" CHECK (char_length("drafts"."name") between 2 and 40)
);
--> statement-breakpoint
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draft_lines" ADD CONSTRAINT "draft_lines_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_lines" ADD CONSTRAINT "draft_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_lines" ADD CONSTRAINT "draft_lines_variant_product_fk" FOREIGN KEY ("variant_id","product_id") REFERENCES "public"."product_variants"("id","product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_owner_user_id_profiles_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_delivery_zone_id_delivery_zones_id_fk" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "draft_lines_draft_id_idx" ON "draft_lines" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "draft_lines_product_id_idx" ON "draft_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "draft_lines_variant_id_idx" ON "draft_lines" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drafts_owner_name_unique" ON "drafts" USING btree ("owner_user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "drafts_owner_updated_idx" ON "drafts" USING btree ("owner_user_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "drafts_delivery_zone_id_idx" ON "drafts" USING btree ("delivery_zone_id");