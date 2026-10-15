-- security_08: audit trail for leave
-- 1) leave_submissions.created_by  — who created the row, stamped by the SERVER from the caller's login
-- 2) leave_audit                   — append-only history of every add / change / delete (admins can read)
-- Additive only: no existing column, policy or row is changed.

alter table public.leave_submissions add column if not exists created_by text;

-- ── 1) Stamp the creator from the login, not from anything the browser sends ──
create or replace function public.leave_stamp_creator()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_actor text := public.current_staff_name();
begin
  -- A signed-in caller always wins over whatever the client put in the row.
  -- service_role / relay writes have no login, so keep what they sent (may be null).
  if v_actor is not null then
    new.created_by := v_actor;
  end if;
  -- Admin-added leave is approved on entry: record when.
  if new.status = 'approved' and new.resolved_at is null and new.source in ('ShiftOps','Admin') then
    new.resolved_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_leave_stamp_creator on public.leave_submissions;
create trigger trg_leave_stamp_creator
  before insert on public.leave_submissions
  for each row execute function public.leave_stamp_creator();

-- ── 2) Append-only history ──
create table if not exists public.leave_audit (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       text,                  -- staff name from the login; null = service role / relay
  action      text not null,         -- 'added' | 'changed' | 'deleted'
  leave_id    uuid,
  staff_name  text,
  from_date   text,
  to_date     text,
  old_status  text,
  new_status  text,
  reason      text,
  detail      jsonb
);
alter table public.leave_audit enable row level security;
drop policy if exists leave_audit_admin_read on public.leave_audit;
create policy leave_audit_admin_read on public.leave_audit for select to authenticated
  using ((select public.is_current_user_hub_admin()));
-- No insert/update/delete policies: only the trigger below (security definer) can write.
revoke all on public.leave_audit from anon, authenticated;
grant select on public.leave_audit to authenticated;

create or replace function public.leave_audit_log()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_actor text := public.current_staff_name();
begin
  if tg_op = 'INSERT' then
    insert into public.leave_audit(actor, action, leave_id, staff_name, from_date, to_date, new_status, reason, detail)
    values (v_actor, 'added', new.id, new.staff_name, new.from_date::text, new.to_date::text, new.status, new.reason,
            jsonb_build_object('source', new.source, 'resolved_by', new.resolved_by, 'created_by', new.created_by));
    return new;
  elsif tg_op = 'UPDATE' then
    if (old.status, old.from_date, old.to_date, old.reason, old.resolved_by)
         is distinct from (new.status, new.from_date, new.to_date, new.reason, new.resolved_by) then
      insert into public.leave_audit(actor, action, leave_id, staff_name, from_date, to_date, old_status, new_status, reason, detail)
      values (v_actor, 'changed', new.id, new.staff_name, new.from_date::text, new.to_date::text, old.status, new.status, new.reason,
              jsonb_build_object('old_resolved_by', old.resolved_by, 'new_resolved_by', new.resolved_by,
                                 'old_from', old.from_date, 'old_to', old.to_date));
    end if;
    return new;
  else
    insert into public.leave_audit(actor, action, leave_id, staff_name, from_date, to_date, old_status, reason, detail)
    values (v_actor, 'deleted', old.id, old.staff_name, old.from_date::text, old.to_date::text, old.status, old.reason,
            jsonb_build_object('source', old.source, 'resolved_by', old.resolved_by, 'created_by', old.created_by));
    return old;
  end if;
end $$;

drop trigger if exists trg_leave_audit_log on public.leave_submissions;
create trigger trg_leave_audit_log
  after insert or update or delete on public.leave_submissions
  for each row execute function public.leave_audit_log();

-- Trigger-only functions: not callable from the API
revoke execute on function public.leave_stamp_creator() from public, anon, authenticated;
revoke execute on function public.leave_audit_log()     from public, anon, authenticated;

-- ── Rollback ──
-- drop trigger if exists trg_leave_audit_log on public.leave_submissions;
-- drop trigger if exists trg_leave_stamp_creator on public.leave_submissions;
-- drop function if exists public.leave_audit_log(); drop function if exists public.leave_stamp_creator();
-- drop table if exists public.leave_audit;
-- alter table public.leave_submissions drop column if exists created_by;
