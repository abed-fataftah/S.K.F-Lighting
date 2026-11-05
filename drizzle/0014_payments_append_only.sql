-- Spec 0023 AC-14: a payment row is the money trail. Once written it is never updated, deleted, or
-- truncated; a mistake is undone by a reversal row. Drizzle snapshots do not track triggers, so
-- later `drizzle-kit generate` runs leave these alone.
create function public.reject_payment_edit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'payments is append only (% refused)', tg_op
    using errcode = 'restrict_violation';
end;
$$;--> statement-breakpoint
revoke execute on function public.reject_payment_edit() from public, anon, authenticated;--> statement-breakpoint
create trigger payments_no_edit
  before update or delete on public.payments
  for each row execute function public.reject_payment_edit();--> statement-breakpoint
create trigger payments_no_truncate
  before truncate on public.payments
  for each statement execute function public.reject_payment_edit();
