-- Yatra admins that are separate from Nexus hub admins.
-- Run once in the Supabase SQL editor (safe to run again).
--
-- Before: one flag (staff_settings.is_hub_admin) made someone an admin in both Nexus and Yatra.
-- After:  a second flag (is_yatra_admin) makes someone an admin in Yatra only.
--         Hub admins are still Yatra admins, so nobody loses anything. Only hub admins can change either flag.
--
-- Stays hub-admin only (not moved): two-step login controls (nex_mfa_roster, nex_set_mfa_required, nex_admin_reset_mfa),
-- permanently wiping a student (nex_wipe_student), and everything in Nexus itself.

-- 1. the new flag
alter table public.staff_settings add column if not exists is_yatra_admin boolean not null default false;

-- 2. the check, same shape as is_current_user_hub_admin()
create or replace function public.is_current_user_yatra_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(
    (select coalesce(s.is_hub_admin, false) or coalesce(s.is_yatra_admin, false)
       from public.staff_settings s
      where s.name = public.current_staff_name()
      limit 1),
    false
  );
$$;
revoke all on function public.is_current_user_yatra_admin() from public, anon;
grant execute on function public.is_current_user_yatra_admin() to authenticated, service_role;

-- 3. only hub admins may change the new flag (same guard as the other admin flags)
create or replace function public.guard_staff_admin_flags()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- service_role (server-side / SQL editor / Apps Script service key) bypasses.
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A new row may only carry an admin flag if the creator is a hub admin.
    if (coalesce(new.is_hub_admin,false) or coalesce(new.is_shift_admin,false) or coalesce(new.is_yatra_admin,false))
       and not public.is_current_user_hub_admin() then
      raise exception 'not authorized to set admin flags';
    end if;
    return new;
  end if;

  -- UPDATE: only block when an admin flag actually CHANGES.
  if ( new.is_hub_admin    is distinct from old.is_hub_admin
       or new.is_shift_admin is distinct from old.is_shift_admin
       or new.is_yatra_admin is distinct from old.is_yatra_admin )
     and not public.is_current_user_hub_admin() then
    raise exception 'not authorized to change admin flags';
  end if;

  return new;
end;
$function$;

-- 4. Yatra's own admin shortcut (archive/delete guard and the view-only lock use this)
create or replace function public.nex_admin_ok()
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$ select coalesce(auth.role(),'') in ('','service_role') or coalesce(public.is_current_user_yatra_admin(), false) $$;

-- 5. Yatra functions that exempt admins: point them at the new check (re-running does nothing more)
do $$
declare r record; def text;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.prokind = 'f'
       and p.proname in ('nex_batch_guard','nex_class_closed_guard','nex_enrol_stage_rules','nex_placement_docs_gate','crm_status')
  loop
    def := pg_get_functiondef(r.oid);
    if def like '%is_current_user_hub_admin%' then
      execute replace(def, 'is_current_user_hub_admin', 'is_current_user_yatra_admin');
      raise notice 'updated function %', r.proname;
    end if;
  end loop;
end $$;

-- 6. Yatra table rules (delete, doc types, trainers, audit and the like): point them at the new check
do $$
declare r record; q text; w text; clause text;
begin
  for r in
    select tablename, policyname, cmd, qual, with_check
      from pg_policies
     where schemaname = 'public' and tablename like 'nex\_%'
       and (coalesce(qual,'') || coalesce(with_check,'')) like '%is_current_user_hub_admin%'
  loop
    q := replace(r.qual,       'is_current_user_hub_admin', 'is_current_user_yatra_admin');
    w := replace(r.with_check, 'is_current_user_hub_admin', 'is_current_user_yatra_admin');
    clause := '';
    if r.cmd in ('SELECT','DELETE','UPDATE','ALL') and q is not null then clause := clause || ' using (' || q || ')'; end if;
    if r.cmd in ('INSERT','UPDATE','ALL') and w is not null then clause := clause || ' with check (' || w || ')'; end if;
    if clause <> '' then
      execute format('alter policy %I on public.%I%s', r.policyname, r.tablename, clause);
      raise notice 'updated policy %.%', r.tablename, r.policyname;
    end if;
  end loop;
end $$;

-- To make someone a Yatra admin: Yatra > Admin > "Yatra admins" (hub admins only), or:
--   update public.staff_settings set is_yatra_admin = true where name = 'Their Name';
-- To check what is left on the hub admin check inside Yatra (should only be the two-step login and wipe functions):
--   select p.proname from pg_proc p join pg_namespace s on s.oid=p.pronamespace
--    where s.nspname='public' and p.prokind='f' and p.proname like 'nex\_%' and pg_get_functiondef(p.oid) like '%is_current_user_hub_admin%';
