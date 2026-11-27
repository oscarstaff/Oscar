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
    "Step 2: Reply to this email with these documents:",
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
const MAPS = "https://www.google.com/maps/search/5+King+St,+Rockdale,+NSW,+2216";

// A plain email, the way a person would type it in Gmail: normal text, bold step headings, real numbered and bulleted lists
// (each item on its own line), and the signature as simple lines. No logo, boxes, buttons or tables.
export function welcomeHtml(first = ""): string {
  const a = (u: string, t: string) => `<a href="${u}">${esc(t)}</a>`;
  const withUsi = (d: string) => esc(d).replace("www.usi.gov.au", a("https://www.usi.gov.au", "www.usi.gov.au"));
  const p = (t: string) => `<p style="margin:0 0 14px">${t}</p>`;
  const li = (t: string) => `<li style="margin:0 0 4px">${t}</li>`;
  const list = (tag: "ol" | "ul", items: string[], start = 1) =>
    `<${tag}${tag === "ol" && start !== 1 ? ` start="${start}"` : ""} style="margin:0 0 14px;padding:0 0 0 28px">${items.map(li).join("")}</${tag}>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222">
${p(esc(hi(first)))}
${p("Thanks for your interest in training with us. To start your enrolment:")}
${p(`<b>Step 1:</b> Complete the ${a(FORM, "RPL Enrolment Form")}.`)}
${p("<b>Step 2:</b> Reply to this email with these documents:")}
${list("ol", DOCS.map(withUsi))}
${p("If you are working or have worked as a Support Worker in Aged Care or Disability Care, please also send:")}
${list("ol", CARE_DOCS.map(esc), DOCS.length + 1)}
${p("<b>Please note:</b>")}
${list("ul", NOTES.map(esc))}
${p(`<b>We can't process your enrolment until we receive the form and all documents.</b> If you have any questions, please do not hesitate to contact us at ${a("tel:" + PHONE, PHONE)}.`)}
<p style="margin:0 0 2px">Best Regards,</p>
<p style="margin:0 0 2px"><b>Student Centre Team</b></p>
<p style="margin:0">Phone: 0481487715 / 0481487720<br>Landline: 0295997373<br>Email: ${a("mailto:support@studentscenter.com.au", "support@studentscenter.com.au")}<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${a("mailto:studentcentres2020@gmail.com", "studentcentres2020@gmail.com")}<br>Address: ${a(MAPS, ADDRESS)}</p>
</div>`;
}
