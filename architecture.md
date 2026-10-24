# Nexus architecture

Last updated: 24 Oct 2026

## Files and load order

Deploy all of these to the same folder (GitHub Pages root). Load order matters: every module shares one global scope and later files use functions defined earlier.

| Order | File | What it holds |
|---|---|---|
| 1 | index.html | Page shell, CSS, sign-in gate, small setup scripts, page router, early clock-in notice |
| 2 | nexus-core.js | Supabase client and auth, XSS escaping, forced and email password reset, session watchdog, week and fortnight helpers, sub-tabs, availability (weekly, one-off week, overview) |
| 3 | nexus-ui.js | Themes and UI customisation, admin availability grid, timesheet export, calendar (events, modal, quick-add parser, birthdays, day/week/year views), onboarding checklist, notifications and settings, staff directory |
| 4 | nexus-profile.js | Profile page: personality, perks, badge rows, nickname and avatar upload and crop, pronouns, profile birthday, search, PWA install prompt |
| 5 | nexus-clock.js | Clock in/out, 8pm forgot-clock-out auto-out, GPS geofence, testing flag |
| 6 | nexus-reports.js | Reports modal, full-page notifications, onboarding and spotlight walkthrough, profile prompt, birthday celebration, extra break requests, diary, My Reports page |
| 7 | nexus-team.js | Team report (multi-team helpers, metric manager, weekly team report, placement sections), per-row advanced tools, punch edit (admin) |
| 8 | nexus-hours.js | Hours summary, fortnight report, Sydney time helpers, work streak, earned glow, inline achievement badges, achievement feed, fortnight slideshow, bookmarks, email update |
| 9 | nexus-home.js | Roster and who's working, home widgets, needs-attention panel, what's new, shift pickup, my roster, published-week gate, settings, admin, mobile sidebar, top notification banner |
| 10 | nexus-notices.js | Shift-change notices (popup and bell), manager-side change notices, roster mini tools |
| 11 | dialtrac.js, quizreview.js, teamhours.js, availlock.js, hubradial.js, sessionlimit.js | Separate feature scripts (call log and contacts, quiz review, team hours, availability lock, hub radial menu, session limit) |

## Outside the browser

- **Supabase (Postgres, project jcfgldqrdbfkgbixszds):** the source of truth. Key tables: clock_log, staff_credentials, staff_settings, staff_directory, staff_names, leave_submissions, app_access, roster_shifts, roster_published, roster_change_notices, staff_availability, staff_roster_config, punctuality_history, contacts, call_log, app_settings, payroll_rates, clock_overrides, staff_team_history, clock_early_notices, placement_weekly, team_report_prefs, password_resets. Row-level security is on for every table.
- **ShiftOps (shiftops.html + its own modules):** the admin roster, employee and payroll app. It only opens from the Nodes page in Nexus, which passes a short-lived token.
- **Google Apps Script (timesheet sheet and mail relay):** nine .gs files, split into config, gate, admin, docs, email, timesheet and repair. Deploy with "Deploy → New version" after changes.

## Rules for updates

- Every update ships with this file, updated to match.
- Put new code in the module that matches its feature; keep module load order in the table above in step with index.html.
- Check that each changed file parses before delivery.

## Passwords (updated 24 Oct 2026)

- Sign-in, password change and admin resets all go through Supabase Auth. Passwords are never stored in our tables.
- The old client-side password hash is no longer written or checked. All 30 staff accounts are linked to Supabase Auth and have their legacy hash cleared.
- Security-question answers still use a SHA-256 hash with a fixed salt, defined in nexus-ui.js (`hash()`). Still to fix.
