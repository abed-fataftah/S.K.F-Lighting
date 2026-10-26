CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_key" text NOT NULL,
	"alt" text NOT NULL,
	"link_category_id" uuid,
	"link_product_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "banners_one_link_check" CHECK (num_nonnulls("banners"."link_category_id", "banners"."link_product_id") <= 1)
);
--> statement-breakpoint
ALTER TABLE "banners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "featured_products" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"sort" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "featured_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "show_on_home" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "home_subtitle" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_key" text;--> statement-breakpoint
-- Spec 0011 AC-14: added nullable, filled for the two launch zones by name (any other zone keeps
-- its full name), then made not null.
ALTER TABLE "delivery_zones" ADD COLUMN "short_name" text;--> statement-breakpoint
update public.delivery_zones set short_name = case name
  when 'الضفة الغربية' then 'الضفة'
  when 'الداخل (مناطق 48)' then 'الداخل'
  else name
end;--> statement-breakpoint
ALTER TABLE "delivery_zones" ALTER COLUMN "short_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "home_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_link_category_id_categories_id_fk" FOREIGN KEY ("link_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_link_product_id_products_id_fk" FOREIGN KEY ("link_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "featured_products" ADD CONSTRAINT "featured_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "banners_link_category_id_idx" ON "banners" USING btree ("link_category_id");--> statement-breakpoint
CREATE INDEX "banners_link_product_id_idx" ON "banners" USING btree ("link_product_id");;--> statement-breakpoint
-- The weekly sweep (spec 0011 AC-13) keeps every banner and category photo a row still points at,
-- so its login may read those keys and nothing else on these tables.
grant select (image_key) on public.banners to media_sweep;--> statement-breakpoint
create policy banners_media_sweep_read on public.banners for select to media_sweep using (true);--> statement-breakpoint
grant select (image_key) on public.categories to media_sweep;--> statement-breakpoint
create policy categories_media_sweep_read on public.categories for select to media_sweep using (true);