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
const SIGN = ["Kind regards,", "Oscars Training Centre Support"];
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
    "Step 2: Reply with the following documents",
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
const logo = () => `<p style="margin:0"><img src="${LOGO_URL}" width="200" alt="Oscars Training Centre" style="display:block;width:200px;max-width:100%;height:auto;border:0"></p>`;
const mark = (t: string) => `<b style="background-color:#fff3a3">${t}</b>`;
const H = (n: string, t: string) => `<p style="margin:22px 0 8px;font-size:16px;font-weight:bold;color:#1559d6">${n} ${t}</p>`;
const BOX = "margin:0 0 14px;padding:12px 16px;background-color:#f3f6fc;border:1px solid #cfd9ee;border-radius:6px";

// Plain HTML only (no buttons, tracking or tables): bold coloured step headings, the form link in a pale box, the key items highlighted, the logo under the signature.
export function welcomeHtml(first = ""): string {
  const link = (u: string, t: string) => `<a href="${u}" style="color:#0e4a82">${esc(t)}</a>`;
  const withUsi = (d: string) => esc(d).replace("www.usi.gov.au", link("https://www.usi.gov.au", "www.usi.gov.au"));
  const li = (t: string) => `<li style="margin:0 0 5px">${t}</li>`;
  const p = (t: string) => `<p style="margin:0 0 14px">${t}</p>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222222;max-width:640px">
${p(esc(hi(first)))}
${p("Thanks for your interest in training with us. To start your enrolment, please complete <b>both steps</b> below.")}
${H("Step 1:", "Complete the RPL Enrolment Form")}
<div style="${BOX}">${mark(link(FORM, FORM))}</div>
${H("Step 2:", "Reply with the following documents")}
<ol style="margin:0 0 14px;padding-left:24px">${DOCS.map((d) => li(withUsi(d))).join("")}</ol>
<p style="margin:0 0 6px"><i>If you are working or have worked as a Support Worker in Aged Care or Disability Care, please also send:</i></p>
<ol start="${DOCS.length + 1}" style="margin:0 0 14px;padding-left:24px">${CARE_DOCS.map((d) => li(esc(d))).join("")}</ol>
<p style="margin:22px 0 8px;font-size:16px;font-weight:bold;color:#1559d6">Please note</p>
<ul style="margin:0 0 14px;padding-left:22px">${NOTES.map((n) => li(esc(n))).join("")}</ul>
${p(`<b>We can't process your enrolment until we receive the form and all documents.</b> If you have any questions, please do not hesitate to contact us at <a href="tel:${PHONE}" style="color:#0e4a82">${PHONE}</a>.`)}
<p style="margin:0 0 14px;color:#d9640a"><b>${SIGN[0]}</b><br><b>${SIGN[1]}</b><br>P: ${PHONE}</p>
${logo()}
</div>`;
}
