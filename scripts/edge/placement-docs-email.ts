// HTML version of the "documents required before your placement" email (used by the nex-send-placement-docs edge function).
// Built the way email clients need it: tables, inline styles, a column that fills the whole window (edge to edge, like the class confirmation email), one hosted logo image.
// The wording is the Placement team's own wording, reorganised so it can be scanned; the plain-text version (draft() in index.ts) is sent alongside it.
const BLUE = "#0e4a82", MID = "#1b78c2", SKY = "#4fc3f0", SKYSOFT = "#eaf6fd", INK = "#1b2733", MUTED = "#5b6776", LINE = "#dde6ef", SOFT = "#f4f8fc", AMBER = "#fff6e0", AMBERLINE = "#f0d58a", AMBERINK = "#6b4a00";
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const PHONE = "0402608052", PHONE_SHOWN = "0402 608 052";
// the OTC mark (assets/otc-logo.png in the repo), served by GitHub Pages; 252px wide for a 2x display at 84px
const LOGO = "https://oscarstaff.github.io/Oscar/assets/otc-logo.png";
const MYGOV = "https://my.gov.au";
const POLICE = "https://afpnationalpolicechecks.converga.com.au/";
const NHHI = "https://nhhi.southrock.com/cgi-bin-secure/Home.cgi";
const NDIS = "https://www.ndiscommission.gov.au/workforce/ndis-commission-worker-training-portal/request-access";

export function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const btn = (href: string, label: string, primary: boolean) =>
  `<td style="border-radius:10px;background:${primary ? BLUE : "#ffffff"};${primary ? "" : `border:2px solid ${BLUE};`}"><a class="bt" href="${href}" style="display:inline-block;padding:${primary ? "11px 20px" : "9px 18px"};font:700 14px ${FONT};color:${primary ? "#ffffff" : BLUE};text-decoration:none">${label}</a></td>`;
const eyebrow = (t: string) => `<div style="font:700 12px ${FONT};letter-spacing:1.6px;text-transform:uppercase;color:${MID};margin-bottom:6px">${esc(t)}</div>`;

type Doc = { title: string; body?: string; link?: [string, string]; steps?: { head: string; items: string[] } };

export function placementDocsHtml(first: string, year: string): string {
  const name = esc(first || "Student");
  const docs: Doc[] = [
    {
      title: "COVID-19 Vaccination Certificate",
      body: "An additional COVID vaccine is <b>not</b> mandatory. International vaccines must be updated in IHI (students with Medicare can update it in Medicare).",
      steps: { head: "To register your vaccine with IHI", items: [
        `Go to myGov: <a href="${MYGOV}" style="color:${MID};font-weight:700">my.gov.au</a>`,
        "Register a new ID",
        "Link the service: Individual Healthcare Identifier",
        "Get an IHI number",
        "Go to the nearest GP or pharmacy with your passport, vaccine certificate and IHI number",
      ] },
    },
    { title: `${esc(year)} Flu Vaccine Proof` },
    { title: "Recent Police Check", body: "Select <b>&ldquo;Commonwealth Employment&rdquo;</b> (Reason 37).", link: [POLICE, "Apply for a police check"] },
    { title: "Australian ID", body: "Photo ID or an Australian Driver&rsquo;s Licence." },
    { title: "Hand Hygiene Certificate", body: "From the Aged Care modules: <i>Hand hygiene for clinical healthcare workers</i> or <i>Hand Hygiene Hand Dermatitis Online Learning Module</i>. <b>Not Dental.</b>", link: [NHHI, "Open the learning modules"] },
    { title: "Basics of Infection Control Module for Aged Care", body: "Not the &ldquo;Train the Trainer&rdquo; module.", link: [NHHI, "Open the learning modules"] },
    { title: "NDIS Orientation Module", link: [NDIS, "Open the NDIS module"] },
  ];

  const docRows = docs.map((d, i) => {
    const steps = d.steps ? `<div style="margin:10px 0 0;padding:12px 14px;background:${SOFT};border:1px solid ${LINE};border-radius:12px"><div style="font:700 11px ${FONT};letter-spacing:.8px;text-transform:uppercase;color:${MUTED};margin-bottom:6px">${esc(d.steps.head)}</div>` +
      d.steps.items.map((t, k) => `<div style="font:14px/1.55 ${FONT};color:${INK};padding:2px 0"><span style="color:${MID};font-weight:800">${k + 1}.</span>&nbsp; ${t}</div>`).join("") + `</div>` : "";
    const link = d.link ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px"><tr>${btn(d.link[0], d.link[1], false)}</tr></table>` : "";
    const b = i < docs.length - 1 ? `border-bottom:1px solid ${LINE};` : "";
    return `<tr><td class="sn" valign="top" style="padding:16px 0 16px 16px;width:46px;${b}"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" width="30" height="30" style="width:30px;height:30px;border-radius:15px;background:${SKYSOFT};border:1px solid ${SKY};font:800 14px/30px ${FONT};color:${BLUE}">${i + 1}</td></tr></table></td>` +
      `<td class="dc" valign="top" style="padding:16px 16px 16px 6px;${b}"><div style="font:800 16px/1.4 ${FONT};color:${BLUE}">${d.title}</div>${d.body ? `<div style="font:14px/1.55 ${FONT};color:${INK};margin-top:4px">${d.body}</div>` : ""}${steps}${link}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><style>
@media only screen and (max-width:480px){
  .px{padding-left:20px !important;padding-right:20px !important}
  .hero{padding-top:24px !important;padding-bottom:26px !important}
  .h1{font-size:26px !important}
  .lead{font-size:15px !important;margin-top:8px !important}
  .sec{padding-top:22px !important}
  .sn{width:38px !important;padding-left:10px !important}
  .dc{padding-right:12px !important}
  .bt{padding-left:14px !important;padding-right:14px !important;font-size:13.5px !important}
}
</style><title>Documents required before your placement</title></head>
<body style="margin:0;padding:0;background:#e6eef6;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#e6eef6">Seven documents to send us before your placement. Your waiting time starts once we have them all.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e6eef6"><tr><td align="center" class="ow" style="padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#ffffff">

  <tr><td class="px" style="background:#ffffff;padding:18px 32px 16px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:14px"><img src="${LOGO}" width="84" height="64" alt="Oscars Training Centre" style="display:block;border:0;outline:none;width:84px;height:64px"></td>
      <td style="vertical-align:middle"><div style="font:700 14px/1.3 ${FONT};letter-spacing:1.3px;text-transform:uppercase;color:${BLUE}">Oscars Training Centre</div><div style="font:600 13px/1.4 ${FONT};color:${MUTED};margin-top:2px">Placement Team</div></td>
    </tr></table>
  </td></tr>

  <tr><td class="px hero" style="background:${BLUE};background-image:linear-gradient(135deg,${BLUE} 0%,${MID} 62%,${SKY} 100%);padding:34px 32px 36px">
    <div style="font:700 12px ${FONT};letter-spacing:1.8px;text-transform:uppercase;color:#bfe3fa">Before your placement</div>
    <div class="h1" style="font:800 30px/1.2 ${FONT};color:#ffffff;margin-top:8px">Hi ${name}, let&rsquo;s get your documents ready</div>
    <div class="lead" style="font:16px/1.6 ${FONT};color:#e4f3fd;margin-top:12px">Please have these documents ready before placement and send them to us as soon as possible.</div>
  </td></tr>

  <tr><td class="px" style="padding:28px 32px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${AMBER};border:1px solid ${AMBERLINE};border-radius:14px"><tr><td style="padding:14px 18px;font:15px/1.55 ${FONT};color:${AMBERINK}"><b>Your placement waiting time begins once all required documents are submitted.</b></td></tr></table>
  </td></tr>

  <tr><td class="px sec" style="padding:28px 32px 6px">${eyebrow("Required documents")}<div style="font:800 21px/1.3 ${FONT};color:${BLUE};margin-bottom:14px">Seven things to send us</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:14px">${docRows}</table>
  </td></tr>

  <tr><td class="px sec" style="padding:24px 32px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SOFT};border:1px solid ${LINE};border-radius:16px"><tr><td style="padding:18px 20px">
      <div style="font:800 17px/1.3 ${FONT};color:${BLUE};margin-bottom:8px">Also, please note</div>
      <div style="font:15px/1.55 ${FONT};color:${INK};padding:3px 0">&bull;&nbsp; If you haven&rsquo;t already submitted your <b>Passport and Visa</b>, please submit them now. They are requirements for placement.</div>
      <div style="font:15px/1.55 ${FONT};color:${INK};padding:3px 0">&bull;&nbsp; Please complete the modules on a <b>laptop or PC</b> so the certificates download properly.</div>
      <div style="font:15px/1.55 ${FONT};color:${INK};padding:3px 0">&bull;&nbsp; Please check the <b>attachment</b> for help in accessing the online learning modules.</div>
    </td></tr></table>
  </td></tr>

  <tr><td class="px sec" style="padding:26px 32px 32px">
    <div style="font:800 19px/1.3 ${FONT};color:${BLUE}">Questions?</div>
    <div style="font:15px/1.6 ${FONT};color:${INK};margin:6px 0 16px">If you have questions, please call us at <a href="tel:${PHONE}" style="color:${MID};font-weight:700;text-decoration:none">${PHONE_SHOWN}</a>. Thank you.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${btn("tel:" + PHONE, "Call " + PHONE_SHOWN, false)}</tr></table>
  </td></tr>

  <tr><td class="px" style="background:${BLUE};padding:18px 32px;font:12px/1.6 ${FONT};color:#bcd9f2">Oscars Training Centre Placement Team</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
