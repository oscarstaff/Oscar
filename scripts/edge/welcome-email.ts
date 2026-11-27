// The enrolment email every new lead gets (used by the nex-send-welcome edge function). Plain text first, HTML alongside it.
// The wording is the Enrolment team's own. Change it here, then redeploy nex-send-welcome (index.ts + this file as email.ts).
export const WELCOME_SUBJECT = "Your enrolment with Oscars Training Centre";
const FORM = "https://forms.gle/i5GjLWhp2CzGeCEt8";
const PHONE = "0481487715";

const DOCS = [
  "Passport",
  "One Australian photo ID (Driver Licence, Photo Card, or bank card, cover the CVC)",
  "Current visa, plus any old visas",
  "Most recent academic certificate (onshore or offshore)",
  "COE if you are currently a student",
  "Most recent resume (Word file)",
  "USI number (create or retrieve at www.usi.gov.au)",
];
const CARE_DOCS = ["Current and previous reference letters", "Payslips"];
const NOTES = [
  "Certificate IV in Disability applicants must have completed CHC33021 Certificate III in Individual Support (Ageing & Disability). Please include a copy.",
  "First Aid, CPR and Manual Handling classes are held at Rockdale.",
];
// The Student Centre Team signature (same lines as the support mailbox signature). The plain-text copy and the HTML copy say the same thing.
const SIGN = [
  "Best Regards,",
  "Student Centre Team",
  "Phone: 0481487715 / 0481487720",
  "Landline: 0295997373",
  "Email: support@studentscenter.com.au",
  "       studentcentres2020@gmail.com",
  "Address: Suite 5/5 King St, Rockdale, NSW, 2216",
];
const ADDRESS = "Suite 5/5 King St, Rockdale, NSW, 2216";
const CLOSING = "We can't process your enrolment until we receive the form and all documents. If you have any questions, please do not hesitate to contact us at " + PHONE + ".";

// first = the lead's first name; with no name the email just says "Hello,"
const hi = (first: string) => (first ? `Dear ${first},` : "Hello,");

export function welcomeText(first = ""): string {
  return [
    hi(first),
    "",
    "Thanks for your interest in training with us. To start your enrolment:",
    "",
    "Step 1: Complete the RPL Enrolment Form",
    FORM,
    "",
    "Step 2: Reply with these documents",
    ...DOCS.map((d, i) => `${i + 1}. ${d}`),
    "",
    "If you are working or have worked as a Support Worker in Aged Care or Disability Care, please also send:",
    ...CARE_DOCS.map((d, i) => `${DOCS.length + i + 1}. ${d}`),
    "",
    "Please note:",
    ...NOTES.map((n) => "* " + n),
    "",
    CLOSING,
    "",
    ...SIGN,
  ].join("\n");
}

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LOGO_URL = "https://oscarstaff.github.io/Oscar/assets/otc-email-logo.png";
const MAPS = "https://www.google.com/maps/search/5+King+St,+Rockdale,+NSW,+2216";

// Brand colours taken from the logo. Every text/background pair below is at least 4.5:1.
const NAVY = "#1d4a86";
const SKY = "#5ab4e5";
const INK = "#1f2937";
const MUTED = "#566174";
const PAGE = "#eef3fa";
const FONT = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

const link = (u: string, t: string, color = NAVY) => `<a href="${u}" style="color:${color};text-decoration:underline">${esc(t)}</a>`;

// One numbered step: a navy circle with the number, then the heading and its content.
const step = (n: number, title: string, body: string) => `<tr><td style="padding:28px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="44" valign="top" style="width:44px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="32" height="32" align="center" valign="middle" bgcolor="${NAVY}" style="width:32px;height:32px;border-radius:16px;background-color:${NAVY};color:#ffffff;font:bold 16px/32px ${FONT}">${n}</td></tr></table></td>
<td valign="top" style="font-family:${FONT}"><p style="margin:3px 0 12px;font-size:18px;line-height:26px;font-weight:bold;color:${NAVY}">${title}</p>${body}</td>
</tr></table></td></tr>`;

// A numbered document row (the numbers carry on from the main list into the care-worker list).
const docRow = (n: number, html: string) => `<tr>
<td width="30" valign="top" style="width:30px;padding:0 0 10px;font:bold 15px/22px ${FONT};color:${NAVY}">${n}.</td>
<td valign="top" style="padding:0 0 10px;font:15px/22px ${FONT};color:${INK}">${html}</td></tr>`;
const docTable = (rows: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;

// Contact line in the signature: muted label, normal-weight value.
const sigRow = (label: string, value: string) => `<tr>
<td width="64" valign="top" style="width:64px;padding:0 0 3px;font:13px/20px ${FONT};color:${MUTED}">${label}</td>
<td valign="top" style="padding:0 0 3px;font:14px/20px ${FONT};color:${INK}">${value}</td></tr>`;
const signHtml = () => `<tr><td style="padding:32px 0 0">
<p style="margin:0 0 14px;font:15px/22px ${FONT};color:${INK}">Best Regards,</p>
<p style="margin:0 0 12px;font:bold 17px/24px ${FONT};color:${NAVY}">Student Centre Team</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
${sigRow("Phone", `<a href="tel:0481487715" style="color:${INK};text-decoration:none">0481 487 715</a> &nbsp;/&nbsp; <a href="tel:0481487720" style="color:${INK};text-decoration:none">0481 487 720</a>`)}
${sigRow("Landline", `<a href="tel:0295997373" style="color:${INK};text-decoration:none">(02) 9599 7373</a>`)}
${sigRow("Email", `${link("mailto:support@studentscenter.com.au", "support@studentscenter.com.au")}<br>${link("mailto:studentcentres2020@gmail.com", "studentcentres2020@gmail.com")}`)}
${sigRow("Address", link(MAPS, ADDRESS))}
</table></td></tr>`;

// Email-safe layout (tables and inline styles only, no scripts or tracking). Logo header, two numbered steps with a real button for the form,
// numbered document list, a notice box, and a signature laid out as label/value rows.
export function welcomeHtml(first = ""): string {
  const withUsi = (d: string) => esc(d).replace("www.usi.gov.au", link("https://www.usi.gov.au", "www.usi.gov.au"));
  const p = (t: string, extra = "") => `<p style="margin:0 0 14px;font:15px/24px ${FONT};color:${INK};${extra}">${t}</p>`;
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${NAVY}" style="border-radius:10px;background-color:${NAVY}"><a href="${FORM}" style="display:inline-block;padding:13px 26px;font:bold 15px/20px ${FONT};color:#ffffff;text-decoration:none;border-radius:10px">Open the enrolment form</a></td></tr></table>
<p style="margin:10px 0 0;font:13px/20px ${FONT};color:${MUTED}">Button not working? Copy this link: ${link(FORM, FORM)}</p>`;
  const careBox = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 0"><tr><td bgcolor="#eaf4fc" style="padding:14px 16px 4px;background-color:#eaf4fc;border:1px solid #bddcf2;border-radius:10px">
<p style="margin:0 0 10px;font:bold 14px/21px ${FONT};color:${NAVY}">Support Worker in Aged Care or Disability Care?</p>
<p style="margin:0 0 10px;font:14px/21px ${FONT};color:${INK}">If you are working or have worked as a Support Worker, please also send:</p>
${docTable(CARE_DOCS.map((d, i) => docRow(DOCS.length + i + 1, esc(d))).join(""))}
</td></tr></table>`;
  const notes = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#f6f8fb" style="padding:16px 18px 6px;background-color:#f6f8fb;border:1px solid #dde4ef;border-radius:10px">
<p style="margin:0 0 10px;font:bold 15px/22px ${FONT};color:${NAVY}">Please note</p>
${NOTES.map((n) => `<p style="margin:0 0 10px;font:14px/21px ${FONT};color:${INK}">${esc(n)}</p>`).join("")}
</td></tr></table>`;
  const closing = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#fff6e0" style="padding:14px 18px;background-color:#fff6e0;border:1px solid #f0d58a;border-radius:10px;font:15px/23px ${FONT};color:${INK}"><b>We can't process your enrolment until we receive the form and all documents.</b> If you have any questions, please do not hesitate to contact us at <a href="tel:${PHONE}" style="color:${NAVY}">${PHONE}</a>.</td></tr></table>`;
  return `<div style="margin:0;padding:0;background-color:${PAGE}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${PAGE}">Two quick steps to start your enrolment: the form, then your documents.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE}" style="background-color:${PAGE}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
<tr><td bgcolor="${SKY}" height="6" style="height:6px;line-height:6px;font-size:0;background-color:${SKY};border-radius:12px 12px 0 0">&nbsp;</td></tr>
<tr><td bgcolor="#ffffff" align="center" style="padding:28px 24px 8px;background-color:#ffffff"><img src="${LOGO_URL}" width="168" alt="Oscars Training Centre" style="display:block;width:168px;max-width:100%;height:auto;border:0"></td></tr>
<tr><td bgcolor="#ffffff" style="padding:8px 32px 36px;background-color:#ffffff;border-radius:0 0 12px 12px;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:12px 0 0"><h1 style="margin:0 0 10px;font:bold 26px/32px ${FONT};color:${NAVY};letter-spacing:-0.01em">Let's get you enrolled</h1>
${p(esc(hi(first)), "font-weight:bold")}
${p("Thanks for your interest in training with us. Please complete <b>both steps</b> below and we'll take it from there.", "margin-bottom:0")}</td></tr>
${step(1, "Complete the RPL Enrolment Form", button)}
${step(2, "Reply with these documents", `${docTable(DOCS.map((d, i) => docRow(i + 1, withUsi(d))).join(""))}${careBox}`)}
<tr><td style="padding:28px 0 18px">${notes}</td></tr>
<tr><td>${closing}</td></tr>
${signHtml()}
</table></td></tr>
</table></td></tr></table></div>`;
}
