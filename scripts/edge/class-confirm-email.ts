// HTML version of the First Aid and CPR class confirmation email (used by the nex-send-class-confirm edge function).
// Built the way email clients need it: tables, inline styles, no images, no scripts, a 600px column that shrinks on a phone.
// The wording is the team's own wording; the plain-text version (draft() in index.ts) is sent alongside it.
const NAVY = "#12305a", RED = "#c8372d", INK = "#1d2733", MUTED = "#5b6776", LINE = "#dfe5ec", SOFT = "#f3f6fa";
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const ADDRESS = "Unit 5, 5 King Street, Rockdale, NSW 2216";
const MAP = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("5 King Street, Rockdale NSW 2216");
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
// "18/11/2026" -> "Wednesday 18/11/2026" (the weekday is worked out from the date, so it cannot disagree with it)
function withWeekday(ddmmyyyy: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy || "");
  if (!m) return ddmmyyyy;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return DAYS[d.getUTCDay()] + " " + ddmmyyyy;
}
const h2 = (t: string) =>
  `<tr><td style="padding:26px 32px 8px;font:700 12px ${FONT};letter-spacing:1.4px;text-transform:uppercase;color:${RED}">${esc(t)}</td></tr>`;
const para = (inner: string, pad = "0 32px 12px") =>
  `<tr><td style="padding:${pad};font:15px/1.6 ${FONT};color:${INK}">${inner}</td></tr>`;

export function classConfirmHtml(first: string, date: string, time: string): string {
  const name = esc(first || "Student");
  const when = esc(withWeekday(date));
  const rowKV = (k: string, v: string, last = false) =>
    `<tr><td style="padding:11px 0;${last ? "" : `border-bottom:1px solid ${LINE};`}font:600 12px ${FONT};letter-spacing:.6px;text-transform:uppercase;color:${MUTED};width:96px;vertical-align:top">${k}</td>` +
    `<td style="padding:11px 0;${last ? "" : `border-bottom:1px solid ${LINE};`}font:600 15px/1.45 ${FONT};color:${INK};vertical-align:top">${v}</td></tr>`;
  const fees = FEES.map(([c, p], i) =>
    `<tr><td style="padding:10px 14px;${i < FEES.length - 1 ? `border-bottom:1px solid ${LINE};` : ""}font:14px/1.45 ${FONT};color:${INK}">${esc(c)}</td>` +
    `<td align="right" style="padding:10px 14px;${i < FEES.length - 1 ? `border-bottom:1px solid ${LINE};` : ""}font:700 14px ${FONT};color:${NAVY};white-space:nowrap;vertical-align:top">${esc(p)}</td></tr>`).join("");
  const pay = PAY.map(([k, v], i) =>
    `<tr><td style="padding:9px 0;${i < PAY.length - 1 ? `border-bottom:1px solid ${LINE};` : ""}font:600 12px ${FONT};letter-spacing:.6px;text-transform:uppercase;color:${MUTED};width:112px;vertical-align:top">${esc(k)}</td>` +
    `<td style="padding:9px 0;${i < PAY.length - 1 ? `border-bottom:1px solid ${LINE};` : ""}font:600 15px/1.45 ${FONT};color:${INK};vertical-align:top">${esc(v)}</td></tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>First Aid and CPR class confirmation</title></head>
<body style="margin:0;padding:0;background:#e9eef4;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#e9eef4">Your First Aid and CPR class is confirmed for ${when}, ${esc(time)}. Please arrive 10 - 15 minutes early.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e9eef4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${LINE}">
  <tr><td style="background:#ffffff;padding:20px 32px 18px;border-bottom:1px solid ${LINE}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:16px"><img src="${LOGO}" width="84" height="64" alt="Oscars Training Centre" style="display:block;border:0;outline:none;width:84px;height:64px"></td>
      <td style="vertical-align:middle"><div style="font:700 15px/1.3 ${FONT};letter-spacing:1.2px;text-transform:uppercase;color:${NAVY}">Oscars Training Centre</div><div style="font:600 13px/1.4 ${FONT};color:${MUTED};margin-top:3px">First Aid and CPR Team</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:${NAVY};padding:22px 32px 20px">
    <div style="font:700 24px/1.25 ${FONT};color:#ffffff">First Aid and CPR class confirmed</div>
  </td></tr>
  <tr><td style="background:${RED};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
  ${para(`Dear ${name},`, "28px 32px 10px")}
  ${para("Thank you for choosing us for your training certificate. As discussed, your class is confirmed.", "0 32px 18px")}
  <tr><td style="padding:0 32px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SOFT};border:1px solid ${LINE};border-radius:12px"><tr><td style="padding:6px 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rowKV("Date", when)}
        ${rowKV("Time", esc(time))}
        ${rowKV("Venue", `${esc(ADDRESS)}<br><a href="${MAP}" style="font:600 13px ${FONT};color:#1a5fb4;text-decoration:underline">Open in Maps</a>`)}
        ${rowKV("Parking", esc(PARKING), true)}
      </table>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:14px 32px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff4e5;border-left:4px solid #f59e0b;border-radius:6px"><tr><td style="padding:12px 16px;font:600 14px/1.5 ${FONT};color:#7a4a00">Please arrive 10 - 15 minutes early for your registration to avoid lining up.</td></tr></table>
  </td></tr>

  ${h2("Quiz for First Aid/CPR/Manual Handling")}
  ${para("Please check the attached PDF for quiz access guidance.")}

  ${h2("Payment")}
  ${para("Please make the payment the day before coming to the class for your easiness.", "0 32px 14px")}
  <tr><td style="padding:0 32px 6px">
    <div style="font:700 15px ${FONT};color:${NAVY};margin-bottom:8px">Fees</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:10px">${fees}</table>
  </td></tr>
  <tr><td style="padding:20px 32px 6px">
    <div style="font:700 15px ${FONT};color:${NAVY};margin-bottom:8px">Payment Details (COMMONWEALTH Bank)</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SOFT};border:1px solid ${LINE};border-radius:12px"><tr><td style="padding:6px 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${pay}</table>
    </td></tr></table>
  </td></tr>
  ${para("Kindly, send us a screenshot of the payment before you attend the classes once made. If you are paying from someone else's account, make sure to have them include your full name and Date of Birth in the reference.", "16px 32px 14px")}

  <tr><td style="padding:6px 32px 8px;font:15px/1.6 ${FONT};color:${INK}">For any assistance please do not hesitate to contact us at <a href="tel:${PHONE}" style="color:#1a5fb4;font-weight:700;text-decoration:none">${PHONE}</a>.</td></tr>
  <tr><td style="padding:8px 32px 30px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${NAVY};border-radius:10px"><a href="tel:${PHONE}" style="display:inline-block;padding:12px 26px;font:700 15px ${FONT};color:#ffffff;text-decoration:none">Call ${PHONE}</a></td></tr></table>
  </td></tr>
  <tr><td style="background:${SOFT};border-top:1px solid ${LINE};padding:16px 32px;font:12px/1.6 ${FONT};color:${MUTED}">Oscars Training Centre First Aid and CPR Team<br>${esc(ADDRESS)}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
