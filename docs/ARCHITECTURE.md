# Yatra architecture

Last updated: 25 Nov 2026. Yatra is the student tracker for Oscars Training Centre (leads, students, enrolments, payments, classes, placement). It is one web page, `nex.html`, plus plain JavaScript files in `pipeline/`, talking straight to Supabase (project `jcfgldqrdbfkgbixszds`). There is no build step and no server of our own.

**Keep this file current.** If a change adds a file, a table or a column, or changes a rule below, update this file in the same PR.

## 1. How the app loads

- `index.html` is the hub. Its Yatra card opens `nex.html?v=N`. **Bump N on every change** to anything Yatra loads; it is the cache-buster for every file.
- `nex.html` holds the page shell, CSS and a small loader. The loader reads `PL_FILES` (around line 1526) and loads `pipeline/<name>.js` one after another.
- All the `pl-*.js` files share **one global scope**, so order matters: `pl-core` first, `pl-start` last. Adding a file = create it and add its name to `PL_FILES`.
- The page has a Content-Security-Policy that lists the loader script by its sha256. If you edit the loader, `node scripts/check.mjs` prints the new hash.
- `scripts/check.mjs` runs on every PR (`.github/workflows/check.yml`). It checks for merge-conflict markers, that every script parses, the CSP hash, that `pl-core` is first and `pl-start` last, and that the loader list matches the files on disk.

## 2. File map (`pipeline/`)

In load order.

| File | What it does |
|---|---|
| `pl-core` | Constants, team rules (`canPay()` and friends), helpers, sign-in, `api()`, the journaled writes `ins / upd / del` that feed Undo, the view-only lock |
| `pl-ui` | Reference lists, status pill, toast / modal / `formModal` / `fieldHtml` / `readFields`, student picker, existing-person lookup |
| `pl-router` | Hash router, tabs, press feedback, `boot()` |
| `pl-students` | Overview, Leads / Students / Search lists, the student record (tabs including Money) |
| `pl-payments` | Payments list, payment queue, Edit payment |
| `pl-firstaid` | First Aid and CPR class days and the seat map |
| `pl-placement` | Placement requests, placements, facilities, blacklist |
| `pl-map` | Map of aged care facilities |
| `pl-batches` | Placement batches: a batch is a start date, each aged care is a card with AM / PM / Night quotas, students are placed on a card with a shift. Cards take the operator's `brand_color` |
| `pl-readyq` | Placement Ready list, On hold list, each student's placement profile |
| `pl-tasks` | Task Manager |
| `pl-admin` | Admin tab: status lists, qualifications, agents, audit |
| `pl-staff` | Who am I as staff (`loadMe`, team) |
| `pl-quizzes` | Quizzes: taking them, and admin Manage (access, results, retakes, CSV report, edit questions, publish, delete) plus the quiz builder (manual or AI via the generate-quiz edge function). "Make quiz" is on Documents |
| `pl-profile` | Documents (admins upload and delete; files live in private Google Drive via the Apps Script web app, so the CSP allows `script.google.com`), Profile, Team achievements, Staff profile view |
| `pl-teamreport` | Team report |
| `pl-faq` | Pip FAQ questions and help panel |
| `pl-convreport` | Conversion report |
| `pl-calls` | Call Log (copied from Nexus) |
| `pl-logbooks` | Logbook receipts |
| `pl-classes` | Class attendance, booking a lead into a class, no-show follow-ups |
| `pl-pip` | Pip, the pixel Tibetan mastiff |
| `pl-motion` | Sliding tabs and page arrivals |
| `pl-security` | Two-step login check and the Admin security card |
| `pl-live` | Live updates (listens to `nex_live_ping`) |
| `pl-start` | Starts the app once every route is registered. Always last |

`theme.js` is separate (colours and theme).

Other things in the repo:
- `scripts/edge/` : Supabase edge functions that send email (`nex-send-welcome`, `nex-send-followup`, `nex-send-class-confirm`, `nex-send-placement-docs`, plus the email templates). Emails are plain HTML, not designed, never text-only, with the key parts highlighted.
- `scripts/*.gs` : Google Apps Script files (mail relays and the form-sync scripts for the enrolment and self-placement forms). These are pasted into Apps Script by hand and redeployed; merging a PR does not update them.
- `scripts/sql/` : SQL kept for reference.
- `scripts/test-clock.mjs` : date-logic test.

## 3. Database (Supabase)

Everything the app uses is a `nex_` table, reached through PostgREST with the staff member's own login. Row-level security and triggers decide what each team can change.

### How the main tables link

```
nex_students ─┬─< nex_enrolments ─┬─< nex_payments ──< nex_payment_queue
              │    (one per       ├─< nex_refunds
              │     course)       ├─< nex_class_bookings >─ nex_class_sessions
              │                   ├─< nex_followups
              │                   ├─< nex_enrolment_docs >─ nex_doc_types
              │                   ├─< nex_placement_requests >─ nex_facilities
              │                   └─< nex_placements >─ nex_batches / nex_batch_facilities / nex_facilities
              ├─< nex_payments        (student_id as well as enrolment_id)
              ├─< nex_student_details, nex_student_notes
              └─< nex_class_bookings, nex_followups
nex_enrolments >─ nex_qualifications, nex_agents
```

A student can have several enrolments. A payment belongs to an enrolment (and also carries the student). One shared bank payment for two students is two rows, one per student.

### Other tables worth knowing

- History and logs: `nex_audit` (every change, written by trigger), `nex_status_history`, `nex_email_log`, `nex_view_log`, `nex_enrolment_form_log`, `nex_enrolment_merge_log` (rows hidden by the 19 Nov 2026 duplicate-enrolment merge, kept so it can be undone).
- Settings and lists: `nex_config` (includes the `view_only` switch), `nex_status_options`, `nex_qualifications`, `nex_agents`, `nex_trainers`, `nex_doc_types`, `app_access`, `staff_settings`.
- Placement: `nex_facilities` (37 rows, `brand_color` is the operator's colour as `#rrggbb`, NULL = default colour), `nex_batches`, `nex_batch_facilities`, `nex_placements`, `nex_placement_requests`, `nex_placement_profile`, `nex_blacklist`.
- Email queues: `nex_welcome_mail`, `nex_class_confirm_mail`, `nex_placement_doc_mail`, `nex_mail_attachments`.
- Forms: `formcraft_fills`, `nex_form_responses`, `nex_intake_keys`, `nex_name_keys` (used to spot the same person arriving twice).
- Other: `nex_tasks`, `nex_lead_followup`, `nex_live_ping`, `nex_logbook_receipts`, `nex_learnforge_*` (LearnForge link and sync), `nex_student_paid` (per-student paid total).

Row counts on 25 Nov 2026 (approximate): students 13.5k, enrolments 12.5k, payments 14.8k, payment queue 5.5k, class bookings 5.3k, followups 15.8k, audit 39k.

## 4. Payments

### `nex_payments`

`id, enrolment_id, student_id, payer_name, amount (required), paid_on, method, reference, note, created_by, created_at, updated_at`, plus `verify_status` (default `confirmed`), `verified_by/at/note` and `handover_status/by/at/note`.

Methods in the app: Bank transfer, Cash, Card, Agent, Other.

Triggers on the table:
- `nex_pay_guard`: only the Processing and Accounts teams may change payments.
- `nex_pay_status`: for normal staff, a bank payment starts as `pending_verification` and cash as awaiting handover. The service role and the SQL editor are trusted and skip this.
- `nex_guard`, `a_view_only`: the view-only lock.
- `t_audit`, `t_live_ping`, `t_paid_payment`, `t_touch`: audit row, live update, student paid total, timestamps.

### Rules that must not be broken

- **Amounts come from the payment processing sheet.** Always check an amount against it before changing it.
- The First Aid sheet is matched by emails and names only, never by amount.
- **Same name does not mean same person.** Match on email first.
- Nothing is deleted or overwritten silently. Changes through the app go through `ins / upd / del` so Undo works.

### Tagging imports

Every imported row sets `created_by` to a label such as `Import 24 Nov 2026 (2025 payments)`, so a whole import can be found and reversed with one query. Do the same for every future import.

### Standard import template

`Yatra_import_template.xlsx` (tabs: How to fill, Payments, Students, Lists). Payments columns: payment date, student first name, student last name, **student email (the key)**, student phone, amount, method (dropdown), name on the payment, bank reference / receipt no., course (dropdown), note, and a Check column.

Rules for the data:
- One row per payment. A payment shared by two students is one row per student.
- No status words in the amount or date columns.
- If the payer is unknown, leave the email empty and put the name in "Name on the payment".
- Dates are real dates, not text, and not in the future.

Matching rule for an import: **email + date + amount (+ reference)**. A row that matches an existing payment is skipped as a duplicate. Rows with no email match are listed for a person to decide, never guessed.

Status: the template exists. The importer that reads it (preview, then confirm, with Undo) is **not built yet**.

## 5. Permissions, Undo and the lock

- Teams: Enrolment, Processing, Placement, Evershine, Accounts, Education, plus admin. Team checks live in `pl-core` (`canPay()` = admin, Processing or Accounts may change a payment; anyone may add one; `canVerify()` = admin or Accounts check bank payments against the statement; `canFlag()` = admin or Evershine for class flags). The database enforces the same rules with triggers, so hiding a button is never the only protection.
- Undo: writes made through `ins / upd / del` are journaled and the toast offers Undo. **Emails are the one thing Undo cannot take back.**
- View-only: when `nex_config.view_only` is on, everyone except admins can look but not change anything.
- Two-step login is in `pl-security`.

## 6. How we work on it

- Branch from `main`, one change per branch, open a PR. The owner merges. Never force-push.
- Run `node scripts/check.mjs` before pushing.
- Bump the hub card `nex.html?v=N` in `index.html` whenever Yatra code changes.
- Verify in the database after any data change, not just in the screen.
- Keep student personal details out of screenshots and documents, including this one.

## 7. Known gaps

- Importer for the standard template is not built.
- Scalabrini and Ashfield Baptist Homes have no `brand_color` yet.
- Payment edits made in the app are not yet checked against the processing sheet automatically.
