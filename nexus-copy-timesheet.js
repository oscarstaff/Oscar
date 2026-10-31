// ── Rebuild a staff timesheet tab in the Google Sheet from Nexus ────────────────
// Used by Manager Tools > Edit punches. The button calls the Apps Script admin action "rebuildTab"
// (RebuildTab.gs), which rewrites that person's tab from the database, formulas included.
// Nothing is copied or pasted, so the layout cannot land in the wrong place.
//
// Runtime dependencies (defined elsewhere in Nexus): nxConfirm and the fetch wrapper that adds the
// shared token and the admin's login (nexus-core.js), showToast (nexus-notices.js).
// File name kept so index.html's script tag does not move; bump its ?v= whenever this file changes.

function nxRebuildBar(staff){
  var esc = function(s){ return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); };
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;">' +
    '<span style="font-size:11.5px;color:var(--ui-ink-3,#64748b);max-width:52ch;line-height:1.45;">Rebuild writes this person\'s whole tab in the timesheet Google Sheet straight from these records.</span>' +
    '<button type="button" data-staff="' + esc(staff) + '" onclick="nxRebuildSheetTab(this)" ' +
    'style="background:var(--ui-surface-3,#f1f5f9);border:1px solid var(--ui-line,#e2e8f0);font-size:12px;padding:7px 12px;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700;color:var(--accent);">Rebuild sheet tab</button>' +
    '</div>';
}

async function nxRebuildSheetTab(btn){
  if(!btn || btn.dataset.busy === '1') return;
  var staff = btn.dataset.staff;
  if(!staff){ showToast('Pick a staff member first'); return; }
  var ok = await nxConfirm('This rewrites ' + staff + '’s tab in the timesheet Google Sheet from the Nexus clock records, with the formulas. ' +
    'Break and Coffee already in the tab are kept. The old tab is saved as a hidden backup tab in the sheet.',
    { title: 'Rebuild ' + staff + '’s sheet tab?', okText: 'Rebuild tab' });
  if(!ok) return;
  var label = btn.textContent;
  btn.dataset.busy = '1'; btn.textContent = 'Rebuilding… (up to a minute)';
  try{
    var url = (typeof _resetExecUrl === 'function') ? _resetExecUrl() : (localStorage.getItem('oscars_sheet_url') || '');
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'rebuildTab', staff: staff }) });   // token + login are added by the fetch wrapper in nexus-core.js
    var j = await r.json();
    if(j && j.ok) showToast('Rebuilt ' + staff + '’s tab (' + j.days + ' days). The old tab is saved as a hidden backup.');
    else showToast('Rebuild failed: ' + ((j && j.error) || 'unknown error'));
  }catch(e){
    showToast('Rebuild failed: ' + ((e && e.message) || e));
  }finally{
    btn.dataset.busy = '0'; btn.textContent = label;
  }
}
