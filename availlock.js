/* ═══════════════════════════════════════════════════════════════════════
   availlock.js — availability submission cut-off
   Loaded by index.html:  <script src="availlock.js?v=2"></script>

   Separate module by convention — see ARCHITECTURE.md.

   WHY
   Staff were changing availability AFTER the roster had been built from it,
   which silently invalidated shifts already assigned: someone rostered on
   Thursday could mark themselves unavailable on Thursday and the grid would
   never know.

   THE RULE
   Availability closes 2 DAYS BEFORE each new fortnight starts, giving the
   roster a stable picture to be built from. It reopens when the fortnight
   begins, and whatever you submit then applies to the NEXT fortnight.

   Fortnights are Monday-to-Sunday pairs anchored on Mon 4 May 2026 — the same
   FORTNIGHT_ANCHOR the payroll script uses, so availability, rostering and pay
   all agree on where a fortnight begins.

       fortnight starts:  27 Jul · 10 Aug · 24 Aug · 7 Sep · …
       locked on:         Sat + Sun immediately before each start

   Evaluated in Sydney time, so an 11pm submission isn't judged against
   tomorrow's date.

   TUNING — two constants:
     FORT_ANCHOR    any Monday a fortnight has started on
     CUTOFF_DAYS    how many days before the next fortnight it closes
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var FORT_ANCHOR = '2026-05-04';   // Mon — matches FORTNIGHT_ANCHOR in Apps Script
  var CUTOFF_DAYS = 2;              // closes this many days before a fortnight starts

  function _sydneyToday(){
    var s = new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' });
    var d = new Date(s);
    d.setHours(0,0,0,0);
    return d;
  }
  function _parse(iso){ var d = new Date(iso + 'T00:00:00'); d.setHours(0,0,0,0); return d; }
  function _addDays(d,n){ var x = new Date(d); x.setDate(x.getDate()+n); return x; }
  function _days(a,b){ return Math.round((a-b)/86400000); }
  function _fmt(d){ return d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'}); }
  function _fmtShort(d){ return d.toLocaleDateString('en-AU',{day:'numeric',month:'short'}); }

  /**
   * Where are we in the fortnight?
   * Returns { locked, fortStart, nextFort, cutoff, daysUntilOpen, appliesFrom }.
   */
  function availWindow(){
    var today  = _sydneyToday();
    var anchor = _parse(FORT_ANCHOR);

    // Floor-divide so dates before the anchor still land on a real boundary.
    var elapsed = _days(today, anchor);
    var n = Math.floor(elapsed / 14);
    var fortStart = _addDays(anchor, n * 14);      // fortnight containing today
    var nextFort  = _addDays(fortStart, 14);
    var cutoff    = _addDays(nextFort, -CUTOFF_DAYS);  // last day you can submit

    var locked = today >= cutoff;

    return {
      locked: locked,
      fortStart: fortStart,
      nextFort: nextFort,
      cutoff: cutoff,
      // When locked, submissions reopen at the next fortnight start.
      daysUntilOpen: locked ? _days(nextFort, today) : 0,
      // What a submission made right now would apply to.
      appliesFrom: locked ? _addDays(nextFort, 14) : nextFort
    };
  }

  /** Admins can always change availability — they're the ones fixing mistakes. */
  function availLocked(){
    try{ if(typeof myIsAdmin !== 'undefined' && myIsAdmin) return false; }catch(e){}
    return availWindow().locked;
  }

  function availLockMessage(){
    var w = availWindow();
    if(w.locked){
      var d = w.daysUntilOpen;
      return 'The roster for the fortnight starting ' + _fmt(w.nextFort) +
             ' is being built, so availability is closed. It reopens ' + _fmt(w.nextFort) +
             (d > 0 ? ' (' + d + ' day' + (d === 1 ? '' : 's') + ')' : '') + '.';
    }
    return 'Open until ' + _fmt(w.cutoff) + ' — changes apply from the fortnight starting ' +
           _fmtShort(w.appliesFrom) + '.';
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
      bar.style.background = '#fffbeb';
      bar.style.border     = '1px solid #fde68a';
      bar.style.color      = '#92400e';
      bar.innerHTML = '<strong>Closed for this fortnight</strong> — ' + availLockMessage() +
        '<br><span style="opacity:.85;">Need a change sooner? Speak to your manager.</span>';
    }else{
      bar.style.background = '#f0fdf4';
      bar.style.border     = '1px solid #bbf7d0';
      bar.style.color      = '#065f46';
      bar.innerHTML = '<strong>Open</strong> — ' + availLockMessage();
    }

    var btn = document.getElementById('availBtn');
    if(btn){
      btn.disabled = locked;
      btn.style.opacity = locked ? '.5' : '';
      btn.style.cursor  = locked ? 'not-allowed' : '';
      btn.title = locked ? availLockMessage() : '';
    }
    host.querySelectorAll('input,select,button').forEach(function(el){
      if(el.id === 'availBtn') return;
      if(el.closest('#availLockBar')) return;
      el.disabled = locked;
      el.style.opacity = locked ? '.6' : '';
    });
  }

  window.availWindow      = availWindow;
  window.availLocked      = availLocked;
  window.availLockMessage = availLockMessage;
  window.applyAvailLock   = applyAvailLock;
})();
