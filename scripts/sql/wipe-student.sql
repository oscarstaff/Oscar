-- YatraLine: let a hub admin permanently wipe a lead or student (Delete permanently button on the person's page).
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- nex_wipe_student(p_student) -> jsonb of how many rows were removed per table.
--   * Only a signed-in hub admin with Yatra access (the same test as the existing delete policy on nex_students).
--   * Refuses when money is involved (any payment or refund) or the person is on the blacklist: archive them instead,
--     or remove the blacklist entry first. Financial and safety records are never wiped by accident.
--   * Removes the person, their enrolments (documents, placements and requests go with them), bookings, calls, emails,
--     tasks, form answers and every other row tied to them.
--   * The audit trail (nex_audit) is left as it is: it records who deleted what and when, and keeps the old row.

create or replace function public._nex_wipe_student_rows(p_student uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t text; n int; res jsonb := '{}'::jsonb;
  tabs text[] := array[
    'nex_placement_doc_mail', 'nex_class_confirm_mail',      -- these two block the delete, so they go first
    'call_log', 'nex_email_log', 'nex_class_bookings', 'nex_form_responses',
    'nex_enrolment_form_log', 'nex_tasks', 'nex_logbook_receipts', 'nex_enrolments'
  ];
begin
  foreach t in array tabs loop
    execute format('delete from public.%I where student_id = $1', t) using p_student;
    get diagnostics n = row_count;
    if n > 0 then res := res || jsonb_build_object(t, n); end if;
  end loop;
  delete from public.nex_students where id = p_student;   -- the rest (notes, follow-ups, details, paid totals, welcome email row...) cascades
  get diagnostics n = row_count;
  return res || jsonb_build_object('nex_students', n);
end $$;
revoke all on function public._nex_wipe_student_rows(uuid) from public, anon, authenticated;

create or replace function public.nex_wipe_student(p_student uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.nex_open() and public.is_current_user_hub_admin()) then
    raise exception 'Only hub admins can permanently delete records.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.nex_students where id = p_student) then
    raise exception 'That record no longer exists.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.nex_payments p where p.student_id = p_student
             or p.enrolment_id in (select id from public.nex_enrolments where student_id = p_student))
     or exists (select 1 from public.nex_refunds r where r.enrolment_id in (select id from public.nex_enrolments where student_id = p_student)) then
    raise exception 'This person has payments or refunds recorded, so they cannot be wiped. Archive them instead.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.nex_blacklist b where b.student_id = p_student) then
    raise exception 'This person is on the blacklist. Remove the blacklist entry first, then wipe.' using errcode = 'P0001';
  end if;
  return public._nex_wipe_student_rows(p_student);
end $$;
revoke all on function public.nex_wipe_student(uuid) from public, anon;
grant execute on function public.nex_wipe_student(uuid) to authenticated;
