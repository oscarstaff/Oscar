-- security_06: role-scoped writes + anonymous cleanup
-- Run in the Supabase SQL editor (project jcfgldqrdbfkgbixszds), or ask Claude to apply it.
-- Safe to run once. Reads stay open to staff where the apps need them; writes move to the right role.

-- ── Quiz tables: only hub admins write; staff read only what they need ──
drop policy if exists qa_auth on public.quiz_access;
create policy qa_admin_all on public.quiz_access for all to authenticated
  using ((select public.is_current_user_hub_admin()))
  with check ((select public.is_current_user_hub_admin()));
create policy qa_read_own on public.quiz_access for select to authenticated
  using (lower(btrim(staff_name)) = lower(btrim((select public.current_staff_name()))));

drop policy if exists cq_auth on public.custom_quizzes;
create policy cq_admin_all on public.custom_quizzes for all to authenticated
  using ((select public.is_current_user_hub_admin()))
  with check ((select public.is_current_user_hub_admin()));
create policy cq_read_published on public.custom_quizzes for select to authenticated
  using (status = 'published');

drop policy if exists qo_auth on public.quiz_overrides;
create policy qo_admin_write on public.quiz_overrides for all to authenticated
  using ((select public.is_current_user_hub_admin()))
  with check ((select public.is_current_user_hub_admin()));
create policy qo_read on public.quiz_overrides for select to authenticated using (true);

-- ── ShiftOps-only tables: writes require ShiftOps access (hub admins included) ──
drop policy if exists "cd write" on public.class_days;
create policy cd_write_shiftops on public.class_days for all to authenticated
  using ((select public.has_app_access('shiftops')))
  with check ((select public.has_app_access('shiftops')));

drop policy if exists hk_pool_all on public.housekeeping_pool;
create policy hk_pool_read on public.housekeeping_pool for select to authenticated using (true);
create policy hk_pool_write on public.housekeeping_pool for all to authenticated
  using ((select public.has_app_access('shiftops')))
  with check ((select public.has_app_access('shiftops')));

drop policy if exists hk_roster_all on public.housekeeping_roster;
create policy hk_roster_read on public.housekeeping_roster for select to authenticated using (true);
create policy hk_roster_write on public.housekeeping_roster for all to authenticated
  using ((select public.has_app_access('shiftops')))
  with check ((select public.has_app_access('shiftops')));

drop policy if exists hkp_rw on public.housekeeping_published;
create policy hkp_read on public.housekeeping_published for select to authenticated using (true);
create policy hkp_write on public.housekeeping_published for all to authenticated
  using ((select public.has_app_access('shiftops')))
  with check ((select public.has_app_access('shiftops')));

-- ── app_settings: no anonymous read; writes need ShiftOps access / hub admin ──
drop policy if exists app_settings_anon_read on public.app_settings;
drop policy if exists app_settings_auth on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated using (true);
create policy app_settings_write on public.app_settings for all to authenticated
  using ((select public.has_app_access('shiftops')))
  with check ((select public.has_app_access('shiftops')));

-- ── health_ignores: admin-only writes ──
drop policy if exists "hi write" on public.health_ignores;
create policy hi_write_admin on public.health_ignores for all to authenticated
  using ((select public.is_current_user_hub_admin()))
  with check ((select public.is_current_user_hub_admin()));

-- ── nudge_log: server-only (the edge function uses the service role) ──
drop policy if exists "nl read" on public.nudge_log;

-- ── Trigger-only SECURITY DEFINER functions should not be callable as RPC ──
-- (Triggers still fire normally; EXECUTE is only checked when a trigger is created.)
revoke execute on function public.formcraft_fill_audit()        from public, anon, authenticated;
revoke execute on function public.formcraft_fill_stamp()        from public, anon, authenticated;
revoke execute on function public.formcraft_tpl_audit()         from public, anon, authenticated;
revoke execute on function public.roster_notice_dedupe()        from public, anon, authenticated;
revoke execute on function public.roster_published_notify()     from public, anon, authenticated;
revoke execute on function public.roster_shift_change_notify()  from public, anon, authenticated;
revoke execute on function public.slip_audit_row()              from public, anon, authenticated;

-- ── Rollback (if anything misbehaves) ──
-- create policy qa_auth on public.quiz_access for all to authenticated using (true) with check (true);
-- create policy cq_auth on public.custom_quizzes for all to authenticated using (true) with check (true);
-- create policy qo_auth on public.quiz_overrides for all to authenticated using (true) with check (true);
-- (and similar for the others; the original policies were all "authenticated, using (true)")
