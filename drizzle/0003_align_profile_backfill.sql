-- Custom SQL migration (spec 0002, AC-3). Fixes forward the 0001 backfill, which copied sign up
-- names as typed: blank names became '' and never fell back to Google's `name`, and padded names
-- kept their spaces. The name here is the same expression `handle_new_user()` uses.

-- 1. Any auth user still without a profile gets one, named the way the trigger names it.
insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
  )
from auth.users u
on conflict (id) do nothing;--> statement-breakpoint

-- 2. Profiles that still hold exactly what the 0001 backfill wrote get the trigger's name instead.
-- A name set any other way (the trigger, or a later edit) never matches the raw value, so it stays.
update public.profiles p
set full_name = coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
  ),
  updated_at = now()
from auth.users u
where u.id = p.id
  and p.full_name is not distinct from coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
  and p.full_name is distinct from coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
  );
