// Nex: build and send a lead follow-up email through the workspace Apps Script mail relay.
// POST { student_id, step: 1, 2, 3, 4 ... (any follow-up number), preview?: true, subject?, body?, force?: true }  or  { quota: true } (how many sends are left today)
// The recipient is ALWAYS the email on the student's record; the caller cannot choose it.
// Auth: the caller's token must say role=authenticated and not be expired; the database then checks the
// token's signature and the person's access on every read (RLS), so a forged token reads nothing.
// Sending the 1st or 2nd email ticks that follow-up off. From the 3rd on the app finishes the follow-up itself, because it has to ask for the date of the next one.
// View-only lock (24 Nov 2026): while nex_config.view_only is on, only admins can send (nex_can_act); previews stay open.
// 25 Nov 2026: the sign-off is the Student Centre Team signature. The email goes out as plain HTML (orange bold sign-off, bold contact lines, blue links, logo under it) with the plain-text wording alongside.
// Deployed as one file: index.ts (= this file).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAIL_URL = Deno.env.get("NEX_MAIL_URL") || "";
const MAIL_KEY = Deno.env.get("NEX_MAIL_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function claimsOf(jwt: string): any {
  try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return null; }
}

async function rest(path: string, jwt: string, init: RequestInit = {}, service = false) {
  const key = service ? SERVICE : ANON;
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${service ? SERVICE : jwt}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const txt = await r.text();
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!r.ok) throw new Error((data && (data.message || data.hint)) || `Database error ${r.status}`);
  return data;
}

function clean(s: unknown, max: number) {
  return String(s ?? "").replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max);
}

// how many sends the mailbox has left today; null when the mail script cannot say (an older script, a missing permission, or no answer in time)
async function remainingToday(): Promise<number | null> {
  try {
    const r = await fetch(MAIL_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ key: MAIL_KEY, action: "quota" }), redirect: "follow", signal: AbortSignal.timeout(8000) });
    const j = JSON.parse(await r.text());
    return j && j.ok === true && typeof j.remaining === "number" ? j.remaining : null;
  } catch { return null; }
}

type Group = { course: string; docs: string[]; hasList: boolean };
type Draft = { subject: string; body: string; missing: { course: string; docs: string[] }[] };

const DEFAULT_DOCS = ["Completed Enrolment Form", "Passport and Current visa", "1–2 forms of Australian ID", "Academic Certificate", "Editable Resume (Word document)", "Unique Student Identifier (USI)"];
const FALLBACK_COURSE = "Aged Care/Disability Support";

// The Student Centre Team signature. SIGN_TEXT is what staff see and can edit in the preview; SIGN_HTML is the same thing styled for the email.
const SIGN_TEXT = [
  "Best Regards,",
  "Student Centre Team",
  "Phone: 0481487715 / 0481487720",
  "Landline: 0295997373",
  "Email: support@studentscenter.com.au",
  "       studentcentres2020@gmail.com",
  "Address: Suite 5/5 King St, Rockdale, NSW, 2216",
].join("\n");
const MAPS = "https://www.google.com/maps/search/5+King+St,+Rockdale,+NSW,+2216";
const BLUE = "color:#1a56c4";
const SIGN_HTML = `<p style="margin:22px 0 0;color:#d9640a"><b>Best Regards,<br>Student Centre Team</b></p>
<p style="margin:0 0 16px;color:#222222"><b>Phone: 0481487715 / 0481487720<br>Landline: 0295997373<br>Email: <a href="mailto:support@studentscenter.com.au" style="${BLUE}">support@studentscenter.com.au</a><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="mailto:studentcentres2020@gmail.com" style="${BLUE}">studentcentres2020@gmail.com</a><br>Address: Suite 5/<a href="${MAPS}" style="${BLUE}">5 King St, Rockdale, NSW, 2216</a></b></p>`;
const LOGO_URL = "https://oscarstaff.github.io/Oscar/assets/otc-email-logo.png";
const LOGO_HTML = `<p style="margin:0"><img src="${LOGO_URL}" width="200" alt="Oscars Training Centre" style="display:block;width:200px;max-width:100%;height:auto;border:0"></p>`;

const escH = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const linkify = (s: string) => escH(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="${BLUE}">${u}</a>`);
const mark = (t: string) => `<b style="background-color:#fff3a3">${t}</b>`;

// The (possibly edited) plain text -> plain HTML: blank line = new paragraph, "* " lines = bullets, numbered document lines bold and highlighted.
// The styled signature and the logo are added only when the text still ends with the standard signature.
export function followupHtml(body: string): string {
  const t = body.replace(/\s+$/, "");
  const hasSig = t.endsWith(SIGN_TEXT);
  const main = (hasSig ? t.slice(0, t.length - SIGN_TEXT.length) : t).trim();
  const blocks = main.split(/\n{2,}/).map((blk) => {
    const ls = blk.split("\n");
    if (ls.every((l) => /^\* /.test(l))) {
      return `<ul style="margin:0 0 14px;padding-left:22px">${ls.map((l) => `<li style="margin:0 0 6px">${linkify(l.slice(2))}</li>`).join("")}</ul>`;
    }
    return `<p style="margin:0 0 14px">${ls.map((l) => (/^\d+\) /.test(l) ? mark(linkify(l)) : linkify(l))).join("<br>")}</p>`;
  }).join("\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222222;max-width:640px">\n${blocks}\n${hasSig ? SIGN_HTML + "\n" + LOGO_HTML + "\n" : ""}</div>`;
}

function numbered(items: string[]) { return items.map((d, i) => `${i + 1}) ${d}`).join("\n\n"); }

function draftEmail(step: number, first: string, groups: Group[]): Draft {
  const hi = `Dear ${first || "Student"},`;
  const sign = SIGN_TEXT;
  const listKnown = groups.some((g) => g.hasList);
  const withDocs = groups.filter((g) => g.docs.length);
  const courseText = groups.length ? groups.map((g) => g.course).join(" and ") : FALLBACK_COURSE;
  let list = "";
  if (!listKnown) list = numbered(DEFAULT_DOCS);
  else if (withDocs.length === 1) list = numbered(withDocs[0].docs);
  else if (withDocs.length > 1) list = withDocs.map((g) => `${g.course}\n\n${numbered(g.docs)}`).join("\n\n");
  const missing = withDocs.map((g) => ({ course: g.course, docs: g.docs }));

  if (step === 1) {
    return {
      subject: "Action Required: Outstanding Documents for Enrolment",
      body: `${hi}\n\nI hope this email finds you well.\n\nI am following up regarding the required enrolment documents that are due for submission. Please send us the outstanding documents at your earliest convenience so that we can proceed with your enrolment.\n\nIf you have any questions or require assistance with the documentation, please do not hesitate to contact us. We are happy to assist you.\n\n${sign}`,
      missing,
    };
  }
  if (step === 2) {
    const ask = list
      ? `To finalise your enrolment, please provide the following outstanding documents:\n\n${list}`
      : `Our records show we have received all the documents we need for now. We will be in touch about the next step.`;
    return {
      subject: "Important Reminder: Pending Enrolment Documentation",
      body: `${hi}\n\nI hope you are well.\n\nWe are following up regarding your enrolment for the ${groups.length ? courseText : FALLBACK_COURSE + " Certification"}. ${ask}${groups.length ? "" : "\n\nAlso, please provide us with the name of the certificate you wish to enrol in."}\n\nIf you have any questions or require assistance, please feel free to contact us.\n\n${sign}`,
      missing,
    };
  }
  if (step >= 4) {
    return {
      subject: "Checking In: Your Enrolment with Oscars Training Centre",
      body: `${hi}\n\nI hope you are well.\n\nWe are checking in about your ${courseText} enrolment and wanted to see whether you would still like to go ahead.${list && listKnown ? `\n\nTo finalise your application, we still need:\n\n${list}` : ""}\n\nIf you have any questions, or would like help with the next step, please reply to this email and we will be happy to assist.\n\n${sign}`,
      missing,
    };
  }
  return {
    subject: "Immediate Action Required to Complete Enrolment",
    body: `${hi}\n\nI hope you are well.\n\nThis is a follow-up regarding your ${courseText} enrolment. Please send any outstanding documents required to finalise your application.${list && listKnown ? `\n\nStill outstanding:\n\n${list}` : ""}\n\nIf you are unsure about the process, please refer to the details below:\n\nProcess:\n\n* Attend the required First Aid & CPR training. (1-2 Days)\n* Complete and return the required placement documents. (We will send the requirement list)\n* We will then arrange 120 hours of placement based on availability, timing and location, with your approval.\n* If you are currently studying and unable to commence placement, we can arrange placement around your study break, provided all required documents and information are completed and submitted beforehand. Alternative options may also be available.\n* Your Certificate will be issued once the placement logbook is completed and full payment has been made.\n\nPlease contact us if you require any assistance.\n\n${sign}`,
    missing,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const claims = claimsOf(jwt);
    if (!claims || claims.role !== "authenticated" || !claims.sub || (claims.exp && claims.exp * 1000 < Date.now())) return json({ error: "Please sign in again." }, 401);
    const staffEmail = String(claims.email || "");

    const b = await req.json().catch(() => ({}));
    if (b.quota) {
      if (!MAIL_URL || !MAIL_KEY) return json({ error: "not_configured", message: "Email sending isn't set up yet. The mail script URL and key still need to be added." }, 503);
      return json({ ok: true, remaining: await remainingToday() });
    }
    const studentId = String(b.student_id || "");
    const step = Number(b.step);
    if (!UUID_RE.test(studentId)) return json({ error: "Missing person." }, 400);
    if (!Number.isInteger(step) || step < 1 || step > 50) return json({ error: "Step must be a follow-up number from 1 up." }, 400);

    // everything below is independent, so read it at the same time instead of one after another
    const [stuRows, staffRaw, enr, quals, types, lastRows] = await Promise.all([
      rest(`nex_students?id=eq.${studentId}&deleted_at=is.null&select=id,first_name,last_name,email`, jwt),
      rest("rpc/current_staff_name", jwt, { method: "POST", body: "{}" }).catch(() => ""),
      rest(`nex_enrolments?student_id=eq.${studentId}&deleted_at=is.null&select=id,qualification_id&order=created_at.asc`, jwt),
      rest("nex_qualifications?select=id,name,doc_group", jwt),
      rest("nex_doc_types?active=eq.true&select=id,group_key,name&order=position", jwt),
      rest(`nex_email_log?student_id=eq.${studentId}&kind=eq.lead_followup&step=eq.${step}&order=sent_at.desc&limit=1&select=sent_at,sent_by`, jwt),
    ]);
    const stu = stuRows[0];
    if (!stu) return json({ error: "Person not found.", }, 404);
    const to = String(stu.email || "").trim();
    if (!EMAIL_RE.test(to)) return json({ error: "no_email", message: "This person has no valid email address on file." }, 422);

    let staff = String(staffRaw || "");
    if (!staff) staff = staffEmail.split("@")[0];

    const got = enr.length
      ? await rest(`nex_enrolment_docs?enrolment_id=in.(${enr.map((e: any) => e.id).join(",")})&select=enrolment_id,doc_type_id`, jwt)
      : [];
    const groups: Group[] = [];
    for (const e of enr) {
      const q = quals.find((x: any) => x.id === e.qualification_id);
      if (!q) continue;
      const have = new Set(got.filter((g: any) => g.enrolment_id === e.id).map((g: any) => g.doc_type_id));
      const miss = q.doc_group ? types.filter((t: any) => t.group_key === q.doc_group && !have.has(t.id)).map((t: any) => t.name) : [];
      groups.push({ course: q.name, docs: miss, hasList: !!q.doc_group });
    }

    const d = draftEmail(step, String(stu.first_name || "").trim(), groups);
    const lastSent = lastRows[0] || null;

    if (b.preview) return json({ ok: true, to, subject: d.subject, body: d.body, missing: d.missing, last_sent: lastSent });

    // view-only lock: only admins may send while it is on
    const canAct = await rest("rpc/nex_can_act", jwt, { method: "POST", body: "{}" }).then((v) => v === true).catch(() => false);
    if (!canAct) return json({ error: "view_only", message: "Yatra is view-only right now. You can look around, but changes are switched off." }, 403);

    const subject = clean(b.subject, 200).replace(/\n/g, " ").trim() || d.subject;
    const body = clean(b.body, 8000).trim() || d.body;
    if (lastSent && !b.force && Date.now() - new Date(lastSent.sent_at).getTime() < 24 * 3600 * 1000) {
      return json({ error: "recent", message: `This email was already sent by ${lastSent.sent_by || "someone"} in the last 24 hours.`, last_sent: lastSent }, 409);
    }
    if (!MAIL_URL || !MAIL_KEY) return json({ error: "not_configured", message: "Email sending isn't set up yet. The mail script URL and key still need to be added." }, 503);

    const mr = await fetch(MAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ key: MAIL_KEY, to, subject, text: body, html: followupHtml(body), replyTo: EMAIL_RE.test(staffEmail) ? staffEmail : "", fromName: "Oscars Training Centre" }),
      redirect: "follow",
    });
    const mt = await mr.text();
    let mj: any = null;
    try { mj = JSON.parse(mt); } catch { /* not json */ }
    if (mj && mj.error === "daily_limit") return json({ error: "daily_limit", message: "The enrolment mailbox has reached its daily sending limit. Try again tomorrow.", remaining: 0 }, 429);
    if (!mr.ok || !mj || mj.ok !== true) {
      return json({ error: "mail_failed", message: (mj && mj.error) ? `The mail script said: ${String(mj.error).slice(0, 200)}` : "The mail script did not accept the email." }, 502);
    }

    await rest("nex_email_log", jwt, {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ student_id: studentId, kind: "lead_followup", step, to_email: to, subject, body, sent_by: staff }),
    }, true);
    let ticked = false;
    if (step < 3) {
      try {
        const r = await rest(`nex_followups?student_id=eq.${studentId}&kind=eq.lead_cycle&step=eq.${step}&done_at=is.null`, jwt, {
          method: "PATCH", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ done_at: new Date().toISOString(), done_by: staff }),
        });
        ticked = Array.isArray(r) && r.length > 0;
      } catch { /* email already went; ticking is best effort */ }
    }
    return json({ ok: true, sent: true, to, ticked, remaining: typeof mj.remaining === "number" ? mj.remaining : null });
  } catch (e) {
    return json({ error: "server", message: (e as Error).message || "Something went wrong." }, 500);
  }
});
