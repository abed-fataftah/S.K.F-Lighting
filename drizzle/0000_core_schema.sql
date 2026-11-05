CREATE TYPE "public"."actor_kind" AS ENUM('guest', 'customer', 'electrician', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."fulfilment_method" AS ENUM('pickup', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."order_event_type" AS ENUM('created', 'status_changed', 'cancelled', 'line_price_changed', 'payment_recorded', 'return_requested', 'return_decided', 'note');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'hidden', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'electrician', 'admin');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"phone" text,
	"phone_e164" text,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"coin_balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categories_parent_not_self_check" CHECK ("categories"."parent_id" <> "categories"."id")
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "colours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"hex" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "colours_name_unique" UNIQUE("name"),
	CONSTRAINT "colours_hex_check" CHECK ("colours"."hex" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "colours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"kind" "media_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"alt" text,
	"width" integer,
	"height" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_media_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "product_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"size_label" text,
	"size_sort" integer DEFAULT 0 NOT NULL,
	"colour_id" uuid,
	"code" text,
	"price" integer NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_code_unique" UNIQUE("code"),
	CONSTRAINT "product_variants_options_unique" UNIQUE NULLS NOT DISTINCT("product_id","size_label","colour_id"),
	CONSTRAINT "product_variants_id_product_unique" UNIQUE("id","product_id"),
	CONSTRAINT "product_variants_code_check" CHECK ("product_variants"."code" = upper(btrim("product_variants"."code"))),
	CONSTRAINT "product_variants_price_check" CHECK ("product_variants"."price" > 0)
);
--> statement-breakpoint
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"specs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_code_unique" UNIQUE("code"),
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_code_check" CHECK ("products"."code" = upper(btrim("products"."code"))),
	CONSTRAINT "products_specs_check" CHECK (jsonb_typeof("products"."specs") = 'array')
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"fee" integer NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_zones_name_unique" UNIQUE("name"),
	CONSTRAINT "delivery_zones_fee_check" CHECK ("delivery_zones"."fee" >= 0)
);
--> statement-breakpoint
ALTER TABLE "delivery_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_number_counters" (
	"year" smallint PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_number_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"shop_name" text NOT NULL,
	"whatsapp_number" text,
	"contact_phone" text,
	"email" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_settings_single_row_check" CHECK ("shop_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "shop_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "order_event_type" NOT NULL,
	"actor_kind" "actor_kind" NOT NULL,
	"actor_user_id" uuid,
	"from_status" "order_status",
	"to_status" "order_status",
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"product_code" text NOT NULL,
	"variant_code" text,
	"size_label" text,
	"colour_name" text,
	"quantity" integer NOT NULL,
	"catalog_unit_price" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"line_total" integer NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_lines_quantity_check" CHECK ("order_lines"."quantity" > 0),
	CONSTRAINT "order_lines_catalog_unit_price_check" CHECK ("order_lines"."catalog_unit_price" > 0),
	CONSTRAINT "order_lines_unit_price_check" CHECK ("order_lines"."unit_price" >= 0),
	CONSTRAINT "order_lines_line_total_check" CHECK ("order_lines"."line_total" = "order_lines"."unit_price" * "order_lines"."quantity")
);
--> statement-breakpoint
ALTER TABLE "order_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"placed_by_user_id" uuid,
	"placed_by_role" "user_role",
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_phone_e164" text NOT NULL,
	"city" text NOT NULL,
	"area" text,
	"address" text,
	"notes" text,
	"fulfilment" "fulfilment_method" NOT NULL,
	"delivery_zone_id" uuid,
	"delivery_zone_name" text,
	"delivery_fee" integer DEFAULT 0 NOT NULL,
	"subtotal" integer NOT NULL,
	"discount_total" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" "actor_kind",
	"cancel_reason" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_delivery_fee_check" CHECK ("orders"."delivery_fee" >= 0),
	CONSTRAINT "orders_subtotal_check" CHECK ("orders"."subtotal" >= 0),
	CONSTRAINT "orders_discount_total_check" CHECK ("orders"."discount_total" >= 0),
	CONSTRAINT "orders_total_check" CHECK ("orders"."total" = "orders"."subtotal" + "orders"."delivery_fee" - "orders"."discount_total" and "orders"."total" >= 0),
	CONSTRAINT "orders_amount_paid_check" CHECK ("orders"."amount_paid" >= 0),
	CONSTRAINT "orders_delivery_check" CHECK ("orders"."fulfilment" <> 'delivery' or ("orders"."delivery_zone_id" is not null and "orders"."delivery_zone_name" is not null and "orders"."address" is not null and btrim("orders"."address") <> '')),
	CONSTRAINT "orders_pickup_check" CHECK ("orders"."fulfilment" <> 'pickup' or ("orders"."delivery_fee" = 0 and "orders"."delivery_zone_id" is null and "orders"."delivery_zone_name" is null)),
	CONSTRAINT "orders_cancelled_check" CHECK (("orders"."status" = 'cancelled') = ("orders"."cancelled_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_colour_id_colours_id_fk" FOREIGN KEY ("colour_id") REFERENCES "public"."colours"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_user_id_profiles_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_variant_product_fk" FOREIGN KEY ("variant_id","product_id") REFERENCES "public"."product_variants"("id","product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_placed_by_user_id_profiles_id_fk" FOREIGN KEY ("placed_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_zone_id_delivery_zones_id_fk" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_phone_e164_idx" ON "profiles" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "product_media_product_id_idx" ON "product_media" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_media_variant_id_idx" ON "product_media" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_colour_id_idx" ON "product_variants" USING btree ("colour_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_one_default_idx" ON "product_variants" USING btree ("product_id") WHERE "product_variants"."is_default";--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_events_order_id_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_events_actor_user_id_idx" ON "order_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "order_events_unseen_idx" ON "order_events" USING btree ("created_at") WHERE "order_events"."seen_at" is null;--> statement-breakpoint
CREATE INDEX "order_lines_order_id_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_lines_product_id_idx" ON "order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_lines_variant_id_idx" ON "order_lines" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "orders_placed_by_user_id_idx" ON "orders" USING btree ("placed_by_user_id");--> statement-breakpoint
CREATE INDEX "orders_customer_phone_e164_idx" ON "orders" USING btree ("customer_phone_e164");--> statement-breakpoint
CREATE INDEX "orders_delivery_zone_id_idx" ON "orders" USING btree ("delivery_zone_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_placed_at_idx" ON "orders" USING btree ("placed_at");