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
  "First Aid, CPR and Manual Handling classes are held at Rockdale college.",
];
const SIGN = ["Kind regards,", "Oscars Training Centre Support"];
const CLOSING = "We can't process your enrolment until we receive the form and all documents. If you have any questions, please do not hesitate to contact us at " + PHONE + ".";

// first = the lead's first name; with no name the email just says "Hi,"
const hi = (first: string) => (first ? `Hi ${first},` : "Hi,");

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
const FONT = "font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1b2733";

export function welcomeHtml(first = ""): string {
  const link = (u: string, t: string) => `<a href="${u}" style="color:#0e4a82">${esc(t)}</a>`;
  const withUsi = (d: string) => esc(d).replace("www.usi.gov.au", link("https://www.usi.gov.au", "www.usi.gov.au"));
  return `<div style="${FONT};max-width:640px">
<p style="margin:0 0 14px">${esc(hi(first))}</p>
<p style="margin:0 0 14px">Thanks for your interest in training with us. To start your enrolment:</p>
<p style="margin:0 0 6px"><b>Step 1:</b> Complete the RPL Enrolment Form</p>
<p style="margin:0 0 14px">${link(FORM, FORM)}</p>
<p style="margin:0 0 6px"><b>Step 2:</b> Reply with the following documents</p>
<ol style="margin:0 0 14px;padding-left:22px">${DOCS.map((d) => `<li>${withUsi(d)}</li>`).join("")}</ol>
<p style="margin:0 0 6px">If you are working or have worked as a Support Worker in Aged Care or Disability Care, please also send:</p>
<ol start="${DOCS.length + 1}" style="margin:0 0 14px;padding-left:22px">${CARE_DOCS.map((d) => `<li>${esc(d)}</li>`).join("")}</ol>
<p style="margin:0 0 6px"><b>Please note:</b></p>
<ul style="margin:0 0 14px;padding-left:22px">${NOTES.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
<p style="margin:0">${esc(CLOSING).replace(PHONE, `<a href="tel:${PHONE}" style="color:#0e4a82">${PHONE}</a>`)}</p>
<p style="margin:14px 0 0">${SIGN.map(esc).join("<br>")}</p>
</div>`;
}
