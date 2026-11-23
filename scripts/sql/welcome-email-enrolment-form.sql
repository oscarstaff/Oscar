-- YatraLine: welcome email for every new lead (sent from the support mailbox) + the Enrolment form tick in the documents list.
-- Already applied to the live database as the migration "welcome_email_and_enrolment_form". Kept here so the setup can be rebuilt.
-- Safe to run more than once.

-- 1. "Enrolment form" is the first item in each course's document list. The Google Form (scripts/enrolment-form-sync.gs) ticks it by itself.
insert into public.nex_doc_types (group_key, name, note, position)
select g, 'Enrolment form', 'The student''s Google Form. Ticks itself when they submit it', 0
from unnest(array['care','medication','rpl_other','childcare']) g
where not exists (select 1 from public.nex_doc_types t where t.group_key = g and t.name = 'Enrolment form');

-- 2. One row per student: whether the welcome email has gone out.
create table if not exists public.nex_welcome_mail (
  student_id uuid primary key references public.nex_students(id) on delete cascade,
  to_email text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.nex_welcome_mail enable row level security;
drop policy if exists nex_welcome_mail_sel on public.nex_welcome_mail;
create policy nex_welcome_mail_sel on public.nex_welcome_mail for select using ((select public.nex_open()));
-- no insert / update / delete policy: rows are written by the two functions below and by the sender (service role)
drop trigger if exists t_touch on public.nex_welcome_mail;
create trigger t_touch before update on public.nex_welcome_mail for each row execute function public.nex_touch();
drop trigger if exists t_audit on public.nex_welcome_mail;
create trigger t_audit after insert or update or delete on public.nex_welcome_mail for each row execute function public.nex_audit_row();
create index if not exists nex_welcome_mail_open_idx on public.nex_welcome_mail (status, created_at) where status in ('pending','failed');

-- asks the sender to run now (the 5-minute job below is the safety net if this call is missed)
create or replace function public.nex_welcome_kick() returns void
language plpgsql security definer set search_path to 'public','vault','net','pg_temp' as $f$
begin
  perform net.http_post(
    url := 'https://jcfgldqrdbfkgbixszds.supabase.co/functions/v1/nex-send-welcome',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := '{}'::jsonb);
exception when others then null;   -- never block adding a lead
end $f$;
revoke all on function public.nex_welcome_kick() from public, anon, authenticated;

-- 3. A new lead added by a signed-in staff member gets the email. Not: imports and the SQL editor (no signed-in user),
--    people added from a First Aid class booking, or leads with no valid email.
create or replace function public.nex_welcome_on_lead() returns trigger
language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare em text := nullif(btrim(coalesce(new.email,'')),'');
begin
  if auth.uid() is null or new.deleted_at is not null then return new; end if;
  if em is null or em !~ '^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$' then return new; end if;
  if coalesce(new.source_note,'') ilike 'From class booking%' then return new; end if;
  insert into public.nex_welcome_mail(student_id, to_email, created_by)
  values (new.id, lower(em), public.current_staff_name()) on conflict (student_id) do nothing;
  perform public.nex_welcome_kick();
  return new;
exception when others then return new;   -- the email must never stop a lead being added
end $f$;
drop trigger if exists t_welcome_lead on public.nex_students;
create trigger t_welcome_lead after insert on public.nex_students for each row execute function public.nex_welcome_on_lead();

-- 4. Send (or send again) from the student's page.
create or replace function public.nex_queue_welcome(p_student uuid) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare em text; st text;
begin
  if not public.nex_open() then raise exception 'Not allowed'; end if;
  select lower(nullif(btrim(coalesce(email,'')),'')) into em from public.nex_students where id = p_student and deleted_at is null;
  if em is null or em !~ '^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$' then raise exception 'This person has no valid email address.'; end if;
  select status into st from public.nex_welcome_mail where student_id = p_student;
  if st in ('pending','sending') then return jsonb_build_object('status', st); end if;
  insert into public.nex_welcome_mail(student_id, to_email, created_by) values (p_student, em, public.current_staff_name())
  on conflict (student_id) do update set to_email = em, status = 'pending', attempts = 0, last_error = null, sent_at = null, created_by = public.current_staff_name();
  perform public.nex_welcome_kick();
  return jsonb_build_object('status','pending');
end $f$;
grant execute on function public.nex_queue_welcome(uuid) to authenticated;

-- 5. Retry anything still waiting or failed, every 5 minutes.
select cron.unschedule('welcome-email-retry') where exists (select 1 from cron.job where jobname = 'welcome-email-retry');
select cron.schedule('welcome-email-retry', '*/5 * * * *', 'select public.nex_welcome_kick()');

-- 6. The Google Form: what it sent, and which student it matched.
create table if not exists public.nex_enrolment_form_log (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text unique,
  name text, email text, phone text,
  student_id uuid references public.nex_students(id) on delete set null,
  matched_by text, ticked int not null default 0, reason text,
  created_at timestamptz not null default now()
);
alter table public.nex_enrolment_form_log enable row level security;
drop policy if exists nex_enrolment_form_log_sel on public.nex_enrolment_form_log;
create policy nex_enrolment_form_log_sel on public.nex_enrolment_form_log for select using ((select public.nex_open()));

create or replace function public.nex_tick_enrolment_form(p_student uuid) returns int
language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare n int := 0; old text := current_setting('request.jwt.claims', true);
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);   -- the form ticking a document, not staff: skip the staff-only guards
  insert into public.nex_enrolment_docs(enrolment_id, doc_type_id, created_by)
  select e.id, t.id, 'Google Form'
  from public.nex_enrolments e
  join public.nex_qualifications q on q.id = e.qualification_id
  join public.nex_doc_types t on t.group_key = q.doc_group and t.name = 'Enrolment form' and t.active
  where e.student_id = p_student and e.deleted_at is null
    and not exists (select 1 from public.nex_enrolment_docs d where d.enrolment_id = e.id and d.doc_type_id = t.id);
  get diagnostics n = row_count;
  perform set_config('request.jwt.claims', coalesce(old, ''), true);   -- put the caller's own identity back
  return n;
end $f$;
revoke all on function public.nex_tick_enrolment_form(uuid) from public, anon, authenticated;

create or replace function public.nex_enrolment_form_intake(p_key text, p_fields jsonb, p_dedupe text default null) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare
  nm text := nullif(regexp_replace(btrim(coalesce(p_fields->>'name','')), '\s+', ' ', 'g'), '');
  em text := lower(nullif(btrim(coalesce(p_fields->>'email','')), ''));
  em2 text := lower(nullif(btrim(coalesce(p_fields->>'email2','')), ''));   -- the Google account the student was signed in with, when it differs
  ph text := nullif(btrim(coalesce(p_fields->>'phone','')), '');
  d9 text; sid uuid; how text; n int; t int := 0; why text;
begin
  if p_key is null or not exists (select 1 from public.nex_intake_keys where key_hash = encode(sha256(convert_to(p_key,'utf8')),'hex')) then raise exception 'Not allowed'; end if;
  if p_dedupe is not null and exists (select 1 from public.nex_enrolment_form_log where dedupe_key = p_dedupe) then return jsonb_build_object('result','duplicate'); end if;
  d9 := right(regexp_replace(coalesce(ph,''), '\D', '', 'g'), 9); if length(d9) < 8 then d9 := null; end if;
  if em is not null or em2 is not null then
    select id into sid from public.nex_students where deleted_at is null and lower(email) in (coalesce(em,''), coalesce(em2,'')) order by (lower(email) = coalesce(em,'')) desc, created_at limit 1;
    if sid is not null then how := 'email'; end if;
  end if;
  if sid is null and d9 is not null then
    select id into sid from public.nex_students where deleted_at is null
      and (right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 9) = d9 or right(regexp_replace(coalesce(phone2,''), '\D', '', 'g'), 9) = d9) order by created_at limit 1;
    if sid is not null then how := 'phone'; end if;
  end if;
  if sid is null and nm is not null then
    select count(*) into n from public.nex_students where deleted_at is null and lower(btrim(first_name || ' ' || coalesce(last_name,''))) = lower(nm);
    if n = 1 then select id into sid from public.nex_students where deleted_at is null and lower(btrim(first_name || ' ' || coalesce(last_name,''))) = lower(nm); how := 'name'; end if;
  end if;
  if sid is null then why := 'No student matched the name or email on the form';
  else
    t := public.nex_tick_enrolment_form(sid);
    if t = 0 and not exists (select 1 from public.nex_enrolments where student_id = sid and deleted_at is null) then why := 'The student has no enrolment yet; it ticks when one is added'; end if;
  end if;
  insert into public.nex_enrolment_form_log(dedupe_key, name, email, phone, student_id, matched_by, ticked, reason) values (p_dedupe, nm, coalesce(em, em2), ph, sid, how, t, why);
  return jsonb_build_object('result', case when sid is null then 'not_matched' when t > 0 then 'ticked' else 'already_or_no_enrolment' end, 'matched_by', how, 'ticked', t, 'reason', why);
end $f$;
grant execute on function public.nex_enrolment_form_intake(text, jsonb, text) to anon, authenticated;

-- an enrolment added after the form came in picks the tick up
create or replace function public.nex_enrolment_form_on_enrol() returns trigger
language plpgsql security definer set search_path to 'public','pg_temp' as $f$
begin
  if exists (select 1 from public.nex_enrolment_form_log where student_id = new.student_id) then perform public.nex_tick_enrolment_form(new.student_id); end if;
  return new;
exception when others then return new;
end $f$;
drop trigger if exists t_form_on_enrol on public.nex_enrolments;
create trigger t_form_on_enrol after insert or update of qualification_id on public.nex_enrolments for each row execute function public.nex_enrolment_form_on_enrol();
