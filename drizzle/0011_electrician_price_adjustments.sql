CREATE TABLE "order_line_price_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_event_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"old_unit_price" integer NOT NULL,
	"new_unit_price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_line_price_changes_old_unit_price_check" CHECK ("order_line_price_changes"."old_unit_price" >= 0),
	CONSTRAINT "order_line_price_changes_new_unit_price_check" CHECK ("order_line_price_changes"."new_unit_price" >= 0),
	CONSTRAINT "order_line_price_changes_changed_check" CHECK ("order_line_price_changes"."new_unit_price" <> "order_line_price_changes"."old_unit_price")
);
--> statement-breakpoint
ALTER TABLE "order_line_price_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_line_price_changes" ADD CONSTRAINT "order_line_price_changes_order_event_id_order_events_id_fk" FOREIGN KEY ("order_event_id") REFERENCES "public"."order_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_price_changes" ADD CONSTRAINT "order_line_price_changes_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_line_price_changes_order_event_id_idx" ON "order_line_price_changes" USING btree ("order_event_id");--> statement-breakpoint
CREATE INDEX "order_line_price_changes_order_line_id_idx" ON "order_line_price_changes" USING btree ("order_line_id");