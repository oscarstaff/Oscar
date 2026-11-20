// YatraLine: send the First Aid and CPR class confirmation email to a student, from the FIRST AID and CPR team mailbox.
// POST { booking_id, preview?: true, force?: true }  or  { quota: true } (how many sends the mailbox has left today)
// The recipient is ALWAYS the email on the booking (or the linked student); the caller cannot choose it.
// Sent through a THIRD Apps Script mail relay (NEX_MAIL3_URL / NEX_MAIL3_KEY) that runs under the First Aid and CPR team's Google account.
// The email is sent as a designed HTML message (email.ts) with the plain-text wording (draft() below) as the fallback part.
// Attachments: the active rows in nex_mail_attachments (purpose class_confirm), uploaded by hub admins in YatraLine > Admin.
// They are read from the private class-files bucket with the CALLER's token, so storage rules still apply.
// Auth: the caller's token must say role=authenticated and not be expired; every read and write goes through RLS with that token,
// so a forged token reads nothing. Only the Evershine team and admins may send.
// Deployed as two files: index.ts (this file) and email.ts (= scripts/edge/class-confirm-email.ts).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as b64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { classConfirmHtml } from "./email.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const MAIL_URL = Deno.env.get("NEX_MAIL3_URL") || "";
const MAIL_KEY = Deno.env.get("NEX_MAIL3_KEY") || "";
const MAX_TOTAL = 10 * 1024 * 1024; // all attachments together, before encoding
const STD_TIME = "8:45 AM - 5 PM"; // used when the class day has no times set

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

async function rest(path: string, jwt: string, init: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const txt = await r.text();
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!r.ok) throw new Error((data && (data.message || data.hint)) || `Database error ${r.status}`);
  return data;
}

// "2026-11-18" -> "18/11/2026"
function fmtDate(d: string) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; }
// "08:45" -> "8:45 AM", "17:00" -> "5 PM"
function fmtClock(t: string) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
  if (!m) return "";
  const h = Number(m[1]), min = m[2];
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${min === "00" ? "" : ":" + min} ${h >= 12 ? "PM" : "AM"}`;
}
function classTime(s: any) {
  const a = fmtClock(s && s.start_time), z = fmtClock(s && s.end_time);
  return a && z ? `${a} - ${z}` : STD_TIME;
}

// The plan for the day. Each class day can carry its own plan (nex_class_sessions.schedule); when it has none, the trainer's usual plan is used.
// Keep SECTIONS / STD_PLAN / ANJU_PLAN in step with FA_SECTIONS and FA_PLANS in pipeline/pl-firstaid.js.
const SECTIONS: [string, string][] = [["info", "Info session"], ["first_aid", "First Aid"], ["cpr", "CPR"], ["manual", "Manual Handling"]];
type Plan = Record<string, [string, string]>;
const STD_PLAN: Plan = { info: ["09:00", "11:00"], first_aid: ["11:00", "13:00"], break: ["13:00", "14:00"], cpr: ["14:00", "16:00"], manual: ["16:00", "17:00"] };
const ANJU_PLAN: Plan = { first_aid: ["09:00", "12:00"], cpr: ["12:00", "14:15"], break: ["13:00", "13:30"], manual: ["14:15", "15:00"], info: ["15:00", "17:00"] };
function planOf(ses: any): Plan {
  const sc = ses && ses.schedule;
  if (sc && typeof sc === "object" && !Array.isArray(sc)) return sc as Plan;
  return /\banju\b/i.test(String((ses && ses.trainer) || "")) ? ANJU_PLAN : STD_PLAN;
}
const okRange = (r: any) => Array.isArray(r) && /^\d{1,2}:\d{2}/.test(String(r[0] || "")) && /^\d{1,2}:\d{2}/.test(String(r[1] || ""));
// the times this person needs to be there: only the sections they attend (sections null = all), with the break when it falls inside their day
function personalTimes(ses: any, sections: string[] | null) {
  const plan = planOf(ses);
  const mine = SECTIONS.filter(([k]) => okRange(plan[k]) && (!sections || sections.includes(k)))
    .map(([k, label]) => ({ label, a: String(plan[k][0]), z: String(plan[k][1]) }))
    .sort((x, y) => x.a.localeCompare(y.a, "en", { numeric: true }));
  if (!mine.length) return null;
  const start = mine.map((m) => m.a).sort((x, y) => x.localeCompare(y, "en", { numeric: true }))[0];
  const end = mine.map((m) => m.z).sort((x, y) => y.localeCompare(x, "en", { numeric: true }))[0];
  const rows = mine.slice();
  const br = plan.break;
  if (okRange(br) && String(br[0]) >= start && String(br[1]) <= end) rows.push({ label: "Break", a: String(br[0]), z: String(br[1]) });
  rows.sort((x, y) => x.a.localeCompare(y.a, "en", { numeric: true }));
  const lines = rows.map((r) => `${r.label}: ${fmtClock(r.a)} - ${fmtClock(r.z)}`);
  return { lines, start, end, span: `${fmtClock(start)} - ${fmtClock(end)}` };
}

function draft(first: string, date: string, time: string, lines?: string[]) {
  const body = `Dear ${first || "Student"},\n\nThank you for choosing us for your training certificate. As discussed, your class is confirmed for ${date} (Time: ${time}) at Unit 5, 5 King Street, Rockdale, NSW 2216. Please arrive 10 - 15 minutes early for your registration to avoid lining up.\n${lines && lines.length ? "Your sections and times:\n" + lines.map((l) => "* " + l).join("\n") + "\n" : ""}Parking: 1 Market Street Rockdale\nQUIZ FOR FIRST AID/CPR/MANUAL HANDLING:\n\n* Please check the attached PDF for quiz access guidance.\n\nPlease make the payment the day before coming to the class for your easiness:-\nFees:\n\n* Certificate III in Individual Support (Ageing & Disability) including First Aid & CPR: $1,300\n* Certificate IV Ageing Support with Medication including First Aid & CPR: $1,500\n* Certificate IV Disability including First Aid & CPR: $1,500\n* First Aid CPR and Manual Handling: $200\n* First Aid and CPR: $125\n* CPR: $55\n* Manual Handling: $80\n\nPayment Details (COMMONWEALTH Bank):\n\n* Account Name: Oscar Training Centre\n* BSB: 062235\n* Account Number:11104627\n* Description/Reference: [Your Name] + The Certificate you are proceeding with\n\nKindly, send us a screenshot of the payment before you attend the classes once made. If you are paying from someone else's account, make sure to have them include your full name and Date of Birth in the reference.\nFor any assistance please do not hesitate to contact us at 0402462830.`;
  return { subject: `First Aid and CPR class confirmation: ${date}`, body };
}

// the files to attach: the list is read with the caller's token (RLS), each file is downloaded with it too.
// A file is stored under a unique path and never changed, so a copy kept by this running instance is safe to reuse (a bulk send downloads it once).
async function attachmentList(jwt: string) {
  const rows = await rest("nex_mail_attachments?purpose=eq.class_confirm&active=eq.true&select=id,file_name,content_type,size_bytes,storage_path&order=created_at", jwt);
  return Array.isArray(rows) ? rows : [];
}
const FILE_CACHE = new Map<string, { name: string; type: string; data: string }>();
async function loadAttachments(jwt: string, list: any[]) {
  const total = list.reduce((t, a) => t + Number(a.size_bytes || 0), 0);
  if (total > MAX_TOTAL) throw new Error("The attached files are over 10 MB together. Remove one in Admin.");
  return await Promise.all(list.map(async (a) => {
    const key = String(a.storage_path);
    const hit = FILE_CACHE.get(key);
    if (hit) return hit;
    const path = key.split("/").map(encodeURIComponent).join("/");
    const r = await fetch(`${SB}/storage/v1/object/authenticated/class-files/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${jwt}` } });
    if (!r.ok) throw new Error(`Could not read the attached file ${a.file_name} (${r.status}).`);
    const f = { name: String(a.file_name), type: String(a.content_type || "application/octet-stream"), data: b64(new Uint8Array(await r.arrayBuffer())) };
    if (FILE_CACHE.size >= 8) FILE_CACHE.delete(FILE_CACHE.keys().next().value as string);
    FILE_CACHE.set(key, f);
    return f;
  }));
}

// how many sends the mailbox has left today; null when the mail script cannot say (an older script, a missing permission, or no answer in time)
async function remainingToday(): Promise<number | null> {
  try {
    const r = await fetch(MAIL_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ key: MAIL_KEY, action: "quota" }), redirect: "follow", signal: AbortSignal.timeout(8000) });
    const j = JSON.parse(await r.text());
    return j && j.ok === true && typeof j.remaining === "number" ? j.remaining : null;
  } catch { return null; }
}

const NOT_SET = "The First Aid and CPR mailbox isn't connected yet. The third mail script URL and key still need to be added.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const claims = claimsOf(jwt);
    if (!claims || claims.role !== "authenticated" || !claims.sub || (claims.exp && claims.exp * 1000 < Date.now())) return json({ error: "Please sign in again." }, 401);

    const b = await req.json().catch(() => ({}));
    const bookingId = String(b.booking_id || "");
    if (!b.quota && !UUID_RE.test(bookingId)) return json({ error: "Missing booking." }, 400);

    // the permission check and every read below are independent, so they run at the same time instead of one after another
    const teamP = rest("rpc/nex_team_ok", jwt, { method: "POST", body: JSON.stringify({ p_teams: ["Evershine"] }) }).then((v) => v === true).catch(() => false);
    if (b.quota) {
      if (!(await teamP)) return json({ error: "forbidden", message: "Only the Evershine team can send this email." }, 403);
      if (!MAIL_URL || !MAIL_KEY) return json({ error: "not_configured", message: NOT_SET }, 503);
      return json({ ok: true, remaining: await remainingToday() });
    }
    const [allowed, bkRows, priorRows, list] = await Promise.all([
      teamP,
      rest(`nex_class_bookings?id=eq.${bookingId}&select=id,name,email,student_id,status,sections,nex_students(first_name,email),nex_class_sessions(class_date,start_time,end_time,trainer,schedule)`, jwt),
      rest(`nex_class_confirm_mail?booking_id=eq.${bookingId}&select=status,created_by,updated_at,class_date`, jwt),
      attachmentList(jwt).catch(() => [] as any[]),
    ]);
    if (!allowed) return json({ error: "forbidden", message: "Only the Evershine team can send this email." }, 403);

    const bk = bkRows[0];
    if (!bk) return json({ error: "Booking not found." }, 404);
    if (["cancelled", "no_show", "rescheduled"].includes(String(bk.status || ""))) return json({ error: "not_booked", message: "This booking is cancelled, rescheduled or marked no-show, so no confirmation can be sent." }, 409);
    const stu = Array.isArray(bk.nex_students) ? bk.nex_students[0] : bk.nex_students;
    const ses = Array.isArray(bk.nex_class_sessions) ? bk.nex_class_sessions[0] : bk.nex_class_sessions;
    if (!ses || !ses.class_date) return json({ error: "no_class", message: "This booking has no class date." }, 422);
    const to = String(bk.email || (stu && stu.email) || "").trim();
    if (!EMAIL_RE.test(to)) return json({ error: "no_email", message: "There is no valid email address on file." }, 422);
    const first = String((stu && stu.first_name) || bk.name || "").trim().split(/\s+/)[0];

    const date = fmtDate(ses.class_date);
    const pt = personalTimes(ses, Array.isArray(bk.sections) ? bk.sections : null);
    const time = pt ? pt.span : classTime(ses);   // the overall span; the sections this person attends are listed separately
    const d = draft(first, date, time, pt ? pt.lines : undefined);
    const html = classConfirmHtml(first, date, time, pt ? { iso: ses.class_date, start: pt.start, end: pt.end, lines: pt.lines, span: pt.span } : { iso: ses.class_date, start: ses.start_time, end: ses.end_time });
    const prior = priorRows[0] || null;
    const attachments = list.map((a: any) => ({ file_name: a.file_name, size_bytes: a.size_bytes }));
    if (b.preview) return json({ ok: true, to, subject: d.subject, body: d.body, html, prior, attachments });
    if (prior && prior.status === "sent" && !b.force) return json({ error: "already_sent", message: `A confirmation was already sent${prior.created_by ? " by " + prior.created_by : ""}.`, prior }, 409);
    if (!MAIL_URL || !MAIL_KEY) return json({ error: "not_configured", message: NOT_SET }, 503);

    let files: { name: string; type: string; data: string }[] = [];
    try { files = await loadAttachments(jwt, list); } catch (e) { return json({ error: "attachment_failed", message: (e as Error).message }, 502); }

    const mr = await fetch(MAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ key: MAIL_KEY, to, subject: d.subject, text: d.body, html, fromName: "Oscars Training Centre First Aid and CPR Team", attachments: files }),
      redirect: "follow",
    });
    const mt = await mr.text();
    let mj: any = null;
    try { mj = JSON.parse(mt); } catch { /* not json */ }
    if (mj && mj.error === "daily_limit") return json({ error: "daily_limit", message: "The First Aid and CPR mailbox has reached its daily sending limit. Try again tomorrow.", remaining: 0 }, 429);
    if (!mr.ok || !mj || mj.ok !== true) {
      return json({ error: "mail_failed", message: (mj && mj.error) ? `The mail script said: ${String(mj.error).slice(0, 200)}` : "The mail script did not accept the email." }, 502);
    }

    await rest("nex_class_confirm_mail?on_conflict=booking_id", jwt, {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ booking_id: bookingId, student_id: bk.student_id || null, to_email: to, status: "sent", subject: d.subject, class_date: ses.class_date }),
    });
    return json({ ok: true, sent: true, to, attached: files.length, remaining: typeof mj.remaining === "number" ? mj.remaining : null });
  } catch (e) {
    return json({ error: "server", message: (e as Error).message || "Something went wrong." }, 500);
  }
});
