// The First Aid and CPR class confirmation email (used by the nex-send-class-confirm edge function; deployed as email.ts next to index.ts). Plain HTML rules: no buttons, no tracking, no pictures
// (no remote logo, no yellow highlighting: both make an email look like marketing to spam filters); headings are bold coloured text, the key facts sit in one pale box, and the money details in another.
const ADDRESS = "Unit 5, 5 King Street, Rockdale, NSW 2216";
const PARKING = "1 Market Street, Rockdale";
const PHONE = "0402 462 830";
const FEES: [string, string][] = [
  ["Certificate III in Individual Support (Ageing & Disability) including First Aid & CPR", "$1,300"],
  ["Certificate IV Ageing Support with Medication including First Aid & CPR", "$1,500"],
  ["Certificate IV Disability including First Aid & CPR", "$1,500"],
  ["First Aid CPR and Manual Handling", "$200"],
  ["First Aid and CPR", "$125"],
  ["CPR", "$55"],
  ["Manual Handling", "$80"],
];
export function esc(s: string) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export type ClassInfo = { iso?: string; start?: string; end?: string; lines?: string[]; span?: string };
function weekday(date: string, iso?: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "") || (() => { const x = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date || ""); return x ? [x[0], x[3], x[2], x[1]] : null; })();
  return m ? DAYS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()] : "";
}
const mark = (t: string) => `<b>${t}</b>`;   // key facts are bold, not highlighted
const H = (t: string) => `<p style="margin:22px 0 8px;font-size:16px;font-weight:bold;color:#1559d6">${t}</p>`;
const BOX = "margin:0 0 14px;padding:12px 16px;background-color:#f3f6fc;border:1px solid #cfd9ee;border-radius:6px";

export function classConfirmHtml(first: string, date: string, time: string, c: ClassInfo = {}): string {
  const name = esc(first || "Student");
  const wd = weekday(date, c.iso);
  const when = esc((wd ? wd + " " : "") + date);
  const p = (t: string) => `<p style="margin:0 0 14px">${t}</p>`;
  const li = (t: string) => `<li style="margin:0 0 4px">${t}</li>`;
  const row = (k: string, v: string) => `<p style="margin:0 0 6px"><span style="color:#555555">${k}:</span> ${v}</p>`;
  const sections = c.lines && c.lines.length
    ? `<p style="margin:10px 0 4px"><span style="color:#555555">Your sections and times:</span></p><ul style="margin:0;padding-left:22px">${c.lines.map((l) => li(`<b>${esc(l)}</b>`)).join("")}</ul>` : "";
  const fees = FEES.map(([n, pr]) => li(`${esc(n)}: <b>${esc(pr)}</b>`)).join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222222">
${p(`Dear ${name},`)}
${p(`Thank you for choosing us for your training certificate. As discussed, <b>your class is confirmed</b>. Here are the details:`)}
<div style="${BOX}">
${row("Date", mark(when))}${row("Time", mark(esc(c.span || time)))}${row("Place", esc(ADDRESS))}${row("Parking", esc(PARKING))}
<p style="margin:0">Please <b>arrive 10 - 15 minutes early</b> for your registration, so you do not have to line up.</p>
${sections}
</div>
${H("Quiz for First Aid / CPR / Manual Handling")}
${p("Please check the attached PDF for quiz access guidance.")}
${H("Fees")}
<ul style="margin:0 0 14px;padding-left:22px">${fees}</ul>
${H("Payment")}
${p(`Please make your ${mark("payment the day before")} the class. Payment details (Commonwealth Bank):`)}
<div style="${BOX}">
${row("Account name", "<b>Oscar Training Centre</b>")}${row("BSB", mark("062235"))}${row("Account number", mark("11104627"))}
<p style="margin:0"><span style="color:#555555">Reference:</span> <b>[Your Name] + the certificate you are proceeding with</b></p>
</div>
${p(`Once paid, kindly send us a ${mark("screenshot of the payment")} before you attend the class. If you are paying from someone else's account, ask them to include your full name and date of birth in the reference.`)}
${p(`For any assistance please contact us on <b>${PHONE}</b>.`)}
<p style="margin:0 0 14px">Kind Regards,<br>Oscars Training Centre<br>First Aid Team<br>P: 0402 462 830<br>E: <a href="mailto:firstaidcpr.oscarstraining@gmail.com">firstaidcpr.oscarstraining@gmail.com</a></p>
</div>`;
}
