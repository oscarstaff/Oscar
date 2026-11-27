# ShiftOps code map

`shiftops.html` holds the page markup. Its styles and scripts live here and load in this exact order
(order matters: later files rely on functions from earlier ones, and the last file runs the start-up code).
Bump the `?v=` number on a file's tag in `shiftops.html` when you change it, so browsers fetch the new copy.

## CSS (`css/`)
| File | What it is |
|---|---|
| 01-base.css | Main styles, themes, layout |
| 02-polish.css | Polish pass (July 2026) |
| 03-v2.css | ShiftOps v2 restyle |
| 04-early.css | Early clock-in notices |
| 05-apple-layer.css | Apple-style materials and motion layer |

## JavaScript (`js/`)
| File | What it holds |
|---|---|
| 01-shim-config.js | Browser shim for storage, Supabase and Apps Script config, signed-in profile chip |
| 02-state-helpers.js | Default state, saving and loading, Nexus sync, helpers, stats |
| 03-roster.js | The roster grid and publishing state |
| 04-availability.js | Availability grid (cycle, custom hours, per-person edit) |
| 05-class-days.js | Class days, housekeeping roster, task allocation |
| 06-availability-pdf-edit.js | Availability PDF download and edit gate |
| 07-staff-list-role-view-modals.js | Staff list, role view, modals |
| 08-employee-profile-staff-form.js | Onboarding panel, employee profile (incl. Availability tab), add/edit staff, access and admin |
| 09-auto-allocate-export.js | Auto-allocate shifts, PDF export |
| 10-nav-wellbeing-health.js | Tabs and navigation, Wellbeing log (admin), System health |
| 11-team-lead-devices.js | Team lead read-only mode, devices |
| 12-leave.js | Leave requests |
| 13-password-sync-auth.js | Password management, Supabase sync, sign-in token handling |
| 14-init-conflict-radar-morning-board.js | Publish roster, start-up, conflict radar, morning board |

Small start-up snippets and the early clock-in script (`so-early-js`) stay inline in `shiftops.html`.
