// auto-clockout: called by cron after 8pm Sydney. Clocks out anyone still clocked in
// (one 20:00 'out', via public.auto_clock_out_8pm), tells the Google Sheet, and pushes them.
// ?dry=1 lists who would be clocked out and writes nothing.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHEET_URL = Deno.env.get("APPS_SCRIPT_URL") ||
  "https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec";
// Same relay token Nexus/ShiftOps already send (the Apps Script rejects calls without it).
const GAS_TOKEN = Deno.env.get("GAS_TOKEN") || "oscars_gas_83235a5f0c1f6ba32b18235e2b2d544ac137167d";
const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await supabase.rpc("auto_clock_out_8pm", { p_dry: dry });
    if (error) throw error;
    const rows = data || [];
    if (dry) return new Response(JSON.stringify({ ok: true, dry_run: true, would_clock_out: rows }), { headers: CORS });

    let pushed = 0;
    for (const r of rows) {
      const out = new Date(r.out_ts);
      const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Sydney", day: "2-digit", month: "2-digit", year: "numeric" }).format(out);
      try { // keep the payroll sheet in step (best effort)
        await fetch(SHEET_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ token: GAS_TOKEN, action: "updatePunch", staff: r.staff_name, date: p, timeOut: "20:00", editor: "auto-8pm" }) });
      } catch (_e) { /* sheet sync is non-critical */ }
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          staff_name: r.staff_name,
          title: "Clocked out at 8:00pm",
          body: "You forgot to clock out, so we recorded 8:00pm. If that's wrong, tell your manager.",
          url: "./#home", tag: `auto-out-${p}`, notif_key: `auto-out-${r.out_ts}`,
        }),
      });
      if (resp.ok) pushed++; else console.warn("[auto-clockout] push failed", r.staff_name, await resp.text());
    }
    return new Response(JSON.stringify({ ok: true, clocked_out: rows.length, pushed }), { headers: CORS });
  } catch (err: any) {
    console.error("[auto-clockout]", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
