-- YatraLine: team locks for the emails, and a log for the placement email sent from a student's page.
-- Run once in the Supabase SQL editor. Safe to run again.
--
-- Who may send (or send again):
--   Enrolment email ........ Enrolment and Follow-Up teams (and admins)   <- this file locks nex_queue_welcome
--   Placement checklist .... Placement team (and admins)                  <- the edge function nex-send-placement-docs checks it; this file locks the log table
--   First Aid + CPR confirm  Evershine team (and admins)                  <- the edge function nex-send-class-confirm checks it
-- To change a team, change the list in nex_queue_welcome below and WELCOME_TEAMS in pipeline/pl-core.js (canWelcomeMail).

-- 1. a log of placement emails sent from a student's page (a student may have no class booking, so nex_placement_doc_mail cannot hold it)
create table if not exists public.nex_placement_email_log (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.nex_students(id) on delete cascade,
  to_email    text,
  subject     text,
  status      text not null default 'sent',
  created_by  text default public.current_staff_name(),
  created_at  timestamptz not null default now()
);
create index if not exists nex_placement_email_log_student on public.nex_placement_email_log(student_id, created_at desc);
alter table public.nex_placement_email_log enable row level security;

drop policy if exists nex_placement_email_log_sel on public.nex_placement_email_log;
create policy nex_placement_email_log_sel on public.nex_placement_email_log for select using ((select public.nex_open()));
-- only the Placement team (and admins) can add a row, so the lock holds even if someone calls the table directly
drop policy if exists nex_placement_email_log_ins on public.nex_placement_email_log;
create policy nex_placement_email_log_ins on public.nex_placement_email_log for insert with check ((select public.nex_open()) and public.nex_team_ok(array['Placement']));
drop policy if exists nex_placement_email_log_del on public.nex_placement_email_log;
create policy nex_placement_email_log_del on public.nex_placement_email_log for delete using ((select public.nex_open()) and (select public.is_current_user_hub_admin()));

grant select, insert, delete on public.nex_placement_email_log to authenticated;

-- 2. the enrolment email can only be queued (sent, or sent again) by the Enrolment and Follow-Up teams and admins
create or replace function public.nex_queue_welcome(p_student uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare em text; st text;
begin
  if not public.nex_open() then raise exception 'Not allowed'; end if;
  if not public.nex_team_ok(array['Enrolment','Follow-Up']) then raise exception 'Only the Enrolment team can send the enrolment email.'; end if;
  select lower(nullif(btrim(coalesce(email,'')),'')) into em from public.nex_students where id = p_student and deleted_at is null;
  if em is null or em !~ '^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$' then raise exception 'This person has no valid email address.'; end if;
  select status into st from public.nex_welcome_mail where student_id = p_student;
  if st in ('pending','sending') then return jsonb_build_object('status', st); end if;
  insert into public.nex_welcome_mail(student_id, to_email, created_by) values (p_student, em, public.current_staff_name())
  on conflict (student_id) do update set to_email = em, status = 'pending', attempts = 0, last_error = null, sent_at = null, created_by = public.current_staff_name();
  perform public.nex_welcome_kick();
  return jsonb_build_object('status','pending');
end $$;
grant execute on function public.nex_queue_welcome(uuid) to authenticated;

-- 3. the wipe function must clear the new log too (it deletes by student_id before removing the student; the foreign key above cascades, so this is only a belt and braces check)
-- nothing to change: nex_placement_email_log.student_id cascades from nex_students.
