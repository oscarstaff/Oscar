'use strict';
/* pl-security.js · YatraLine · Two-step login check and the Admin security card.
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   Two-step login, YatraLine side. The 6-digit code is asked in Nexus (it holds the refresh token that a code
   check swaps), so YatraLine never confirms codes itself. It only (1) refuses to open without a code-verified
   session when the switch is on, and (2) shows the admin card: switch, who has set up, reset.
   The database enforces the rule (nex_open() needs aal2), this file only explains it.
   ========================================================= */
function aalNow() { const c = tokenPayload(ss.get('nex_sb_at')); return (c && c.aal) || 'aal1'; }
async function authApi(path) {
  const r = await fetch(SB + '/auth/v1/' + path, { headers: { apikey: KEY, Authorization: 'Bearer ' + await bearer() } });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok && j && (j.error_code === 'session_not_found' || /session from session_id claim.*does not exist/i.test(j.msg || j.message || ''))) { endSession('gone'); throw new Error('session'); }
  if (!r.ok) { const e = new Error((j && (j.msg || j.message)) || ('Request failed (' + r.status + ')')); e.status = r.status; throw e; }
  return j;
}
/* the token stays valid for up to an hour after Supabase ends the session, so ask the login service now and then */
async function sessionAlive() { if (locked) return; try { await authApi('user'); } catch (e) { /* only a dead session locks (authApi does that); a network blip does not */ } }
async function mfaList() { const u = await authApi('user'); return ((u && u.factors) || []).filter(f => f.factor_type === 'totp' && f.status === 'verified'); }
/* runs once before the app is drawn; never resolves when a code is needed and missing */
function mfaGate() {
  return new Promise(async resolve => {
    try {
      const st = await (await api('rpc/nex_mfa_state', { method: 'POST', body: {} })).json();
      if (st && st.required && aalNow() !== 'aal2') {
        const box = $('#mfa'), card = $('#mfaCard');
        card.innerHTML = '<div class="gate-t mfa-t">Enter your code in Nexus</div><p class="mfa-p">YatraLine needs your 6-digit code. Go back to Nexus, open the YatraLine card on the Nodes page, and enter the code from your authenticator app (or set it up if this is your first time).</p>';
        box.hidden = false; return;
      }
    } catch (e) { if (e.message === 'session') return; }
    resolve(true);
  });
}

/* ---------- Admin page card ---------- */
function secCard() {
  return '<div class="nx-card"><div class="nx-card-h"><div><h3>Two-step login</h3><div class="nx-muted">A 6-digit code from an authenticator app, asked in Nexus once per sign-in when a person opens YatraLine.</div></div></div><div id="adSec" class="nx-card-b"><div class="nx-skel" style="width:50%"></div></div></div>';
}
async function bindSec() {
  const box = $('#adSec'); if (!box) return;
  try {
    const st = await (await api('rpc/nex_mfa_state', { method: 'POST', body: {} })).json();
    const mine = (await mfaList())[0] || null, strong = aalNow() === 'aal2';
    let h = '<div class="nx-row-s"><div><b>Your account</b><div class="nx-muted">' + (mine ? 'Two-step login is set up for you.' : 'Not set up yet. Open YatraLine from the Nexus Nodes page to set it up.') + '</div></div></div>';
    if (ME.admin) {
      let roster = [];
      try { roster = await (await api('rpc/nex_mfa_roster', { method: 'POST', body: {} })).json(); } catch (e) {} if (!Array.isArray(roster)) roster = [];
      const unset = roster.filter(r => !r.enrolled).length;
      h += '<hr class="nx-hr"><div class="nx-row-s"><div><b>Required for everyone: ' + (st.required ? 'On' : 'Off') + '</b><div class="nx-muted">' +
        (st.required ? 'YatraLine shows nothing to anyone who has not entered a code this sign-in.' : (mine && strong ? 'Once you turn this on, each person is walked through setup when they next open YatraLine from Nexus.' + (unset ? ' ' + unset + ' of ' + roster.length + ' have not set up yet.' : '') : 'Set up your own code first (open YatraLine from Nexus), then you can turn this on.')) +
        '</div></div><div class="nx-btnrow"><button class="nx-btn ' + (st.required ? '' : 'primary') + ' sm" id="secReq"' + (!st.required && !(mine && strong) ? ' disabled' : '') + '>' + (st.required ? 'Turn off' : 'Require for everyone') + '</button></div></div>';
      h += roster.length ? '<div class="nx-tablewrap" style="margin-top:10px"><table class="nx-table auto tight"><thead><tr><th>Staff member</th><th>Code</th><th></th></tr></thead><tbody>' +
        roster.map(r => '<tr><td>' + esc(r.staff_name) + '</td><td>' + (r.enrolled ? '<span class="nx-pill ok">Set up</span>' : '<span class="nx-pill">Not yet</span>') + '</td><td>' + (r.enrolled && r.staff_name !== ME.name ? '<button class="nx-btn sm" data-reset="' + esc(r.staff_name) + '">Reset</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '';
    }
    box.innerHTML = h;
    const again = () => bindSec();
    if ($('#secReq')) $('#secReq').onclick = async () => {
      const on = !st.required;
      if (!await confirmBox(on ? 'Require the 6-digit code for everyone?' : 'Stop requiring the code?', on ? 'Each person sets up an authenticator app the next time they open YatraLine from Nexus (about a minute). Until they do, they see nothing in YatraLine.' : 'YatraLine goes back to protecting student data with passwords only.', on ? 'Require it' : 'Turn off', !on)) return;
      try { await api('rpc/nex_set_mfa_required', { method: 'POST', body: { p_on: on } }); toast(on ? 'Required for everyone' : 'No longer required'); } catch (e) { toast(e.message, true); }
      again();
    };
    $$('[data-reset]', box).forEach(b => b.onclick = async () => {
      const who = b.dataset.reset;
      if (!await confirmBox('Reset ' + who + '’s code?', 'Use this when they have lost their phone. They set up a new code the next time they open YatraLine from Nexus.', 'Reset', true)) return;
      try { await api('rpc/nex_admin_reset_mfa', { method: 'POST', body: { p_staff: who } }); toast('Reset'); } catch (e) { toast(e.message, true); }
      again();
    });
  } catch (e) { if (e.message !== 'session') box.innerHTML = empty('Could not load', e.message); }
}
