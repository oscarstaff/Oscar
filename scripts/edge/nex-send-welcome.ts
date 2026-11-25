// YatraLine: send the enrolment email to a new lead, from the SUPPORT mailbox.
// Called by the database (nex_welcome_kick) the moment a lead with an email is added, and every 5 minutes to retry what is still waiting.
// POST {} with the header x-cron-secret. It sends every row in nex_welcome_mail that is 'pending' (or 'failed' with fewer than 3 tries).
// The recipient is ALWAYS the email stored on the row, which the database copied from the lead; nothing in the request can change it.
// Sent through the same Nex mail relay as the follow-up emails (NEX_MAIL_URL / NEX_MAIL_KEY, the support mailbox). Set NEX_MAIL4_URL / NEX_MAIL4_KEY only to use a different sender. The relay (scripts/nex-mail-relay.gs) uses the html field when it is sent, otherwise it turns the text into simple HTML.
// Deploy with verify_jwt OFF (the caller is the database; the secret above is the check). Needs the usual SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Deployed as two files: index.ts (this file) and email.ts (= scripts/edge/welcome-email.ts).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { welcomeText, welcomeHtml, WELCOME_SUBJECT } from "./email.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAIL_URL = Deno.env.get("NEX_MAIL4_URL") || Deno.env.get("NEX_MAIL_URL") || "";   // the follow-up sender (support mailbox) unless a separate one is set
const MAIL_KEY = Deno.env.get("NEX_MAIL4_KEY") || Deno.env.get("NEX_MAIL_KEY") || "";
const FROM_NAME = "Oscars Training Centre Support";
const MAX_TRIES = 3;
const MAX_AGE_MS = 3 * 24 * 3600 * 1000;   // a row waiting longer than this (the mailbox was never connected) is not sent by surprise days later; use Send again on the student

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/;

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const txt = await r.text();
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!r.ok) throw new Error((data && (data.message || data.hint)) || `Database error ${r.status}`);
  return data;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const secret = req.headers.get("x-cron-secret") || "";
    const ok = await rest("rpc/cron_secret_ok", { method: "POST", body: JSON.stringify({ p: secret }) }).catch(() => false);
    if (ok !== true) return json({ error: "forbidden" }, 403);
    if (!MAIL_URL || !MAIL_KEY) return json({ ok: true, sent: 0, note: "The mail sender isn't connected (NEX_MAIL_URL / NEX_MAIL_KEY)." });

    // anything stuck in 'sending' for over 10 minutes (the function stopped half way) goes back to waiting
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await rest(`nex_welcome_mail?status=eq.sending&updated_at=lt.${stale}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "pending" }) }).catch(() => null);

    const rows: any[] = await rest(`nex_welcome_mail?or=(status.eq.pending,and(status.eq.failed,attempts.lt.${MAX_TRIES}))&select=student_id,to_email,attempts,created_at&order=created_at&limit=20`);
    let sent = 0, failed = 0, skipped = 0;
    for (const row of rows) {
      // take the row: only one run can win this update
      const mine: any[] = await rest(`nex_welcome_mail?student_id=eq.${row.student_id}&or=(status.eq.pending,status.eq.failed)&attempts=lt.${MAX_TRIES}`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "sending" }),
      });
      if (!mine.length) continue;
      const to = String(row.to_email || "").trim();
      const fail = async (msg: string, count = true) => rest(`nex_welcome_mail?student_id=eq.${row.student_id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "failed", attempts: row.attempts + (count ? 1 : 0), last_error: msg.slice(0, 300) }),
      });
      if (!EMAIL_RE.test(to)) { await rest(`nex_welcome_mail?student_id=eq.${row.student_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", attempts: MAX_TRIES, last_error: "The email address is not valid." }) }); skipped++; continue; }
      if (Date.now() - new Date(row.created_at).getTime() > MAX_AGE_MS && row.attempts === 0) {
        await rest(`nex_welcome_mail?student_id=eq.${row.student_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", attempts: MAX_TRIES, last_error: "Waited more than 3 days to be sent. Use Send enrolment email on the student to send it now." }) });
        skipped++; continue;
      }
      let first = "";
      try { const st = await rest(`nex_students?id=eq.${row.student_id}&select=first_name`); first = String((st && st[0] && st[0].first_name) || "").trim().split(/\s+/)[0].replace(/[\u0000-\u001f<>]/g, "").slice(0, 40); } catch { /* send without a name */ }
      try {
        const mr = await fetch(MAIL_URL, {
          method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow",
          body: JSON.stringify({ key: MAIL_KEY, to, subject: WELCOME_SUBJECT, text: welcomeText(first), html: welcomeHtml(first), fromName: FROM_NAME }),
        });
        const mt = await mr.text();
        let mj: any = null;
        try { mj = JSON.parse(mt); } catch { /* not json */ }
        if (mj && mj.error === "daily_limit") {   // not this person's fault: put it back and stop for today
          await rest(`nex_welcome_mail?student_id=eq.${row.student_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "pending", last_error: "The support mailbox reached its daily limit. It will send when the limit resets." }) });
          break;
        }
        if (!mr.ok || !mj || mj.ok !== true) throw new Error(mj && mj.error ? `The mail script said: ${String(mj.error).slice(0, 200)}` : "The mail script did not accept the email.");
        await rest(`nex_welcome_mail?student_id=eq.${row.student_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString(), last_error: null, attempts: row.attempts + 1 }) });
        sent++;
      } catch (e) { await fail((e as Error).message || "Could not send."); failed++; }
    }
    return json({ ok: true, sent, failed, skipped });
  } catch (e) {
    return json({ error: "server", message: (e as Error).message || "Something went wrong." }, 500);
  }
});
