CREATE TYPE "public"."payment_kind" AS ENUM('payment', 'refund', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'cheque');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "payment_kind" NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount" integer NOT NULL,
	"received_on" date NOT NULL,
	"cheque_number" text,
	"cheque_bank" text,
	"cheque_due_date" date,
	"reverses_payment_id" uuid,
	"note" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_cheque_check" CHECK (("payments"."method" = 'cheque' and num_nonnulls("payments"."cheque_number", "payments"."cheque_bank", "payments"."cheque_due_date") = 3) or ("payments"."method" = 'cash' and num_nulls("payments"."cheque_number", "payments"."cheque_bank", "payments"."cheque_due_date") = 3)),
	CONSTRAINT "payments_reversal_check" CHECK (("payments"."kind" = 'reversal') = ("payments"."reverses_payment_id" is not null)),
	CONSTRAINT "payments_reversal_note_check" CHECK ("payments"."kind" <> 'reversal' or ("payments"."note" is not null and btrim("payments"."note") <> '')),
	CONSTRAINT "payments_not_self_check" CHECK ("payments"."reverses_payment_id" is null or "payments"."reverses_payment_id" <> "payments"."id")
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reverses_payment_id_fk" FOREIGN KEY ("reverses_payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_recorded_by_idx" ON "payments" USING btree ("recorded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reverses_payment_id_unique" ON "payments" USING btree ("reverses_payment_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_paid_total_check" CHECK ("orders"."amount_paid" <= "orders"."total");