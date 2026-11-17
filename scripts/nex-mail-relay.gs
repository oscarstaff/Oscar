/**
 * Nex mail relay (Google Apps Script) - sends through the Gmail API
 * Mail goes out from the Gmail account that owns this script, appears in its Sent folder,
 * and replies go to the staff member who clicked Send (Reply-To).
 *
 * SETUP (one time)
 * 1. Go to script.google.com, signed in as the workspace account that should be the sender
 *    (for example the shared enrolment mailbox). New project, name it "Nex mail".
 * 2. Paste this whole file over the default Code.gs.
 * 3. Add the Gmail API: left sidebar, Services (+), choose "Gmail API", Add.
 *    (If you skip this, the script falls back to GmailApp, which also works and also uses Gmail.)
 * 4. Project Settings (gear) > Script properties > Add script property:
 *      NEX_MAIL_KEY = a long random secret (30+ characters). Keep a copy for step 7.
 *    Optional: NEX_MAIL_FROM = a verified "Send mail as" alias of this account, for example
 *      enrolments@yourdomain.com. Leave it out to send from the account itself.
 * 5. Deploy > New deployment > type "Web app".
 *      Execute as: Me      Who has access: Anyone
 *    Click Deploy and approve the permission prompt (it asks to send email on your behalf).
 * 6. Copy the Web app URL (ends in /exec).
 * 7. In Supabase > Edge Functions > Secrets add:
 *      NEX_MAIL_URL = the /exec URL        NEX_MAIL_KEY = the same secret as step 4
 *
 * Changing this file later: Deploy > Manage deployments > edit > New version (the URL stays the same).
 * Use "testSend" from the editor once to check it works before wiring anything else.
 *
 * Notes
 * - "Anyone" only means the URL can be reached; nothing is sent unless the key matches.
 * - Daily limits are Google's (see the Apps Script quotas page; a free account gets far fewer than Workspace).
 *   The script reports how many sends are left today and refuses to send at 0.
 */

var EMAIL_RE_ = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/;

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('NEX_MAIL_KEY');
    if (!secret) return out_({ ok: false, error: 'NEX_MAIL_KEY is not set in Script properties' });

    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!p.key || !safeEq_(String(p.key), String(secret))) return out_({ ok: false, error: 'Wrong key' });

    /* how many emails can this mailbox still send today? (YatraLine shows it and refuses to send at 0) */
    if (p.action === 'quota') return out_({ ok: true, remaining: quotaLeft_() });

    var to = String(p.to || '').trim();
    if (!EMAIL_RE_.test(to)) return out_({ ok: false, error: 'Invalid recipient' });
    var subject = String(p.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
    var text = String(p.text || '').replace(/\r\n/g, '\n').slice(0, 8000);
    if (!subject || !text) return out_({ ok: false, error: 'Subject and text are required' });
    if (quotaLeft_() === 0) return out_({ ok: false, error: 'daily_limit', remaining: 0 });

    var reply = String(p.replyTo || '').trim();
    var fromName = String(p.fromName || 'Oscars Training Centre').replace(/[\r\n"<>]+/g, ' ').trim().slice(0, 80);
    var alias = String(props.getProperty('NEX_MAIL_FROM') || '').trim();

    send_({ to: to, subject: subject, text: text, replyTo: EMAIL_RE_.test(reply) ? reply : '', fromName: fromName, fromAddr: EMAIL_RE_.test(alias) ? alias : '' });
    return out_({ ok: true, remaining: quotaLeft_() });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message ? err.message : err).slice(0, 200) });
  }
}

// Send through the Gmail API (advanced service) when it is added, otherwise GmailApp.
// The email goes out as plain text plus an HTML copy. Gmail hard-wraps plain text at about 70
// characters, which looks narrow on a wide screen; the HTML copy flows to the full width.
function send_(m) {
  var html = toHtml_(m.text);
  if (typeof Gmail !== 'undefined' && Gmail.Users && Gmail.Users.Messages) {
    var from = m.fromAddr || Session.getEffectiveUser().getEmail();
    var bd = 'nex_' + Utilities.getUuid().replace(/-/g, '');
    var part = function (type, body) {
      return ['--' + bd, 'Content-Type: ' + type + '; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap_(Utilities.base64Encode(Utilities.newBlob(body).getBytes()))].join('\r\n');
    };
    var lines = [
      'From: ' + encWord_(m.fromName) + ' <' + from + '>',
      'To: ' + m.to,
      m.replyTo ? 'Reply-To: ' + m.replyTo : null,
      'Subject: ' + encWord_(m.subject),
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="' + bd + '"',
      '',
      part('text/plain', m.text),
      part('text/html', html),
      '--' + bd + '--'
    ].filter(function (l) { return l !== null; });
    var raw = Utilities.base64EncodeWebSafe(Utilities.newBlob(lines.join('\r\n')).getBytes());
    Gmail.Users.Messages.send({ raw: raw }, 'me');
    return;
  }
  var o = { name: m.fromName, htmlBody: html };
  if (m.replyTo) o.replyTo = m.replyTo;
  if (m.fromAddr) o.from = m.fromAddr;
  GmailApp.sendEmail(m.to, m.subject, m.text, o);
}

// Plain text from Nex -> simple HTML: blank line = new paragraph, "* " lines = bullet list.
function toHtml_(text) {
  var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var out = text.split(/\n{2,}/).map(function (blk) {
    var ls = blk.split('\n');
    if (ls.every(function (l) { return /^\* /.test(l); })) {
      return '<ul style="margin:0 0 14px 20px;padding:0">' + ls.map(function (l) { return '<li style="margin:0 0 6px">' + esc(l.slice(2)) + '</li>'; }).join('') + '</ul>';
    }
    return '<p style="margin:0 0 14px">' + ls.map(esc).join('<br>') + '</p>';
  }).join('');
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">' + out + '</div>';
}

// RFC 2047 encoded-word so accents, dashes and the like survive in names and subjects
function encWord_(s) {
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  return '=?UTF-8?B?' + Utilities.base64Encode(Utilities.newBlob(s).getBytes()) + '?=';
}
function wrap_(b64) { return b64.replace(/(.{76})/g, '$1\r\n'); }

// Opening the URL in a browser just says it is alive.
function doGet() { return out_({ ok: true, service: 'nex-mail', via: (typeof Gmail !== 'undefined') ? 'gmail-api' : 'gmailapp' }); }

// Run this once from the editor: sends a test email to yourself.
function testSend() {
  var me = Session.getEffectiveUser().getEmail();
  Logger.log('Emails this mailbox can still send today: ' + quotaLeft_());
  send_({ to: me, subject: 'Nex mail test', text: 'If you can read this, Nex can send email.\n\nAccents and dashes: café – ok', replyTo: '', fromName: 'Oscars Training Centre', fromAddr: '' });
  Logger.log('Sent a test to ' + me);
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// constant-time compare
function safeEq_(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* Emails this mailbox can still send today, or null when Google has not been given the permission yet (sending still works then). */
function quotaLeft_() {
  try { return MailApp.getRemainingDailyQuota(); } catch (err) { return null; }
}
