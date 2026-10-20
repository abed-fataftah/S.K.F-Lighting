ALTER TABLE "orders" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_city_check" CHECK ("orders"."fulfilment" <> 'delivery' or btrim(coalesce("orders"."city", '')) <> '');