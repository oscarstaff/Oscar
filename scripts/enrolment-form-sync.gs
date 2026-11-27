/* YatraLine · RPL Enrolment Google Form -> ticks "Enrolment form" in the student's Documents list
   Paste into the form's RESPONSE SHEET: Sheet > Extensions > Apps Script. Then:
   1. Project Settings > Script properties > add  INTAKE_KEY  (the same key the Self-placement form uses; it is NOT in this file).
      If setup() says it cannot find the form or its sheet, also add  FORM_ID  = the long id in the FORM's address
      (open the form to edit it; the id is between /d/ and /edit). A sheet id (SHEET_ID) works too.
   2. Run setup() once and allow access. It installs the "on form submit" trigger.
   3. (Optional) Run sendAllRows() to tick the form for everyone who submitted it in the last 90 days. Safe to run again: it carries on where it stopped and repeats are ignored.
   What happens: when the student submits the form, only their name, primary email, sign-in email and mobile number are sent to YatraLine
   (nothing else on the form leaves the sheet). They are matched by email, then mobile number, then exact full name (only when one student has that name).
   Their "Enrolment form" box is ticked on every enrolment they have. If they have no enrolment yet, it ticks the moment one is added.
   If nobody matches, nothing is ticked and the submission is kept in nex_enrolment_form_log with the reason. */

const SB_URL = 'https://jcfgldqrdbfkgbixszds.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZmdsZHFyZGJma2diaXhzemRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Nzc3NzEsImV4cCI6MjA5MDE1Mzc3MX0.Wj8cCpnlsoZOPj5sKWeEdfvgjG4Nc-UuTTYgbcrPfeI';   // public anon key, already in the app

/* The form's headings. In the response sheet the mobile number column is headed "Column 8"; on the form itself the question is "Mobile No". Both work. */
const MAP = {
  name:   /^full name$/i,
  email:  /^email \(please provide primary email/i,
  email2: /^email address$/i,
  phone:  /^(column 8|mobile( no\.?| number)?)$/i
};

function target_() {
  const p = PropertiesService.getScriptProperties(), sid = (p.getProperty('SHEET_ID') || '').trim(), fid = (p.getProperty('FORM_ID') || '').trim();
  if (sid) return { ss: SpreadsheetApp.openById(sid) };
  if (fid) return { form: FormApp.openById(fid) };
  let s = null; try { s = SpreadsheetApp.getActive(); } catch (e) {}
  if (s) return { ss: s };
  let f = null; try { f = FormApp.getActiveForm(); } catch (e) {}
  if (f) return { form: f };
  throw new Error('Cannot find the form or its sheet. Add a FORM_ID script property: the long id in the FORM\'s address, between /d/ and /edit (open the form to edit it).');
}

function setup() {
  const t = target_();
  ScriptApp.getProjectTriggers().forEach(x => { if (/^onFormSubmit/.test(x.getHandlerFunction())) ScriptApp.deleteTrigger(x); });
  if (t.ss) ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(t.ss).onFormSubmit().create();
  else ScriptApp.newTrigger('onFormSubmitForm').forForm(t.form).onFormSubmit().create();
  Logger.log('Trigger installed on the ' + (t.ss ? 'response sheet' : 'form') + '. Submit a test response to try it.');
}

/* Google's own services sometimes answer "We're sorry, a server error occurred. Please wait a bit and try again." Trying again a moment later almost always works,
   so every call that talks to Google or YatraLine goes through this: up to 4 tries, waiting 1, 2 and 4 seconds in between. Sending the same answer twice is safe (repeats are ignored). */
function retry_(fn) {
  let err;
  for (let i = 0; i < 4; i++) {
    try { return fn(); } catch (e) { err = e; if (i < 3) Utilities.sleep(1000 * Math.pow(2, i)); }
  }
  throw err;
}

function onFormSubmit(e) {   // sheet trigger
  const rows = retry_(() => {
    const sh = e.range.getSheet(), n = sh.getLastColumn();
    return [sh.getRange(1, 1, 1, n).getDisplayValues()[0], sh.getRange(e.range.getRow(), 1, 1, n).getDisplayValues()[0]];
  });
  sendRow_(rows[0], rows[1]);
}

function formRow_(resp) {   // a Form response as [headings, answers], the same shape as a sheet row
  const head = ['Timestamp'], row = [Utilities.formatDate(resp.getTimestamp(), Session.getScriptTimeZone(), 'd/M/yyyy HH:mm:ss')];
  const who = resp.getRespondentEmail && resp.getRespondentEmail(); if (who) { head.push('Email Address'); row.push(who); }
  resp.getItemResponses().forEach(ir => { const a = ir.getResponse(); head.push(ir.getItem().getTitle()); row.push(Array.isArray(a) ? a.join(', ') : String(a == null ? '' : a)); });
  return [head, row];
}

function onFormSubmitForm(e) {   // form trigger
  const hr = formRow_(e.response); sendRow_(hr[0], hr[1]);
}

/* Brings in answers that came in before the trigger was installed. Run it as often as it needs: it picks up where it stopped, never sends the same
   answer twice, and only looks at the last 90 days (set the script property BACKFILL_DAYS to change that, for example 30 or 365).
   It stops after about 4 minutes to stay inside Google's 6 minute limit; if the log says "run it again", run it again. */
function findSheet_(ss) {   // the tab whose first row has the "Full Name" and email headings (not always the first tab)
  const tabs = ss.getSheets();
  for (let i = 0; i < tabs.length; i++) {
    const w = Math.max(1, Math.min(tabs[i].getLastColumn(), 80));
    const head = tabs[i].getRange(1, 1, 1, w).getDisplayValues()[0].map(h => String(h || '').replace(/\s*\*\s*$/, '').trim());
    if (head.some(h => MAP.name.test(h)) && head.some(h => MAP.email.test(h) || MAP.email2.test(h))) return tabs[i];
  }
  return null;
}

function sendAllRows() {
  const t = target_(), started = Date.now(), props = PropertiesService.getScriptProperties();
  const n = { ticked: 0, other: 0, dup: 0, empty: 0 };
  const count = res => { if (res.result === 'ticked') n.ticked++; else if (res.result === 'duplicate') n.dup++; else if (res.result === 'empty') n.empty++; else n.other++; };
  const days = Number(props.getProperty('BACKFILL_DAYS')) || 90, cutoff = new Date(Date.now() - days * 864e5);
  if (t.form) {
    t.form.getResponses().filter(r => r.getTimestamp() >= cutoff).forEach(r => { const hr = formRow_(r); count(sendRow_(hr[0], hr[1])); });
    Logger.log('Ticked: ' + n.ticked + ' · not matched or no enrolment yet: ' + n.other + ' · already sent before: ' + n.dup + '.');
    return;
  }
  const sh = findSheet_(t.ss);
  if (!sh) throw new Error('Cannot find the tab with the form answers (a first row with "Full Name" and the email heading). Tabs: ' + t.ss.getSheets().map(x => x.getName()).join(', '));
  const last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2) { Logger.log('The tab "' + sh.getName() + '" has no answers.'); return; }
  const head = sh.getRange(1, 1, 1, width).getDisplayValues()[0];
  const stamps = sh.getRange(2, 1, last - 1, 1).getValues();
  let row = Math.max(2, Number(props.getProperty('SYNC_NEXT_ROW')) || 2), seen = 0;
  for (; row <= last; row++) {
    if (Date.now() - started > 240000) break;   // about 4 minutes
    const ts = stamps[row - 2][0];
    if (ts instanceof Date && ts < cutoff) continue;   // older than the window
    seen++;
    count(sendRow_(head, sh.getRange(row, 1, 1, width).getDisplayValues()[0]));
  }
  const finished = row > last;
  props.setProperty('SYNC_NEXT_ROW', finished ? '2' : String(row));
  Logger.log('Tab "' + sh.getName() + '" · answers sent this run: ' + seen + ' · ticked: ' + n.ticked + ' · not matched or no enrolment yet: ' + n.other + ' · already sent before: ' + n.dup + ' · rows with no name or email: ' + n.empty + '.' + (finished ? ' Done.' : ' Not finished: run it again.'));
}

function pick_(head, row, re) {
  for (let i = 0; i < head.length; i++) {
    const h = String(head[i] || '').replace(/\s*\*\s*$/, '').trim();   // a trailing * (required question) is ignored
    if (re.test(h) && String(row[i] || '').trim()) return String(row[i]).trim();
  }
  return '';
}

function sendRow_(head, row) {
  const key = PropertiesService.getScriptProperties().getProperty('INTAKE_KEY');
  if (!key) throw new Error('Add the INTAKE_KEY script property first (Project Settings > Script properties).');
  const f = {};
  Object.keys(MAP).forEach(k => f[k] = pick_(head, row, MAP[k]));
  if (!f.name && !f.email && !f.email2 && !f.phone) return { result: 'empty' };
  const dedupe = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, 'enrol|' + String(row[0] || '') + '|' + (f.email || f.email2 || f.name)));
  const res = retry_(() => {
    const r = UrlFetchApp.fetch(SB_URL + '/rest/v1/rpc/nex_enrolment_form_intake', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
      payload: JSON.stringify({ p_key: key, p_fields: f, p_dedupe: dedupe })
    });
    if (r.getResponseCode() >= 500) throw new Error('YatraLine said ' + r.getResponseCode());   // a busy moment on their side: try again
    return r;
  });
  if (res.getResponseCode() >= 300) throw new Error('YatraLine said ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText() || '{}');
}
