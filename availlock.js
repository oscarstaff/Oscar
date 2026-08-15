/* ═══════════════════════════════════════════════════════════════════════
   availlock.js — availability edits apply from NEXT week
   Loaded by index.html:  <script src="availlock.js?v=5"></script>

   Separate module by convention — see ARCHITECTURE.md.

   THE RULE
   What someone submits becomes their standing availability and holds until
   they submit again. The only constraint is WHEN it starts: next Monday, not
   mid-week, because the running week's roster was built from the current
   pattern and changing it underneath invalidates assigned shifts.

   WHY THIS SHAPE
   The roster for the running week is already built from the current pattern.
   Letting a mid-week edit land immediately is how someone rostered on
   Thursday quietly becomes unavailable on Thursday, with nothing telling the
   roster. Deferring to next Monday keeps the current week stable while still
   letting people manage their own availability.

   Mechanically the new pattern is parked in
   staff_availability.pending_availability with its effective-from date, and a
   daily job promotes it. So this file's job is only to SAY when it starts —
   the form stays open.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* Fortnight anchor: 10 Aug 2026 is a fortnight START (Monday). All fortnight
     starts are this date + a multiple of 14 days: 10 Aug, 24 Aug, 7 Sep, …
     Changes never touch the running fortnight (its roster is built), so we
     always defer to the NEXT fortnight start — including when submitted on a
     boundary day itself. */
  var FORTNIGHT_ANCHOR = new Date(2026, 7, 10); // month 7 = August
  FORTNIGHT_ANCHOR.setHours(0,0,0,0);

  /** Start of the next fortnight, Sydney. (Name kept for call sites.) */
  function nextMonday(){
    var s = new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' });
    var d = new Date(s);
    d.setHours(0,0,0,0);
    var DAY = 86400000;
    var diff = Math.floor((d - FORTNIGHT_ANCHOR) / DAY);
    var rem = ((diff % 14) + 14) % 14;        // 0 on a boundary day
    var add = (rem === 0) ? 14 : (14 - rem);  // boundary day -> next fortnight
    var res = new Date(d.getTime() + add * DAY);
    res.setHours(0,0,0,0);
    return res;
  }

  /** Explicit alias so future code reads clearly. */
  function nextFortnightStart(){ return nextMonday(); }

  function fmt(d){
    return d.toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long' });
  }

  /** Nothing is locked any more — the deferral does the work. */
  function availLocked(){ return false; }

  function availLockMessage(){
    return 'Your new availability starts ' + fmt(nextMonday()) +
           ' (the next fortnight) and stays that way until you change it ' +
           'again. This fortnight isn\'t affected — the roster is already set.';
  }

  /**
   * Banner explaining when the change lands.
   *
   * Stating the date matters more than it looks: without it, someone updates
   * their availability on Wednesday, sees no change to Thursday's shift, and
   * assumes it didn't save.
   */
  function applyAvailLock(){
    var host = document.getElementById('ssec-availability');
    if(!host) return;

    var bar = document.getElementById('availLockBar');
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'availLockBar';
      bar.style.cssText = 'border-radius:10px;padding:11px 14px;margin:0 0 14px;'+
                          'font-size:12.5px;line-height:1.5;';
      host.insertBefore(bar, host.firstChild);
    }
    bar.style.background = '#eef2ff';
    bar.style.border     = '1px solid #c7d2fe';
    bar.style.color      = '#3730a3';
    bar.innerHTML = '<strong>Starts next fortnight (' + fmt(nextMonday()) +
                    ')</strong> — ' + availLockMessage();

    // Everything stays editable.
    var btn = document.getElementById('availBtn');
    if(btn){ btn.disabled = false; btn.style.display = ''; btn.style.opacity = ''; }
    host.querySelectorAll('input,select,button').forEach(function(el){
      if(el.closest('#availLockBar')) return;
      el.disabled = false;
      el.style.opacity = '';
      el.style.pointerEvents = '';
    });
  }

  // Kept so existing call sites don't throw.
  function refreshAvailUnlock(){}
  function availWindow(){ return { locked:false, appliesFrom: nextMonday() }; }

  window.availWindow        = availWindow;
  window.availLocked        = availLocked;
  window.availLockMessage   = availLockMessage;
  window.applyAvailLock     = applyAvailLock;
  window.refreshAvailUnlock = refreshAvailUnlock;
  window.availNextMonday      = nextMonday;
  window.availNextFortnight   = nextFortnightStart;
})();
