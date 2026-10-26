-- Custom SQL migration (spec 0002, build plan task 3). Hand edited: Drizzle cannot express these.

-- 1. Lockdown. The browser never queries the database: the server connects as `postgres`, so
-- `anon`, `authenticated`, and `PUBLIC` get nothing in `public`, now and for objects created later
-- (Postgres grants `execute` on new functions to PUBLIC by default, which both roles inherit).
revoke all on all tables in schema public from anon, authenticated, public;--> statement-breakpoint
revoke all on all sequences in schema public from anon, authenticated, public;--> statement-breakpoint
revoke all on all functions in schema public from anon, authenticated, public;--> statement-breakpoint
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, public;--> statement-breakpoint
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, public;--> statement-breakpoint
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;--> statement-breakpoint

-- 2. A profile for every auth user, created on sign up. Name from sign up metadata, else Google's.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), '')
    )
  );
  return new;
end;
$$;--> statement-breakpoint
revoke execute on function public.handle_new_user() from public, anon, authenticated;--> statement-breakpoint
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();--> statement-breakpoint

-- Backfill: users who signed up before this migration get a profile too.
insert into public.profiles (id, full_name) select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name') from auth.users on conflict (id) do nothing;--> statement-breakpoint

-- 3. A photo's variant always belongs to its product; deleting the variant keeps the photo on the
-- product (`set null` on `variant_id` only, Postgres 15+).
alter table public.product_media
  add constraint product_media_variant_product_fk
  foreign key (variant_id, product_id)
  references public.product_variants (id, product_id)
  on delete set null (variant_id);--> statement-breakpoint

-- 4. Production data: the two launch delivery zones (fees in agorot) and the settings row.
insert into public.delivery_zones (name, fee, sort) values
  ('الضفة الغربية', 2000, 0),
  ('الداخل (مناطق 48)', 7000, 1);--> statement-breakpoint
insert into public.shop_settings (id, shop_name) values (1, 'S.K.F Lighting');
