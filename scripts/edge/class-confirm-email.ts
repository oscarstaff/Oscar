// The First Aid and CPR class confirmation email (used by the nex-send-class-confirm edge function).
// Deliberately PLAIN: no logo, tables, buttons, gradients or tracking. Heavily designed HTML tends to land in spam, so this reads like an email typed by a person.
// It is still HTML (never text only) so the important parts can be bold and highlighted; the plain-text wording (draft() in index.ts) is sent alongside it.
const ADDRESS = "Unit 5, 5 King Street, Rockdale, NSW 2216";
const PARKING = "1 Market Street Rockdale";
const PHONE = "0402462830";
const FEES: [string, string][] = [
  ["Certificate III in Individual Support (Ageing & Disability) including First Aid & CPR", "$1,300"],
  ["Certificate IV Ageing Support with Medication including First Aid & CPR", "$1,500"],
  ["Certificate IV Disability including First Aid & CPR", "$1,500"],
  ["First Aid CPR and Manual Handling", "$200"],
  ["First Aid and CPR", "$125"],
  ["CPR", "$55"],
  ["Manual Handling", "$80"],
];

export function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export type ClassInfo = { iso?: string; start?: string; end?: string; lines?: string[]; span?: string };   // lines = one row per section this person attends (with times); span = overall time
// the weekday is worked out from the date itself, so it cannot disagree with it
function weekday(date: string, iso?: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "") || (() => { const x = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date || ""); return x ? [x[0], x[3], x[2], x[1]] : null; })();
  return m ? DAYS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()] : "";
}
// the key facts are bold on a pale yellow marker; everything else is ordinary text
const mark = (t: string) => `<b style="background-color:#fff3a3">${t}</b>`;

export function classConfirmHtml(first: string, date: string, time: string, c: ClassInfo = {}): string {
  const name = esc(first || "Student");
  const wd = weekday(date, c.iso);
  const when = esc((wd ? wd + " " : "") + date);
  const li = (t: string) => `<li style="margin:0 0 4px">${t}</li>`;
  const sections = c.lines && c.lines.length
    ? `<p style="margin:0 0 14px">Your sections and times:</p><ul style="margin:0 0 14px;padding-left:22px">${c.lines.map((l) => li(mark(esc(l)))).join("")}</ul>` : "";
  const fees = FEES.map(([n, p]) => li(`${esc(n)}: <b>${esc(p)}</b>`)).join("");
  const p = (t: string) => `<p style="margin:0 0 14px">${t}</p>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222222">
${p(`Dear ${name},`)}
${p(`Thank you for choosing us for your training certificate. As discussed, your class is confirmed for ${mark(when)} (Time: ${mark(esc(c.span || time))}) at ${esc(ADDRESS)}. Please <b>arrive 10 - 15 minutes early</b> for your registration to avoid lining up.`)}
${sections}${p(`Parking: ${esc(PARKING)}`)}
${p(`<b>QUIZ FOR FIRST AID/CPR/MANUAL HANDLING:</b><br>Please check the attached PDF for quiz access guidance.`)}
${p(`Please make the ${mark("payment the day before")} coming to the class for your easiness.`)}
<p style="margin:0 0 6px"><b>Fees:</b></p>
<ul style="margin:0 0 14px;padding-left:22px">${fees}</ul>
<p style="margin:0 0 6px"><b>Payment Details (COMMONWEALTH Bank):</b></p>
<ul style="margin:0 0 14px;padding-left:22px">${li("Account Name: <b>Oscar Training Centre</b>")}${li(`BSB: ${mark("062235")}`)}${li(`Account Number: ${mark("11104627")}`)}${li("Description/Reference: <b>[Your Name] + The Certificate you are proceeding with</b>")}</ul>
${p(`Kindly, send us a ${mark("screenshot of the payment")} before you attend the classes once made. If you are paying from someone else's account, make sure to have them include your full name and Date of Birth in the reference.`)}
${p(`For any assistance please do not hesitate to contact us at <b>${PHONE}</b>.`)}
${p(`Oscars Training Centre First Aid and CPR Team`)}
</div>`;
}
