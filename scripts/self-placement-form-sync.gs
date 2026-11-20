/* YatraLine · Self-placement Google Form -> Placement > Self-Requests
   Paste into the form's RESPONSE SHEET: Sheet > Extensions > Apps Script. Then:
   1. Project Settings > Script properties > add  INTAKE_KEY  (the key Sanny was given; it is NOT in this file).
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
const NOT_STUDENT = /facility|aged|care home|organi[sz]ation|supervisor|manager|coordinator|mentor|referee|employer|workplace|director|contact person|rn\b|nurse in charge/i;
const MAP = {
  name:     { is: /(^|\b)(full\s*)?name\b|student/i, not: NOT_STUDENT },
  email:    { is: /e-?mail/i, not: NOT_STUDENT },
  phone:    { is: /phone|mobile|contact number/i, not: NOT_STUDENT },
  facility: { is: /facility|aged care|care home|organi[sz]ation|workplace|place of placement/i, not: /address|email|phone|contact|supervisor|manager|date|start|end|suburb|state|postcode/i }
};

function setup() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(SpreadsheetApp.getActive()).onFormSubmit().create();
  Logger.log('Trigger installed. Submit a test response to try it.');
}

function onFormSubmit(e) {
  const sh = e.range.getSheet();
  sendRow_(sh, sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0], sh.getRange(e.range.getRow(), 1, 1, sh.getLastColumn()).getDisplayValues()[0]);
}

function sendAllRows() {
  const sh = SpreadsheetApp.getActiveSheet(), n = sh.getLastRow(); if (n < 2) return;
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0], rows = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getDisplayValues();
  let imported = 0, inbox = 0, dup = 0;
  rows.forEach(r => { const res = sendRow_(sh, head, r); if (res.result === 'imported') imported++; else if (res.result === 'inbox') inbox++; else dup++; });
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
