-- availability_oneoffs: a single-week availability override ("For week starting").
-- The standing pattern in staff_availability is untouched; for the chosen Monday
-- the one-off replaces the whole week, then the standing pattern resumes.
create table if not exists public.availability_oneoffs (
  staff_name   text        not null,
  week_start   date        not null,            -- the Monday the override applies to
  availability jsonb       not null,            -- same shape as staff_availability.availability
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (staff_name, week_start),
  constraint availability_oneoffs_monday check (extract(isodow from week_start) = 1)
);

alter table public.availability_oneoffs enable row level security;

-- Staff manage only their own rows; ShiftOps users (roster builders) and hub admins can read/manage all.
create policy ao_own on public.availability_oneoffs for all to authenticated
  using (lower(btrim(staff_name)) = lower(btrim((select public.current_staff_name()))))
  with check (lower(btrim(staff_name)) = lower(btrim((select public.current_staff_name()))));

create policy ao_shiftops on public.availability_oneoffs for all to authenticated
  using ((select public.has_app_access('shiftops')) or (select public.is_current_user_hub_admin()))
  with check ((select public.has_app_access('shiftops')) or (select public.is_current_user_hub_admin()));

revoke all on public.availability_oneoffs from anon;
