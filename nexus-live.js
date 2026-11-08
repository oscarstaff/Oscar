/* ════════════════════════════════════════════════════════════════════════
   NEXUS · LIVE ACTIVITY (beta)          needs the Supabase function "live-activity"
   Optional, off by default. When a person turns it on (Profile > Notifications) and clocks in,
   Nexus asks the function to start a WebActivity countdown card and offers an "Add" button.
   Tapping it once puts the card on the iPhone Lock Screen / Dynamic Island (via the WebActivity
   app or its App Clip). Clocking out ends the card. Card text is generic: no names, no places.
   REVERT: remove the <script> for this file and the "Lock Screen" row in Profile.
   ════════════════════════════════════════════════════════════════════════ */
var nxLive = (function(){
  'use strict';
  var URL_ = null;
  function url(){ return URL_ || (URL_ = SB + '/functions/v1/live-activity'); }
  function k(s){ return 'nx_live_' + s + '_' + (typeof me !== 'undefined' ? me : ''); }
  function get(s){ try{ return localStorage.getItem(k(s)); }catch(e){ return null; } }
  function put(s,v){ try{ if(v==null) localStorage.removeItem(k(s)); else localStorage.setItem(k(s),v); }catch(e){} }
  function enabled(){ return get('on') === '1'; }

  function call(body){
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = setTimeout(function(){ try{ ctl && ctl.abort(); }catch(e){} }, 12000);
    return fetch(url(), {
      method:'POST',
      headers:{ 'apikey':KEY, 'Authorization':'Bearer ' + (window._sbAuthToken || KEY), 'Content-Type':'application/json' },
      body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined
    }).then(function(r){ clearTimeout(t); return r.json().catch(function(){ return { ok:false, error:'bad_response' }; }); })
      .catch(function(){ clearTimeout(t); return { ok:false, error:'network' }; });
  }

  /* after a punch has been saved */
  function onPunch(action){
    if(!enabled()) return;
    if(action === 'in'){
      call({ action:'start' }).then(function(r){
        if(r && r.ok && r.redirect){
          put('act', JSON.stringify({ id:r.activityId, c:r.widgetContainerId, at:Date.now() }));
          try{ ccSync.set('live', 'in', { url:r.redirect }); }catch(e){}
        } else {
          try{ ccSync.note('Lock Screen timer isn’t available right now. Your clock-in is fine.'); }catch(e){}
        }
      });
    } else if(action === 'out'){
      var a = null; try{ a = JSON.parse(get('act') || 'null'); }catch(e){}
      put('act', null);
      try{ if(ccSync.mode() === 'live') ccSync.set(''); }catch(e){}
      if(a && a.id && a.c && (Date.now() - a.at) < 15*3600*1000) call({ action:'end', activityId:a.id, widgetContainerId:a.c });
    }
  }

  /* Profile switch */
  function sync(){ var el = document.getElementById('liveActToggle'); if(el) el.checked = enabled(); }
  function toggle(el){
    if(!el.checked){ put('on', null); return; }
    el.disabled = true;
    call({ action:'ping' }).then(function(r){
      el.disabled = false;
      if(r && r.ok && r.configured){
        put('on','1');
        if(typeof showToast === 'function') showToast('Lock Screen timer is on. It appears next time you clock in.','success');
      } else {
        el.checked = false; put('on', null);
        var msg = (r && r.error === 'network') ? 'Couldn’t reach the service. Check your connection.' : 'Lock Screen timer isn’t set up yet. Ask your admin.';
        if(typeof showToast === 'function') showToast(msg,'warning');
      }
    });
  }

  var orig = window.goTo;
  if(typeof orig === 'function' && !orig.__live){
    var w = function(p){ var r = orig.apply(this, arguments); if(p === 'profile') setTimeout(sync, 0); return r; };
    w.__live = true; window.goTo = w;
  }
  return { onPunch:onPunch, toggle:toggle, sync:sync, enabled:enabled };
})();
