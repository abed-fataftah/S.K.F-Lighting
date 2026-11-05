ALTER TABLE "products" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_media_one_video_idx" ON "product_media" USING btree ("product_id") WHERE "product_media"."kind" = 'video';--> statement-breakpoint
-- The weekly media sweep (spec 0006 AC-15) logs in as its own role that can read product ids and
-- nothing else, so CI never holds the postgres login. No password here: it is set by hand in each
-- environment (docs/runbooks/supabase-production.md). Guarded, so a database that already has the
-- role (another branch, a restore) still migrates.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'media_sweep') then
    create role media_sweep with login noinherit;
  end if;
end
$$;--> statement-breakpoint
grant usage on schema public to media_sweep;--> statement-breakpoint
grant select (id) on public.products to media_sweep;--> statement-breakpoint
create policy products_media_sweep_read on public.products for select to media_sweep using (true);
