-- security_07: close the anonymous read on app_access
-- RUN THIS ONLY AFTER the patched shiftops.html, formcraft.html, slip.html and dialtrac.html
-- are live on GitHub Pages (hard-refresh to confirm). The old gates read app_access with the
-- public key; the new gates verify through the signed-in session instead.
-- Nexus (index.html) reads app_access with the signed-in session, so it is unaffected.

drop policy if exists app_access_anon_read on public.app_access;
revoke select on public.app_access from anon;

-- ── Rollback ──
-- create policy app_access_anon_read on public.app_access for select to anon using (true);
-- grant select on public.app_access to anon;
