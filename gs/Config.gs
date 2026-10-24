// Config.gs — IDs, admin-action list, rate limits, payload caps. No logic.

// ════════════════════════════════════════════════════════════════
// Nexus / Oscar's Apps Script — FULL, SECURITY-HARDENED
// Paste this whole file over your existing script.
//
// ROLLOUT (do in order so you don't lock anyone out):
//   1. Paste this file. Rate limiting + input validation + payload caps go live
//      immediately and need NOTHING from the client.
//   2. TEMPORARILY set Script Property  ADMIN_OVERRIDE_OPEN = 1  so admin
//      actions keep working via the token gate while you wire step 3.
//   3. Update the Nexus client to send  sbAccessToken: <session.access_token>
//      in every relay POST body.
//   4. Confirm admin actions still work, then DELETE the ADMIN_OVERRIDE_OPEN
//      property. Admin actions now require a verified user whose
//      staff_credentials.is_hub_admin = true (managed in Supabase, live).
//
//   Token gate setup (unchanged): set the client to send token: APPS_TOKEN, then
//   run __setApiSecret() once to turn the gate ON. __disableGate() is the
//   emergency off-switch.
// ════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1OoGljzLqJbQGWVR2GzV3iWEfwFCoMVruTPdeClpswrw';
// Opened lazily: only timesheet code opens the sheet, so a sheet problem can no longer break
// logins, password resets, leave, docs or emails (it used to be opened on EVERY request).
let _ssCache = null;
function _ss(){ return _ssCache || (_ssCache = SpreadsheetApp.openById(SPREADSHEET_ID)); }
const DOCS_FOLDER_ID = '15Ix21HGsmYDJAOb3kWb5LWGaF4MremEi';
const FORTNIGHT_ANCHOR = new Date(2026, 4, 4); // Mon 4 May 2026


// ════════════════════════════════════════════════════════════════
// SECURITY CONFIG
// ════════════════════════════════════════════════════════════════
// Actions that may ONLY be called by an admin (see _isAdminCaller).
const ADMIN_ACTIONS = {
  adminSetPw: true, adminRenameAuth: true, offboardStaff: true,
  getReport: true, addLeave: true, removeLeave: true, setAdminFlag: true,
  sendWelcomeEmail: true, deleteLeaveProof: true
};

// Per-action rate limits: max calls per windowMs, keyed by caller+action.
const RATE_LIMITS = {
  resetPwViaSQ:   { max: 5,  windowMs: 15 * 60 * 1000 },  // 5 / 15 min (anti brute-force)
  adminSetPw:     { max: 10, windowMs: 15 * 60 * 1000 },
  offboardStaff:  { max: 10, windowMs: 15 * 60 * 1000 },
  adminRenameAuth:{ max: 10, windowMs: 15 * 60 * 1000 },
  addLeave:       { max: 60, windowMs: 15 * 60 * 1000 },
  removeLeave:    { max: 60, windowMs: 15 * 60 * 1000 },
  punch:          { max: 30, windowMs: 60 * 1000 },
  uploadDoc:      { max: 20, windowMs: 15 * 60 * 1000 },
  uploadTemplate: { max: 20, windowMs: 15 * 60 * 1000 },
  uploadLeaveProof: { max: 20, windowMs: 15 * 60 * 1000 },
  getLeaveProof:    { max: 60, windowMs: 15 * 60 * 1000 },
  deleteLeaveProof: { max: 60, windowMs: 15 * 60 * 1000 },
  sendResetEmail: { max: 5,  windowMs: 15 * 60 * 1000 },
  consumeReset:   { max: 10, windowMs: 15 * 60 * 1000 },
  _default:       { max: 60, windowMs: 60 * 1000 }
};
// Payload caps.
const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024;  // 12 MB total POST body
const MAX_BASE64_BYTES  = 10 * 1024 * 1024;  // 10 MB decoded upload
const MAX_NAME_LEN      = 120;
const MAX_STR_LEN       = 5000;
// Leave proof attachments (medical certificates etc.). Stored in a private Drive folder.
const MAX_LEAVE_PROOF_BYTES = 5 * 1024 * 1024;
const LEAVE_PROOF_MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
