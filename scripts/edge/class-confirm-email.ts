// HTML version of the First Aid and CPR class confirmation email (used by the nex-send-class-confirm edge function).
// Built the way email clients need it: tables, inline styles, a column that fills the whole window (edge to edge, like the team's other emails), one hosted logo image.
// The wording is the team's own wording, reorganised so it can be scanned; the plain-text version (draft() in index.ts) is sent alongside it.
const BLUE = "#0e4a82", MID = "#1b78c2", SKY = "#4fc3f0", SKYSOFT = "#eaf6fd", INK = "#1b2733", MUTED = "#5b6776", LINE = "#dde6ef", SOFT = "#f4f8fc";
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const ADDRESS = "Unit 5, 5 King Street, Rockdale, NSW 2216";
const MAP_Q = encodeURIComponent("5 King Street, Rockdale NSW 2216");
const DIRECTIONS = "https://www.google.com/maps/dir/?api=1&destination=" + MAP_Q;
const PARKING = "1 Market Street Rockdale";
const PHONE = "0402462830";
// the OTC mark (assets/otc-logo.png in the repo), served by GitHub Pages; 252px wide for a 2x display at 84px
const LOGO = "https://oscarstaff.github.io/Oscar/assets/otc-logo.png";
const FEES: [string, string][] = [
  ["Certificate III in Individual Support (Ageing & Disability) including First Aid & CPR", "$1,300"],
  ["Certificate IV Ageing Support with Medication including First Aid & CPR", "$1,500"],
  ["Certificate IV Disability including First Aid & CPR", "$1,500"],
  ["First Aid CPR and Manual Handling", "$200"],
  ["First Aid and CPR", "$125"],
  ["CPR", "$55"],
  ["Manual Handling", "$80"],
];
const PAY: [string, string][] = [
  ["Account Name", "Oscar Training Centre"],
  ["BSB", "062235"],
  ["Account Number", "11104627"],
  ["Description / Reference", "[Your Name] + The Certificate you are proceeding with"],
];

export function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export type ClassInfo = { iso?: string; start?: string; end?: string };
// the weekday, month and day are worked out from the date itself, so they cannot disagree with it
function parts(date: string, iso?: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "") || (() => { const x = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date || ""); return x ? [x[0], x[3], x[2], x[1]] : null; })();
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return { y, mo, d, wd: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() };
}
const p2 = (n: number) => String(n).padStart(2, "0");
// "08:45" -> "084500"; anything else -> the standard class day
const hhmmss = (t: string | undefined, fallback: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? p2(Number(m[1])) + m[2] + "00" : fallback; };
function calendarUrl(pp: { y: number; mo: number; d: number }, c: ClassInfo, time: string) {
  const day = `${pp.y}${p2(pp.mo)}${p2(pp.d)}`;
  const q = new URLSearchParams({
    action: "TEMPLATE", text: "First Aid and CPR class", ctz: "Australia/Sydney",
    dates: `${day}T${hhmmss(c.start, "084500")}/${day}T${hhmmss(c.end, "170000")}`,
    location: ADDRESS, details: `Oscars Training Centre First Aid and CPR Team. Please arrive 10 - 15 minutes early for registration. Time: ${time}. Questions: ${PHONE}`,
  });
  return "https://calendar.google.com/calendar/render?" + q.toString();
}
const btn = (href: string, label: string, primary: boolean) =>
  `<td style="border-radius:10px;background:${primary ? BLUE : "#ffffff"};${primary ? "" : `border:2px solid ${BLUE};`}"><a class="bt" href="${href}" style="display:inline-block;padding:${primary ? "13px 24px" : "11px 22px"};font:700 15px ${FONT};color:${primary ? "#ffffff" : BLUE};text-decoration:none">${label}</a></td>`;
const eyebrow = (t: string) => `<div style="font:700 12px ${FONT};letter-spacing:1.6px;text-transform:uppercase;color:${MID};margin-bottom:6px">${esc(t)}</div>`;

export function classConfirmHtml(first: string, date: string, time: string, c: ClassInfo = {}): string {
  const name = esc(first || "Student");
  const pp = parts(date, c.iso);
  const wdLong = pp ? DAYS[pp.wd] : "", dateLine = esc((wdLong ? wdLong + " " : "") + date);
  const cal = pp ? calendarUrl(pp, c, time) : "";

  const tile = pp ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="88" style="width:88px;border-radius:14px;overflow:hidden;border:1px solid ${LINE};background:#ffffff">
      <tr><td align="center" style="background:${MID};padding:7px 0;font:700 12px ${FONT};letter-spacing:1.6px;text-transform:uppercase;color:#ffffff">${MONTHS[pp.mo - 1]} ${pp.y}</td></tr>
      <tr><td align="center" style="padding:6px 0 0;font:800 40px/1.1 ${FONT};color:${BLUE}">${pp.d}</td></tr>
      <tr><td align="center" style="padding:0 0 10px;font:600 12px ${FONT};letter-spacing:1px;text-transform:uppercase;color:${MUTED}">${wdLong.slice(0, 3)}</td></tr>
    </table>` : "";
  const kv = (k: string, v: string, last = false) =>
    `<tr><td style="padding:7px 0;${last ? "" : `border-bottom:1px solid ${LINE};`}"><div style="font:600 11px ${FONT};letter-spacing:.8px;text-transform:uppercase;color:${MUTED}">${k}</div><div style="font:600 15px/1.4 ${FONT};color:${INK};margin-top:2px">${v}</div></td></tr>`;

  const steps: string[] = [
    "Check the attached PDF for <b>quiz access guidance</b> (the quiz for First Aid/CPR/Manual Handling).",
    "Make your <b>payment the day before</b> coming to the class.",
    "Send us a <b>screenshot of the payment</b> before you attend. If you pay from someone else's account, have them include your full name and Date of Birth in the reference.",
    "<b>Arrive 10 - 15 minutes early</b> for your registration to avoid lining up.",
  ];
  const stepRows = steps.map((t, i) =>
    `<tr><td class="sn" valign="top" style="padding:0 14px 14px 0;width:34px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" width="30" height="30" style="width:30px;height:30px;border-radius:15px;background:${SKYSOFT};border:1px solid ${SKY};font:800 14px/30px ${FONT};color:${BLUE}">${i + 1}</td></tr></table></td>` +
    `<td valign="top" style="padding:3px 0 14px;font:15px/1.55 ${FONT};color:${INK}">${t}</td></tr>`).join("");

  const fees = FEES.map(([n, p], i) => {
    const b = i < FEES.length - 1 ? `border-bottom:1px solid ${LINE};` : "";
    return `<tr><td class="fc" style="padding:11px 16px;${b}font:14px/1.45 ${FONT};color:${INK}">${esc(n)}</td><td class="fc" align="right" style="padding:11px 16px;${b}font:800 15px ${FONT};color:${BLUE};white-space:nowrap;vertical-align:top">${esc(p)}</td></tr>`;
  }).join("");
  const pay = PAY.map(([k, v], i) => {
    const b = i < PAY.length - 1 ? `border-bottom:1px solid rgba(255,255,255,.18);` : "";
    const big = k === "BSB" || k === "Account Number";
    return `<tr><td class="pl" style="padding:10px 10px 10px 0;${b}font:600 11px ${FONT};letter-spacing:.8px;text-transform:uppercase;color:#b9dcf7;width:112px;vertical-align:top">${esc(k)}</td><td style="padding:10px 0;${b}font:${big ? "800 19px" : "600 15px"}/1.4 ${FONT};${big ? "letter-spacing:1.2px;" : ""}color:#ffffff;vertical-align:top">${esc(v)}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><style>
@media only screen and (max-width:480px){
  .px{padding-left:20px !important;padding-right:20px !important}
  .hero{padding-top:24px !important;padding-bottom:26px !important}
  .h1{font-size:26px !important}
  .lead{font-size:15px !important;margin-top:8px !important}
  .tile{display:none !important}
  .card{padding:6px 16px !important}
  .sec{padding-top:22px !important}
  .fc{padding:9px 12px !important;font-size:13.5px !important}
  .pc{padding:16px 16px 6px !important}
  .pl{width:92px !important}
  .sn{width:30px !important;padding-right:10px !important}
  .bt{padding-left:16px !important;padding-right:16px !important;font-size:14px !important}
}
</style><title>First Aid and CPR class confirmation</title></head>
<body style="margin:0;padding:0;background:#e6eef6;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#e6eef6">You're booked in: ${dateLine}, ${esc(time)} at Rockdale. Please arrive 10 - 15 minutes early.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e6eef6"><tr><td align="center" class="ow" style="padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#ffffff">

  <tr><td class="px" style="background:#ffffff;padding:18px 32px 16px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:14px"><img src="${LOGO}" width="84" height="64" alt="Oscars Training Centre" style="display:block;border:0;outline:none;width:84px;height:64px"></td>
      <td style="vertical-align:middle"><div style="font:700 14px/1.3 ${FONT};letter-spacing:1.3px;text-transform:uppercase;color:${BLUE}">Oscars Training Centre</div><div style="font:600 13px/1.4 ${FONT};color:${MUTED};margin-top:2px">First Aid and CPR Team</div></td>
    </tr></table>
  </td></tr>

  <tr><td class="px hero" style="background:${BLUE};background-image:linear-gradient(135deg,${BLUE} 0%,${MID} 62%,${SKY} 100%);padding:34px 32px 36px">
    <div style="font:700 12px ${FONT};letter-spacing:1.8px;text-transform:uppercase;color:#bfe3fa">Class confirmed</div>
    <div class="h1" style="font:800 30px/1.2 ${FONT};color:#ffffff;margin-top:8px">You're booked in, ${name}!</div>
    <div class="lead" style="font:16px/1.6 ${FONT};color:#e4f3fd;margin-top:12px">Thank you for choosing us for your training certificate. As discussed, your class is confirmed. We look forward to seeing you at the centre.</div>
  </td></tr>

  <tr><td class="px" style="padding:28px 32px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SOFT};border:1px solid ${LINE};border-radius:16px"><tr><td class="card" style="padding:20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${tile ? `<td class="tile" valign="top" width="88" style="width:88px;padding-right:18px">${tile}</td>` : ""}
        <td valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${kv("Date", dateLine)}
          ${kv("Time", esc(time))}
          ${kv("Venue", esc(ADDRESS))}
          ${kv("Parking", esc(PARKING), true)}
        </table></td>
      </tr></table>
    </td></tr></table>
  </td></tr>
  <tr><td class="px" style="padding:16px 32px 4px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      ${cal ? btn(cal, "Add to calendar", true) + `<td width="10" style="width:10px;font-size:0">&nbsp;</td>` : ""}${btn(DIRECTIONS, "Get directions", !cal)}
    </tr></table>
  </td></tr>

  <tr><td class="px sec" style="padding:34px 32px 6px">${eyebrow("Before your class")}<div style="font:800 21px/1.3 ${FONT};color:${BLUE};margin-bottom:16px">Four quick things</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${stepRows}</table>
  </td></tr>

  <tr><td class="px sec" style="padding:22px 32px 6px">${eyebrow("Fees")}<div style="font:800 21px/1.3 ${FONT};color:${BLUE};margin-bottom:6px">Course fees</div>
    <div style="font:14px/1.5 ${FONT};color:${MUTED};margin-bottom:12px">Please make the payment the day before coming to the class for your easiness.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:14px">${fees}</table>
  </td></tr>

  <tr><td class="px sec" style="padding:24px 32px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BLUE};background-image:linear-gradient(135deg,${BLUE} 0%,${MID} 100%);border-radius:16px"><tr><td class="pc" style="padding:20px 22px 12px">
      <div style="font:700 12px ${FONT};letter-spacing:1.6px;text-transform:uppercase;color:#bfe3fa">Payment details</div>
      <div style="font:800 17px/1.3 ${FONT};color:#ffffff;margin:4px 0 8px">COMMONWEALTH Bank</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${pay}</table>
    </td></tr></table>
    <div style="font:13px/1.55 ${FONT};color:${MUTED};padding:12px 2px 0">Kindly, send us a screenshot of the payment before you attend the classes once made.</div>
  </td></tr>

  <tr><td class="px sec" style="padding:26px 32px 32px">
    <div style="font:800 19px/1.3 ${FONT};color:${BLUE}">Need a hand?</div>
    <div style="font:15px/1.6 ${FONT};color:${INK};margin:6px 0 16px">For any assistance please do not hesitate to contact us at <a href="tel:${PHONE}" style="color:${MID};font-weight:700;text-decoration:none">${PHONE}</a>.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${btn("tel:" + PHONE, "Call " + PHONE, false)}</tr></table>
  </td></tr>

  <tr><td class="px" style="background:${BLUE};padding:18px 32px;font:12px/1.6 ${FONT};color:#bcd9f2">Oscars Training Centre First Aid and CPR Team<br>${esc(ADDRESS)}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
