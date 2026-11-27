-- Wellbeing popup log: who was shown which check-in popup, and when.
-- Run once in the Supabase SQL editor. Safe to re-run.
--   * Staff can only add a row for THEMSELVES (written by Nexus when the popup appears).
--   * Only hub admins can read it (ShiftOps > Employees > Wellbeing).
--   * Nobody can edit or delete rows from the app.
--   * The anon key has no access at all.

create table if not exists public.wellbeing_popup_log (
  id         bigint generated always as identity primary key,
  staff_name text        not null,
  rule       text        not null check (rule in ('late_some','late_a_lot','sick_calls')),
  n          int,                                  -- how many shifts / calls triggered it
  shown_at   timestamptz not null default now()
);
create index if not exists wellbeing_popup_log_shown_idx on public.wellbeing_popup_log (shown_at desc);

alter table public.wellbeing_popup_log enable row level security;

revoke all on table public.wellbeing_popup_log from anon, public, authenticated;
grant select, insert on table public.wellbeing_popup_log to authenticated;

drop policy if exists wpl_insert_self on public.wellbeing_popup_log;
create policy wpl_insert_self on public.wellbeing_popup_log
  for insert to authenticated
  with check (staff_name = (select public.current_staff_name()));

drop policy if exists wpl_select_admin on public.wellbeing_popup_log;
create policy wpl_select_admin on public.wellbeing_popup_log
  for select to authenticated
  using ((select public.is_current_user_hub_admin()));
