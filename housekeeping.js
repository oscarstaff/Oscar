/* ═══════════════════════════════════════════════════════════════════════
   housekeeping.js — "you're on housekeeping" notice for the Nexus home screen
   Loaded by index.html:  <script src="housekeeping.js?v=1"></script>

   Separate module by convention — see ARCHITECTURE.md.

   SCOPE — deliberately narrow.
   This shows a staff member their CLASS-DAY HOUSEKEEPING duty and nothing
   else. It is NOT part of the work roster: shifts live in roster_shifts and
   are shown under Roster & Shifts. Mixing the two would make "you're on
   chairs Wednesday" look like "you're rostered Wednesday", which is exactly
   the confusion to avoid. Hence a separate banner, separate wording, and no
   shift information in it at all.

   Only PUBLISHED days are shown (housekeeping_published), so a duty being
   shuffled around in ShiftOps doesn't flicker on someone's phone.

   Sits above the clock card because that's the one thing every staff member
   opens on a phone, and the duty matters at the end of that same day.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var TASK_LABEL = {
    chairs:    'Chairs, boards, papers & pens',
    equipment: "Bed lifter & trainer's table",
    waterbin:  'Water & lollies + bring the bin back from Evershine',
    water:     'Water & lollies',
    speak:     'Speaking'
  };

  function _esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _sydneyIso(offsetDays){
    var s = new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' });
    var d = new Date(s);
    if(offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  /**
   * Look for a published duty today or tomorrow. Tomorrow is included so
   * someone finishing a shift knows what's coming — a duty they only learn
   * about on the day is a duty they can't plan around.
   */
  async function loadMyHousekeeping(){
    var host = document.getElementById('hkDutyBanner');
    var card = document.getElementById('clockCard');
    if(!card) return;

    if(!host){
      host = document.createElement('div');
      host.id = 'hkDutyBanner';
      host.style.display = 'none';
      card.parentNode.insertBefore(host, card);
    }

    if(typeof me === 'undefined' || !me){ host.style.display='none'; return; }

    try{
      var today = _sydneyIso(0), tomorrow = _sydneyIso(1);
      var rows = await sbGet('housekeeping_roster',
        '?staff_name=eq.'+encodeURIComponent(me)+
        '&duty_date=in.('+today+','+tomorrow+')'+
        '&select=duty_date,task,team,done');
      if(!rows || !rows.length){ host.style.display='none'; return; }

      // Only show days the manager has published.
      var pub = await sbGet('housekeeping_published',
        '?duty_date=in.('+today+','+tomorrow+')&select=duty_date');
      var pubSet = {};
      (pub||[]).forEach(function(p){ pubSet[p.duty_date] = 1; });

      var visible = rows.filter(function(r){ return pubSet[r.duty_date]; });
      if(!visible.length){ host.style.display='none'; return; }

      // Today wins if there's one for both days.
      visible.sort(function(a,b){ return a.duty_date < b.duty_date ? -1 : 1; });
      render(host, visible[0], today);
    }catch(e){
      console.warn('[housekeeping] load failed', e);
      host.style.display = 'none';   // never block the clock card
    }
  }

  function render(host, duty, todayIso){
    var isToday = duty.duty_date === todayIso;
    var when = isToday ? 'today' : 'tomorrow';
    var task = TASK_LABEL[duty.task] || duty.task || '';

    host.style.display = '';
    host.innerHTML =
      '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;'+
        'padding:13px 15px;margin-bottom:12px;display:flex;align-items:center;gap:12px;">'+
        '<div style="width:34px;height:34px;border-radius:9px;background:#fef3c7;flex-shrink:0;'+
          'display:flex;align-items:center;justify-content:center;">'+
          '<svg width="18" height="18" viewBox="0 0 20 20" fill="#b45309"><path d="M10 2a1 1 0 00-1 1v1.07A6 6 0 004 10v4l-1.3 1.3A1 1 0 003.4 17h13.2a1 1 0 00.7-1.7L16 14v-4a6 6 0 00-5-5.93V3a1 1 0 00-1-1z"/></svg>'+
        '</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:13.5px;font-weight:750;color:#92400e;">'+
            'You\'re on class housekeeping '+when+
            (duty.done ? ' <span style="font-weight:600;color:#065f46;">— marked done</span>' : '')+
          '</div>'+
          (task
            ? '<div style="font-size:12.5px;color:#a16207;margin-top:2px;line-height:1.4;">'+_esc(task)+'</div>'
            : '')+
          '<div style="font-size:11px;color:#b45309;opacity:.8;margin-top:3px;">'+
            'After class, around 5:30pm.</div>'+
        '</div>'+
      '</div>';
  }

  window.loadMyHousekeeping = loadMyHousekeeping;
})();
