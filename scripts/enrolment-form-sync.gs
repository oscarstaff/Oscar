/* YatraLine · RPL Enrolment Google Form -> ticks "Enrolment form" in the student's Documents list
   Paste into the form's RESPONSE SHEET: Sheet > Extensions > Apps Script. Then:
   1. Project Settings > Script properties > add  INTAKE_KEY  (the same key the Self-placement form uses; it is NOT in this file).
      If setup() says it cannot find the form or its sheet, also add  FORM_ID  = the long id in the FORM's address
      (open the form to edit it; the id is between /d/ and /edit). A sheet id (SHEET_ID) works too.
   2. Run setup() once and allow access. It installs the "on form submit" trigger.
   3. (Optional) Run sendAllRows() once to tick the form for everyone who already submitted it. Safe to run again: repeats are ignored.
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

function onFormSubmit(e) {   // sheet trigger
  const sh = e.range.getSheet();
  sendRow_(sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0], sh.getRange(e.range.getRow(), 1, 1, sh.getLastColumn()).getDisplayValues()[0]);
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

function sendAllRows() {
  const t = target_(); const n = { ticked: 0, other: 0, dup: 0 };
  const count = res => { if (res.result === 'ticked') n.ticked++; else if (res.result === 'duplicate') n.dup++; else n.other++; };
  if (t.form) t.form.getResponses().forEach(r => { const hr = formRow_(r); count(sendRow_(hr[0], hr[1])); });
  else {
    const sh = t.ss.getSheets()[0], last = sh.getLastRow(); if (last < 2) return;   // the form's answers are the first tab
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0], rows = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getDisplayValues();
    rows.forEach(r => count(sendRow_(head, r)));
  }
  Logger.log('Ticked: ' + n.ticked + ' · not matched or already ticked: ' + n.other + ' · already sent before: ' + n.dup + '. Details for the unmatched are in YatraLine (nex_enrolment_form_log).');
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
  const res = UrlFetchApp.fetch(SB_URL + '/rest/v1/rpc/nex_enrolment_form_intake', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
    payload: JSON.stringify({ p_key: key, p_fields: f, p_dedupe: dedupe })
  });
  if (res.getResponseCode() >= 300) throw new Error('YatraLine said ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText() || '{}');
}
