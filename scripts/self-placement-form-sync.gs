/* YatraLine · Self-placement Google Form -> Placement > Self-Requests
   Paste into the form's RESPONSE SHEET: Sheet > Extensions > Apps Script. Then:
   1. Project Settings > Script properties > add  INTAKE_KEY  (the key Sanny was given; it is NOT in this file).
      If setup() says it cannot find the form or its sheet, also add  FORM_ID  = the long id in the FORM's address
      (open the form to edit it; the id is between /d/ and /edit). A sheet id (SHEET_ID) works too.
   2. Run setup() once and allow access. It installs the "on form submit" trigger.
   3. (Optional) Run sendAllRows() once to bring in answers that came in before today. Safe to run again: repeats are ignored.
   What happens: each response is sent to Supabase (nex_form_intake). If the email, phone or name matches a student with one
   enrolment, a "Not applied" self-request appears in Placement > Self-Requests. Anything else waits in the "Form responses"
   box at the top of that tab for staff to attach to a student.
   Only the student's own name, email and phone are used for matching. If the form has several email/phone/name questions
   (for example the aged care's email), edit the three patterns in MAP below so they point at the student's. */

const SB_URL = 'https://jcfgldqrdbfkgbixszds.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZmdsZHFyZGJma2diaXhzemRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Nzc3NzEsImV4cCI6MjA5MDE1Mzc3MX0.Wj8cCpnlsoZOPj5sKWeEdfvgjG4Nc-UuTTYgbcrPfeI';   // public anon key, already in the app

/* A question is "the student's" when its heading matches `is` and does not match `not`. The first match wins. */
const NOT_STUDENT = /facility|aged|care home|organi[sz]ation|supervisor|manager|coordinator|mentor|referee|referral|employer|workplace|director|contact person|rn\b|nurse in charge|approval|emailed/i;
const MAP = {
  name:     { is: /^(your\s+)?(full\s+)?name$|student name/i, not: NOT_STUDENT },
  email:    { is: /^(your\s+|student\s+)?e-?mail( address)?$/i, not: NOT_STUDENT },
  phone:    { is: /^(your\s+|student\s+)?(phone|mobile|contact)( number| no\.?)?$/i, not: NOT_STUDENT },
  facility: { is: /^facility name$|^name of (the )?(facility|aged care)|^aged care( name)?$|^(organi[sz]ation|workplace) name$/i, not: /address|email|phone|contact|supervisor|manager|date|start|end|suburb|state|postcode/i }
};

/* Finds what to listen to: the response sheet (SHEET_ID property, or the sheet this script is attached to) or, failing that,
   the form itself (FORM_ID property, or the form this script is attached to). Either one works. */
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

function onFormSubmit(e) {   // sheet trigger
  const sh = e.range.getSheet();
  sendRow_(sh, sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0], sh.getRange(e.range.getRow(), 1, 1, sh.getLastColumn()).getDisplayValues()[0]);
}

function formRow_(resp) {   // a Form response as [headings, answers], the same shape as a sheet row
  const head = ['Timestamp'], row = [Utilities.formatDate(resp.getTimestamp(), Session.getScriptTimeZone(), 'd/M/yyyy HH:mm:ss')];
  const who = resp.getRespondentEmail && resp.getRespondentEmail(); if (who) { head.push('Email Address'); row.push(who); }   // only when the form is set to collect email addresses
  resp.getItemResponses().forEach(ir => { const a = ir.getResponse(); head.push(ir.getItem().getTitle()); row.push(Array.isArray(a) ? a.join(', ') : String(a == null ? '' : a)); });
  return [head, row];
}

function onFormSubmitForm(e) {   // form trigger
  const hr = formRow_(e.response); sendRow_(null, hr[0], hr[1]);
}

function sendAllRows() {
  const t = target_(); let imported = 0, inbox = 0, dup = 0;
  const count = res => { if (res.result === 'imported') imported++; else if (res.result === 'inbox') inbox++; else dup++; };
  if (t.form) t.form.getResponses().forEach(r => { const hr = formRow_(r); count(sendRow_(null, hr[0], hr[1])); });
  else {
    const sh = t.ss.getSheets()[0], n = sh.getLastRow(); if (n < 2) return;   // the form's answers are the first tab
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0], rows = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getDisplayValues();
    rows.forEach(r => count(sendRow_(sh, head, r)));
  }
  Logger.log('Sent: ' + imported + ' added as requests, ' + inbox + ' waiting for a student, ' + dup + ' already there.');
}

function pick_(head, row, rule, used) {
  for (let i = 0; i < head.length; i++) {
    const h = String(head[i] || '');
    if (used[i] || /^timestamp$/i.test(h) || !String(row[i] || '').trim()) continue;
    if (rule.is.test(h) && !(rule.not && rule.not.test(h))) { used[i] = true; return String(row[i]).trim(); }
  }
  return '';
}

function sendRow_(sh, head, row) {
  const key = PropertiesService.getScriptProperties().getProperty('INTAKE_KEY');
  if (!key) throw new Error('Add the INTAKE_KEY script property first (Project Settings > Script properties).');
  const used = {}, f = {};
  ['name', 'email', 'phone'].forEach(k => f[k] = pick_(head, row, MAP[k], used));
  const facIdx = {}; f.facility = pick_(head, row, MAP.facility, facIdx);
  const answers = {}, lines = [];
  head.forEach((h, i) => {
    const v = String(row[i] || '').trim(); if (!h || !v || /^timestamp$/i.test(h)) return;
    answers[h] = v;
    if (!used[i]) lines.push(h + ': ' + v);   // the student's own name, email and phone are already on the student, so they stay out of the note
  });
  f.details = lines.join('\n');
  const stamp = String(row[0] || '');
  const dedupe = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, stamp + '|' + (f.email || f.name || '') + '|' + (f.facility || '')));
  const res = UrlFetchApp.fetch(SB_URL + '/rest/v1/rpc/nex_form_intake', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
    payload: JSON.stringify({ p_key: key, p_fields: f, p_answers: answers, p_dedupe: dedupe })
  });
  if (res.getResponseCode() >= 300) throw new Error('YatraLine said ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText() || '{}');
}
