/**
 * YatraLine placement mail relay (Google Apps Script)
 *
 * Sends the "documents required before placement" email from WHICHEVER Google account deploys this script.
 * Deploy it while signed in as the placement mailbox, not the enrolment one.
 *
 * Setup (once)
 *  1. Signed in as the placement mailbox: script.google.com > New project > paste this file > Save.
 *  2. Project Settings > Script properties > add
 *       MAIL_KEY            a long random string (this is the password YatraLine uses; make one up)
 *       ATTACHMENT_IDS      optional. Google Drive file IDs, comma separated, of the help guide(s) to attach
 *                           (the email says "check the attachment"). The placement mailbox must be able to open them.
 *  3. Deploy > New deployment > type Web app > Execute as: Me > Who has access: Anyone > Deploy. Allow the permissions.
 *  4. Copy the Web app URL. In Supabase (Edge Functions > Secrets) set
 *       NEX_MAIL2_URL = that URL
 *       NEX_MAIL2_KEY = the same MAIL_KEY
 *  5. After any change to this script: Deploy > Manage deployments > edit > New version > Deploy (the URL stays the same).
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

    var to = String(body.to || '').trim();
    if (!EMAIL_RE.test(to)) return out_({ ok: false, error: 'invalid recipient' });
    var subject = String(body.subject || '').replace(/[\r\n]+/g, ' ').slice(0, 200);
    var text = String(body.text || '').slice(0, 20000);
    if (!subject || !text) return out_({ ok: false, error: 'subject and text are required' });
    if (MailApp.getRemainingDailyQuota() < 1) return out_({ ok: false, error: 'daily mail limit reached, try tomorrow' });

    var opts = { name: String(body.fromName || 'Oscars Training Centre').slice(0, 80) };
    if (body.html) opts.htmlBody = String(body.html).slice(0, 60000);
    var ids = String(props.getProperty('ATTACHMENT_IDS') || '').split(',').map(function (s) { return s.trim(); }).filter(String);
    if (ids.length) opts.attachments = ids.map(function (id) { return DriveApp.getFileById(id).getBlob(); });

    GmailApp.sendEmail(to, subject, text, opts);   // replies come back to this mailbox
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err).slice(0, 200) });
  }
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function safeEqual_(a, b) { if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
