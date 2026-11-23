-- YatraLine: (1) placement documents are not needed when the payment queue says Confirmed no PLC / PLC NYC,
-- (2) going back to Placement Interested puts the student in the "Send placement documents email" review box again,
-- (3) staff notes on a student (Activity tab), (4) the enrolment email is no longer sent automatically for a new lead (a tick on the New lead form instead).
-- Already applied to the live database as the migration "docs_placement_notes". Kept here so the setup can be rebuilt. Safe to run more than once.

-- 1. who does not need placement documents
create or replace function public.nex_plc_off(p_queue text, p_plc text) returns boolean
language sql immutable set search_path to 'public','pg_temp' as $f$
  select coalesce(p_plc = 'plc_nyc' or (p_queue in ('confirmed_no_plc','confirmed_no_plc_less','plc_nyc') and coalesce(p_plc,'') not in ('plc_interested','plc_done')), false)
$f$;
-- the newest queue row of the enrolment decides
create or replace function public.nex_plc_off_enrol(p_enrol uuid) returns boolean
language sql stable set search_path to 'public','pg_temp' as $f$
  select coalesce((select public.nex_plc_off(q.queue_status, q.placement_status) from public.nex_payment_queue q
                    where q.enrolment_id = p_enrol order by q.updated_at desc nulls last, q.created_at desc limit 1), false)
$f$;

-- no placement documents are required for them (the placement request / batch rule counts 0 documents)
create or replace function public.nex_placement_docs(p_enrolment uuid)
returns table(total integer, missing integer, complete_on date, missing_names text)
language sql stable set search_path to 'public','pg_temp' as $f$
  with req as (
    select t.id, t.name, t.position from public.nex_doc_types t where t.group_key = 'placement' and t.active
  ), got as (
    select r.id, r.name, r.position,
           (select min(d.received_on) from public.nex_enrolment_docs d join public.nex_doc_types dt on dt.id = d.doc_type_id
             where d.enrolment_id = p_enrolment and lower(trim(dt.name)) = lower(trim(r.name))) as got_on
    from req r
    where not public.nex_plc_off_enrol(p_enrolment)
  )
  select count(*)::integer,
         count(*) filter (where got_on is null)::integer,
         case when count(*) > 0 and count(*) filter (where got_on is null) = 0 then max(got_on) end,
         string_agg(name, ', ' order by position) filter (where got_on is null)
  from got;
$f$;

-- and they are not on the Ready list while they are not interested
create or replace view public.nex_placement_ready as
 SELECT enrolment_id, student_id, first_name, last_name, qualification_id, stage, paid_total, docs_complete_on, calls, has_placement,
    placement_docs_missing, placement_docs_missing_names, suburb, postcode, pref_shifts, availability, availability_note, english_check,
    english_note, hold, hold_reason, hold_contact, hold_note, hold_on, hold_until, hold_by, fee, agent_id, state, interest_area, readiness,
    placement_note, want_start, want_facility_id, want_facility_text, want_note
   FROM nex_placement_queue
  WHERE paid_ok AND NOT public.nex_plc_off_enrol(enrolment_id) AND ( SELECT nex_open() AS nex_open);

-- 2. back to Placement Interested: the booking's Placement plan becomes Yes (the email is built on it), and a skipped email comes back
create or replace function public.nex_plc_back_on() returns trigger
language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare sid uuid; bid uuid;
begin
  if coalesce(current_setting('nex.plc_back', true), '') = 'on' then return new; end if;
  if new.enrolment_id is null then return new; end if;
  if not (public.nex_plc_off(old.queue_status, old.placement_status) and not public.nex_plc_off(new.queue_status, new.placement_status)) then return new; end if;
  if public.nex_plc_off_enrol(new.enrolment_id) then return new; end if;
  select e.student_id into sid from public.nex_enrolments e where e.id = new.enrolment_id;
  select b.id into bid from public.nex_class_bookings b join public.nex_class_sessions s on s.id = b.session_id and s.kind <> 'renewal'
   where b.status not in ('no_show','cancelled','rescheduled')
     and (b.enrolment_id = new.enrolment_id or (b.enrolment_id is null and b.student_id = sid))
   order by b.created_at desc limit 1;
  if bid is null then return new; end if;
  perform set_config('nex.plc_back', 'on', true);
  perform set_config('nex.flag_bypass', 'on', true);
  update public.nex_class_bookings set placement_plan = 'yes' where id = bid and placement_plan is distinct from 'yes';
  delete from public.nex_placement_doc_mail where booking_id = bid and status = 'skipped';
  perform set_config('nex.flag_bypass', 'off', true);
  perform set_config('nex.plc_back', 'off', true);
  return new;
exception when others then
  perform set_config('nex.flag_bypass', 'off', true); perform set_config('nex.plc_back', 'off', true);
  return new;   -- this must never stop the status change itself
end $f$;
drop trigger if exists t_plc_back on public.nex_payment_queue;
create trigger t_plc_back after update of queue_status, placement_status on public.nex_payment_queue for each row execute function public.nex_plc_back_on();

-- 3. notes on a student, visible to all staff
create table if not exists public.nex_student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.nex_students(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists nex_student_notes_student_idx on public.nex_student_notes (student_id, created_at desc);
alter table public.nex_student_notes enable row level security;
drop policy if exists nex_student_notes_sel on public.nex_student_notes;
drop policy if exists nex_student_notes_ins on public.nex_student_notes;
drop policy if exists nex_student_notes_del on public.nex_student_notes;
create policy nex_student_notes_sel on public.nex_student_notes for select using ((select public.nex_open()));
create policy nex_student_notes_ins on public.nex_student_notes for insert with check ((select public.nex_open()));
create policy nex_student_notes_del on public.nex_student_notes for delete using ((select public.nex_open()) and ((select public.is_current_user_hub_admin()) or created_by = public.current_staff_name()));
grant select, insert, delete on public.nex_student_notes to authenticated;
drop trigger if exists nex_guard on public.nex_student_notes;
create trigger nex_guard before insert or update on public.nex_student_notes for each row execute function public.nex_guard_row();
drop trigger if exists t_live_ping on public.nex_student_notes;
create trigger t_live_ping after insert or delete or update on public.nex_student_notes for each statement execute function public.nex_live_ping_fn();

-- 4. a new lead is no longer emailed by itself; the New lead form has a tick that calls nex_queue_welcome
drop trigger if exists t_welcome_lead on public.nex_students;
