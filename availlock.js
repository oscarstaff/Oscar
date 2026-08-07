/* ═══════════════════════════════════════════════════════════════════════
   availlock.js — availability is read-only for staff
   Loaded by index.html:  <script src="availlock.js?v=4"></script>

   Separate module by convention — see ARCHITECTURE.md.

   WHY
   Staff were changing availability AFTER the roster had been built from it,
   which silently invalidated shifts already assigned. The fortnightly cut-off
   helped but still left a window where a change could land unnoticed.

   Availability is now set by a manager in ShiftOps (Availability → Weekly
   Grid), which writes straight to staff_availability. Staff can SEE theirs but
   not change it — they ask, and it's updated for them. One place to change it,
   one person accountable for it, and the roster is always built from what's
   actually recorded.

   The screen stays visible on purpose: knowing what the office thinks your
   availability is matters, and it's how someone notices it's wrong.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /** Admins keep the ability to edit from either side. */
  function availLocked(){
    try{ if(typeof myIsAdmin !== 'undefined' && myIsAdmin) return false; }catch(e){}
    return true;
  }

  function availLockMessage(){
    return 'Your availability is managed by the office. If it needs changing, '+
           'speak to your manager and it will be updated for you.';
  }

  /**
   * Banner + input disabling, applied whenever the Availability tab renders.
   * Disabling the controls matters as much as blocking the save: letting
   * someone fill in a form that will be rejected is its own small cruelty.
   */
  function applyAvailLock(){
    var host = document.getElementById('ssec-availability');
    if(!host) return;
    var locked = availLocked();

    var bar = document.getElementById('availLockBar');
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'availLockBar';
      bar.style.cssText = 'border-radius:10px;padding:11px 14px;margin:0 0 14px;'+
                          'font-size:12.5px;line-height:1.5;';
      host.insertBefore(bar, host.firstChild);
    }
    if(locked){
      bar.style.background = '#f8fafc';
      bar.style.border     = '1px solid #e2e8f0';
      bar.style.color      = '#475569';
      bar.innerHTML = '<strong>Set by the office</strong> — ' + availLockMessage();
    }else{
      bar.style.background = '#f0fdf4';
      bar.style.border     = '1px solid #bbf7d0';
      bar.style.color      = '#065f46';
      bar.innerHTML = '<strong>Admin</strong> — you can edit availability here or in ShiftOps.';
    }

    var btn = document.getElementById('availBtn');
    if(btn){
      btn.disabled = locked;
      btn.style.display = locked ? 'none' : '';   // nothing to submit
    }
    host.querySelectorAll('input,select,button').forEach(function(el){
      if(el.id === 'availBtn') return;
      if(el.closest('#availLockBar')) return;
      el.disabled = locked;
      el.style.opacity = locked ? '.6' : '';
      el.style.pointerEvents = locked ? 'none' : '';
    });
  }

  // Kept so existing call sites don't throw; there is no unlock any more.
  function refreshAvailUnlock(){}
  function availWindow(){ return { locked: availLocked() }; }

  window.availWindow        = availWindow;
  window.availLocked        = availLocked;
  window.availLockMessage   = availLockMessage;
  window.applyAvailLock     = applyAvailLock;
  window.refreshAvailUnlock = refreshAvailUnlock;
})();
