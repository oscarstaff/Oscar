/**
 * YatraLine placement mail relay (Google Apps Script, sends through the Gmail API)
 *
 * Sends the "documents required before placement" email from WHICHEVER Google account deploys this script.
 * Deploy it while signed in as the placement mailbox, not the enrolment one.
 * It uses the Gmail API (the Gmail advanced service), not GmailApp: the email is a full MIME message with the
 * text and HTML versions and any attachments, it lands in the mailbox's Sent folder, and replies come back to that mailbox.
 *
 * Setup (once)
 *  1. Signed in as the placement mailbox: script.google.com > New project > paste this file > Save.
 *  2. Optional: turn on the Gmail API: in the left sidebar next to Services press +, choose "Gmail API", Add (leave the name as Gmail).
 *     If it is on, the Gmail API sends the email; if it is not, the script falls back to GmailApp. Either way the email is the same.
 *  3. Project Settings > Script properties > add
 *       MAIL_KEY            a long random string (this is the password YatraLine uses; make one up)
 *       ATTACHMENT_IDS      optional, and usually not needed: the help guide is uploaded in YatraLine > Admin and sent along by the app.
 *                           Only use this for extra files kept in Drive (comma separated Drive file IDs the mailbox can open).
 *  4. Pick the function  testSend  in the toolbar and press Run. Allow the permissions (it asks to send email as you).
 *     It emails the mailbox itself, so you can see the real email. (If you set ATTACHMENT_IDS it also asks to read Drive.)
 *  5. Deploy > New deployment > type Web app > Execute as: Me > Who has access: Anyone > Deploy.
 *  6. Copy the Web app URL. In Supabase (Edge Functions > Secrets) set
 *       NEX_MAIL2_URL = that URL
 *       NEX_MAIL2_KEY = the same MAIL_KEY
 *  7. After any change to this script: Deploy > Manage deployments > edit > New version > Deploy (the URL stays the same).
 *
 * Security: every request must carry the key. The recipient list is whatever YatraLine sends, and YatraLine only ever sends to
 * the email on the student's booking or record. Nothing else is read or stored here.
 */
var EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/;

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var key = props.getProperty('MAIL_KEY') || '';
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!key || key.length < 16) return out_({ ok: false, error: 'MAIL_KEY is not set (use at least 16 characters)' });
    if (!safeEqual_(String(body.key || ''), key)) return out_({ ok: false, error: 'bad key' });
    /* "how many emails can this mailbox still send today?" (free Gmail: about 100 recipients a day) */
    if (body.action === 'quota') return out_({ ok: true, remaining: quotaLeft_() });

    var to = String(body.to || '').trim();
    if (!EMAIL_RE.test(to)) return out_({ ok: false, error: 'invalid recipient' });
    var subject = String(body.subject || '').replace(/[\r\n]+/g, ' ').slice(0, 200);
    var text = String(body.text || '').slice(0, 20000);
    if (!subject || !text) return out_({ ok: false, error: 'subject and text are required' });
    if (quotaLeft_() === 0) return out_({ ok: false, error: 'daily_limit', remaining: 0 });

    sendViaGmailApi_(to, subject, text, body.html ? String(body.html).slice(0, 60000) : '', String(body.fromName || 'Oscars Training Centre').slice(0, 80), sentFiles_(body.attachments));
    return out_({ ok: true, remaining: quotaLeft_() });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err).slice(0, 200) });
  }
}

/* Files the app sends along ({name, type, data: base64}). At most 5, each a plain file name and a base64 string. */
function sentFiles_(list) {
  if (!list || !list.length) return [];
  if (list.length > 5) throw new Error('too many attachments');
  return list.map(function (a) {
    var name = String(a && a.name || 'attachment').replace(/[\r\n"\\\/]+/g, '_').slice(0, 120);
    var type = /^[\w.+-]+\/[\w.+-]+$/.test(String(a && a.type || '')) ? String(a.type) : 'application/octet-stream';
    if (!a || typeof a.data !== 'string' || !a.data) throw new Error('empty attachment ' + name);
    return Utilities.newBlob(Utilities.base64Decode(a.data), type, name);
  });
}

/* Run this once from the editor (step 4). No trailing underscore on purpose: Apps Script hides those names from the Run menu.
   It grants the permissions and sends a real copy to the mailbox itself. */
function testSend() {
  Logger.log('Emails this mailbox can still send today: ' + quotaLeft_());
  var me = Session.getEffectiveUser().getEmail();
  sendViaGmailApi_(me, 'YatraLine test: documents required before your placement',
    'Dear Student,\n\nThis is a test of the placement mail relay. If you can read this, it works.\n\nThank you.',
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">Dear Student,<br><br>This is a test of the placement mail relay. If you can read this, it works.<br><br>Thank you.</div>',
    'Oscars Training Centre Placement Team');
}

/* Builds the message by hand (headers, text, HTML, attachments) and sends it with the Gmail API as the signed-in mailbox. */
function sendViaGmailApi_(to, subject, text, html, fromName, extraFiles) {
  var me = Session.getEffectiveUser().getEmail();
  var props = PropertiesService.getScriptProperties();
  var ids = String(props.getProperty('ATTACHMENT_IDS') || '').split(',').map(function (s) { return s.trim(); }).filter(String);
  var files = (extraFiles || []).concat(ids.map(function (id) { return DriveApp.getFileById(id).getBlob(); }));
  /* Gmail API when the Gmail service is switched on in this project (and the deployment is on a version that has it);
     otherwise Google's built-in sender, which needs no setup. Same mailbox, same email either way. */
  if (typeof Gmail !== 'undefined' && Gmail.Users && Gmail.Users.Messages) {
    Gmail.Users.Messages.send({ raw: buildMime_(me, to, subject, text, html, fromName, files) }, 'me');
    return;
  }
  var opts = { name: String(fromName || '').replace(/[\r\n"<>]+/g, ' ').trim() };
  if (html) opts.htmlBody = html;
  if (files.length) opts.attachments = files;
  GmailApp.sendEmail(to, subject, text, opts);
}

function buildMime_(from, to, subject, text, html, fromName, files) {
  var uid = Utilities.getUuid().replace(/-/g, '');
  var outer = 'mix_' + uid, inner = 'alt_' + uid;
  var name = String(fromName || '').replace(/[\r\n"<>]+/g, ' ').trim();
  var L = [];
  L.push('From: ' + (name ? word_(name) + ' <' + from + '>' : from));
  L.push('To: ' + to);
  L.push('Subject: ' + word_(subject));
  L.push('MIME-Version: 1.0');
  L.push('Content-Type: multipart/mixed; boundary="' + outer + '"');
  L.push('');
  L.push('--' + outer);
  L.push('Content-Type: multipart/alternative; boundary="' + inner + '"');
  L.push('');
  L.push('--' + inner);
  L.push('Content-Type: text/plain; charset="UTF-8"');
  L.push('Content-Transfer-Encoding: base64');
  L.push('');
  L.push(wrap_(Utilities.base64Encode(Utilities.newBlob(text).getBytes())));
  if (html) {
    L.push('--' + inner);
    L.push('Content-Type: text/html; charset="UTF-8"');
    L.push('Content-Transfer-Encoding: base64');
    L.push('');
    L.push(wrap_(Utilities.base64Encode(Utilities.newBlob(html).getBytes())));
  }
  L.push('--' + inner + '--');
  (files || []).forEach(function (f) {
    var fn = String(f.getName() || 'attachment').replace(/["\r\n]+/g, '');
    var ct = f.getContentType() || 'application/octet-stream';
    L.push('--' + outer);
    L.push('Content-Type: ' + ct + '; name="' + word_(fn) + '"');
    L.push('Content-Disposition: attachment; filename="' + word_(fn) + '"');
    L.push('Content-Transfer-Encoding: base64');
    L.push('');
    L.push(wrap_(Utilities.base64Encode(f.getBytes())));
  });
  L.push('--' + outer + '--');
  L.push('');
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(L.join('\r\n')).getBytes());
}

/* header words with anything outside plain ASCII are encoded so names and subjects with accents survive */
function word_(s) { return /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Utilities.base64Encode(Utilities.newBlob(s).getBytes()) + '?='; }
function wrap_(b64) { return b64.replace(/(.{76})/g, '$1\r\n'); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function safeEqual_(a, b) { if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

/* Emails this mailbox can still send today, or null when Google has not been given the permission yet (sending still works then). */
function quotaLeft_() {
  try { return MailApp.getRemainingDailyQuota(); } catch (err) { return null; }
}
