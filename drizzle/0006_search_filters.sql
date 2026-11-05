ALTER TABLE "product_variants" ADD COLUMN "size_key" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "search_text" text DEFAULT '' NOT NULL;