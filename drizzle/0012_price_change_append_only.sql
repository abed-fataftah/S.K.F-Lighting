-- Spec 0022 AC-10: a price change row is history. Once written it is never updated, deleted, or
-- truncated; a wrong cut is fixed by another save. Drizzle snapshots do not track triggers, so
-- later `drizzle-kit generate` runs leave these alone.
create function public.reject_price_change_edit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'order_line_price_changes is append only (% refused)', tg_op
    using errcode = 'restrict_violation';
end;
$$;--> statement-breakpoint
revoke execute on function public.reject_price_change_edit() from public, anon, authenticated;--> statement-breakpoint
create trigger order_line_price_changes_no_edit
  before update or delete on public.order_line_price_changes
  for each row execute function public.reject_price_change_edit();--> statement-breakpoint
create trigger order_line_price_changes_no_truncate
  before truncate on public.order_line_price_changes
  for each statement execute function public.reject_price_change_edit();
