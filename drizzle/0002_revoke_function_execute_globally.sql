-- Postgres grants EXECUTE on every new function to PUBLIC through a global default, and a default
-- privilege set `in schema public` cannot revoke a global one. Without this, a function `postgres`
-- creates later is callable by anon and authenticated (both inherit PUBLIC), breaking spec 0002 AC-2.
-- Global on purpose: Supabase's own per schema defaults (storage) still grant their roles explicitly.
alter default privileges for role postgres revoke execute on functions from public;
