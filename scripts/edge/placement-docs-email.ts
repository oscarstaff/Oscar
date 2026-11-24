// The "documents required before your placement" email (used by the nex-send-placement-docs edge function).
// Deliberately PLAIN: no tables, buttons, gradients or tracking; the only picture is the logo under the signature. Heavily designed HTML tends to land in spam, so this reads like an email typed by a person.
// It is still HTML (never text only) so the important parts can be bold and highlighted; the plain-text wording (draft() in index.ts) is sent alongside it.
const PHONE_SHOWN = "0402 608 052";
const LOGO_URL = "https://oscarstaff.github.io/Oscar/assets/otc-email-logo.png";   // the logo sits under the signature; it is hosted with the app (assets/otc-email-logo.png)
const logo = () => `<p style="margin:0"><img src="${LOGO_URL}" width="200" alt="Oscars Training Centre" style="display:block;width:200px;max-width:100%;height:auto;border:0"></p>`;
const MYGOV = "https://my.gov.au";
const POLICE = "https://afpnationalpolicechecks.converga.com.au/";
const NHHI = "https://nhhi.southrock.com/cgi-bin-secure/Home.cgi";
const NDIS = "https://www.ndiscommission.gov.au/workforce/ndis-commission-worker-training-portal/request-access";

export function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const mark = (t: string) => `<b style="background-color:#fff3a3">${t}</b>`;
// a link shows its own address, so the text and the target match
const a = (u: string) => `<a href="${u}">${u}</a>`;

export function placementDocsHtml(first: string, year: string): string {
  const name = esc(first || "Student");
  const p = (t: string) => `<p style="margin:0 0 14px">${t}</p>`;
  const li = (t: string) => `<li style="margin:0 0 10px">${t}</li>`;
  const sub = (items: string[]) => `<ul style="margin:6px 0 0;padding-left:20px">${items.map((t) => `<li style="margin:0 0 3px">${t}</li>`).join("")}</ul>`;
  const docs = [
    `<b>COVID-19 Vaccination Certificate</b> (an additional COVID vaccine is <b>not</b> mandatory). International vaccines must be updated in IHI (students with Medicare can update it in Medicare).<br>To register your vaccine with IHI:${sub([`Go to myGov: ${a(MYGOV)}`, "Register a new ID", "Link service to Individual Healthcare Identifier", "Get an IHI number", "Go to the nearest GP or pharmacy with your passport, vaccine certificate and IHI number"])}`,
    `<b>${esc(year)} Flu Vaccine Proof</b>`,
    `<b>Recent Police Check</b>: select <b>&ldquo;Commonwealth Employment&rdquo;</b> (Reason 37). Apply here: ${a(POLICE)}`,
    `<b>Australian ID</b>: photo ID or Australian Driver&rsquo;s Licence`,
    `<b>Hand Hygiene Certificate</b>: from the Aged Care modules (<i>Hand hygiene for clinical healthcare workers</i> or <i>Hand Hygiene Hand Dermatitis Online Learning Module</i>). <b>Not Dental.</b> Complete here: ${a(NHHI)}`,
    `<b>Basics of Infection Control Module for Aged Care</b> (not the &ldquo;Train the Trainer&rdquo; module). Complete here: ${a(NHHI)}`,
    `<b>NDIS Orientation Module</b>. Complete here: ${a(NDIS)}`,
  ];
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222222">
${p(`Dear ${name},`)}
${p(`Please ensure these documents are ready before placement and send them to us as soon as possible. ${mark("Your placement waiting time begins once all required documents are submitted.")} Please check the <b>attachment</b> for help in accessing the online learning modules.`)}
<p style="margin:0 0 8px"><b>Required Documents:</b></p>
<ol style="margin:0 0 14px;padding-left:22px">${docs.map(li).join("")}</ol>
${p(`If you haven&rsquo;t already submitted your ${mark("Passport and Visa")}, please submit them now as they are requirements for placement.`)}
${p(`Please complete the modules on a ${mark("laptop or PC")} so the certificates download properly.`)}
${p(`If you have questions, please call us at <b>${PHONE_SHOWN}</b>. Thank you.`)}
<p style="margin:0 0 14px">Regards,<br>Oscars Training Centre</p>
${logo()}
</div>`;
}
