// YatraLine: send the "documents needed before placement" email to a student, from the PLACEMENT mailbox.
// POST { booking_id, preview?: true, force?: true }  or  { quota: true } (how many sends are left today)
// The class booking must have Placement plan = Yes. The recipient is ALWAYS the email on the booking (or the linked student);
// the caller cannot choose it. Sent through a SECOND Apps Script mail relay (NEX_MAIL2_URL / NEX_MAIL2_KEY) that runs under the
// placement team's Google account, so it is a different sender from the enrolment follow-ups.
// The email is sent as a designed HTML message (email.ts) with the plain-text wording (draft() below) as the fallback part.
// Attachments: the active rows in nex_mail_attachments (purpose placement_docs), uploaded by hub admins in YatraLine > Admin.
// They are read from the private placement-files bucket with the CALLER's token, so storage rules still apply.
// Auth: the caller's token must say role=authenticated and not be expired; every read and write goes through RLS with that token,
// so a forged token reads nothing. Only the Placement team and admins may send.
// Deployed as two files: index.ts (this file) and email.ts (= scripts/edge/placement-docs-email.ts).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as b64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { placementDocsHtml } from "./email.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const MAIL_URL = Deno.env.get("NEX_MAIL2_URL") || "";
const MAIL_KEY = Deno.env.get("NEX_MAIL2_KEY") || "";
const MAX_TOTAL = 10 * 1024 * 1024; // all attachments together, before encoding

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

function draft(first: string, year: string) {
  const body = `Dear ${first || "Student"},\n\nPlease ensure these documents are ready before placement and send them to us as soon as possible. Your placement waiting time begins once all required documents are submitted. Please complete and send the following documents to us as soon as possible. Please check the attachment for help in accessing the online learning modules.\n\nRequired Documents:\n\n1. COVID-19 Vaccination Certificate (Please note that an additional COVID vaccine is not mandatory) - International vaccines must be updated in IHI. (For students with Medicare, you can update it in Medicare)\nTo register your vaccine with IHI:\n   * Go to mygov. https://my.gov.au\n   * Register a new ID\n   * Link service to Individual healthcare identifier\n   * Get an IHI number\n   * Go to the nearest GP or pharmacy with passport, vaccine certificate and IHI number\n\n2. ${year} Flu Vaccine Proof\n\n3. Recent Police Check - Select \"Commonwealth Employment\" (Reason 37). Apply here: https://afpnationalpolicechecks.converga.com.au/\n\n4. Australian ID - Photo ID or Australian Driver's License\n\n5. Hand Hygiene Certificate (in Aged Care Modules (Hand hygiene for clinical healthcare workers or Hand Hygiene Hand Dermatitis Online Learning Module) - NOT Dental). Complete here: https://nhhi.southrock.com/cgi-bin-secure/Home.cgi\n\n6. Basics of Infection Control Module for Aged Care (Not \"Train the Trainer\" module). Complete here: https://nhhi.southrock.com/cgi-bin-secure/Home.cgi\n\n7. NDIS Orientation Module. Complete here: https://www.ndiscommission.gov.au/workforce/ndis-commission-worker-training-portal/request-access\n\nIf you haven't already submitted your Passport and Visa, please submit them now as they are requirements for placement.\nPlease complete modules on a laptop or PC for proper certificate downloads.\nIf you have questions, please call us at 0402 608 052.\nThank you.`;
  return { subject: "Documents required before your placement", body };
}

// the files to attach: the list is read with the caller's token (RLS), each file is downloaded with it too.
// A file is stored under a unique path and never changed, so a copy kept by this running instance is safe to reuse (a bulk send downloads it once).
async function attachmentList(jwt: string) {
  const rows = await rest("nex_mail_attachments?purpose=eq.placement_docs&active=eq.true&select=id,file_name,content_type,size_bytes,storage_path&order=created_at", jwt);
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
    const r = await fetch(`${SB}/storage/v1/object/authenticated/placement-files/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${jwt}` } });
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

const NOT_SET = "The placement mailbox isn't connected yet. The second mail script URL and key still need to be added.";

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
    const teamP = rest("rpc/nex_team_ok", jwt, { method: "POST", body: JSON.stringify({ p_teams: ["Placement"] }) }).then((v) => v === true).catch(() => false);
    if (b.quota) {
      if (!(await teamP)) return json({ error: "forbidden", message: "Only the Placement team can send this email." }, 403);
      if (!MAIL_URL || !MAIL_KEY) return json({ error: "not_configured", message: NOT_SET }, 503);
      return json({ ok: true, remaining: await remainingToday() });
    }
    const [allowed, bkRows, priorRows, list] = await Promise.all([
      teamP,
      rest(`nex_class_bookings?id=eq.${bookingId}&select=id,name,email,student_id,placement_plan,nex_students(first_name,email)`, jwt),
      rest(`nex_placement_doc_mail?booking_id=eq.${bookingId}&select=status,created_by,updated_at`, jwt),
      attachmentList(jwt).catch(() => [] as any[]),
    ]);
    if (!allowed) return json({ error: "forbidden", message: "Only the Placement team can send this email." }, 403);

    const bk = bkRows[0];
    if (!bk) return json({ error: "Booking not found." }, 404);
    if (bk.placement_plan !== "yes") return json({ error: "not_yes", message: "Placement plan is not set to Yes on this booking." }, 409);
    const stu = Array.isArray(bk.nex_students) ? bk.nex_students[0] : bk.nex_students;
    const to = String(bk.email || (stu && stu.email) || "").trim();
    if (!EMAIL_RE.test(to)) return json({ error: "no_email", message: "There is no valid email address on file." }, 422);
    const first = String((stu && stu.first_name) || bk.name || "").trim().split(/\s+/)[0];

    const year = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric" }).format(new Date());
    const d = draft(first, year);
    const html = placementDocsHtml(first, year);
    const prior = priorRows[0] || null;
    const attachments = list.map((a: any) => ({ file_name: a.file_name, size_bytes: a.size_bytes }));
    if (b.preview) return json({ ok: true, to, subject: d.subject, body: d.body, html, prior, attachments });
    if (prior && prior.status === "sent" && !b.force) return json({ error: "already_sent", message: `This email was already sent${prior.created_by ? " by " + prior.created_by : ""}.`, prior }, 409);
    if (!MAIL_URL || !MAIL_KEY) return json({ error: "not_configured", message: NOT_SET }, 503);

    let files: { name: string; type: string; data: string }[] = [];
    try { files = await loadAttachments(jwt, list); } catch (e) { return json({ error: "attachment_failed", message: (e as Error).message }, 502); }

    const mr = await fetch(MAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ key: MAIL_KEY, to, subject: d.subject, text: d.body, html, fromName: "Oscars Training Centre Placement Team", attachments: files }),
      redirect: "follow",
    });
    const mt = await mr.text();
    let mj: any = null;
    try { mj = JSON.parse(mt); } catch { /* not json */ }
    if (mj && mj.error === "daily_limit") return json({ error: "daily_limit", message: "The placement mailbox has reached its daily sending limit. Try again tomorrow.", remaining: 0 }, 429);
    if (!mr.ok || !mj || mj.ok !== true) {
      return json({ error: "mail_failed", message: (mj && mj.error) ? `The mail script said: ${String(mj.error).slice(0, 200)}` : "The mail script did not accept the email." }, 502);
    }

    await rest("nex_placement_doc_mail?on_conflict=booking_id", jwt, {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ booking_id: bookingId, student_id: bk.student_id || null, to_email: to, status: "sent", subject: d.subject }),
    });
    return json({ ok: true, sent: true, to, attached: files.length, remaining: typeof mj.remaining === "number" ? mj.remaining : null });
  } catch (e) {
    return json({ error: "server", message: (e as Error).message || "Something went wrong." }, 500);
  }
});
