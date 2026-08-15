/* ═══════════════════════════════════════════════════════════════════════
   sessionlimit.js — sessions expire after 16 hours
   Loaded by index.html:  <script src="sessionlimit.js?v=2"></script>

   Separate module by convention — see ARCHITECTURE.md.

   WHY
   A staff member was absent and someone else opened his Nexus account and
   clocked in and out. That account also carries ShiftOps and DialTRAC, so
   the roster, everyone's leave, and the full call log were reachable too.
   MFA at login would not have stopped it: if a session is already signed in
   on a shared or unlocked device, there is no login to challenge. What DOES
   stop it is the session not surviving overnight — a session from a previous
   day is exactly what was used.

   WHY 16 HOURS (not 8)
   Staff work 10+ hour shifts. An 8-hour cap logged people out mid-shift every
   day — the limit was firing on normal work, not on the overnight-reuse it
   exists to stop. 16 hours clears the longest realistic shift (plus arriving
   early / running over) while still expiring the SAME day, so a session never
   carries into the next day. That next-day carry is the actual incident this
   guards against, and 16h still prevents it.

   HOW
   Login time is recorded once. Every load, every 5 minutes, and whenever the
   tab becomes visible, the age is checked. Past 16 hours the person is signed
   out through the normal doLogout() path.

   HONEST LIMITS
   This is client-side. It stops "someone walked up to a logged-in laptop",
   which is the actual threat here. It does not stop someone editing
   localStorage. The server-side equivalent is Supabase's session time-box
   setting (Dashboard → Authentication → Sessions) — set that too, and this
   becomes the thing that logs people out promptly rather than the only
   barrier.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var MAX_HOURS = 16;
  var KEY = 'oscars_session_start';
  var CHECK_MS = 5 * 60 * 1000;

  function now(){ return Date.now(); }

  function started(){
    try{
      var v = localStorage.getItem(KEY);
      return v ? parseInt(v, 10) : null;
    }catch(e){ return null; }
  }

  /** Called on a successful login. Resets the clock. */
  function mark(){
    try{ localStorage.setItem(KEY, String(now())); }catch(e){}
  }

  function clear(){
    try{ localStorage.removeItem(KEY); }catch(e){}
  }

  function hoursOld(){
    var s = started();
    if(!s) return 0;
    return (now() - s) / 3600000;
  }

  /**
   * Expire if past the limit.
   *
   * Only acts when someone is actually signed in — firing on the login
   * screen would clear a stale marker and log out nobody, but it would also
   * flash the message at a person who has done nothing.
   */
  function check(){
    var signedIn = false;
    try{ signedIn = !!(typeof me !== 'undefined' && me); }catch(e){}
    if(!signedIn) return;

    var s = started();
    // A session already running when this shipped has no marker. Stamp it now
    // rather than logging everyone out at once on deploy.
    if(!s){ mark(); return; }

    if(hoursOld() >= MAX_HOURS){
      clear();
      try{ showToast('Signed out — sessions end after ' + MAX_HOURS + ' hours'); }catch(e){}
      // Give the toast a moment, then use the normal logout path so realtime,
      // timers and the Supabase session are all torn down properly.
      setTimeout(function(){
        try{ doLogout(); }
        catch(e){ try{ location.reload(); }catch(_){} }
      }, 900);
    }
  }

  window.sessionLimitMark  = mark;
  window.sessionLimitClear = clear;
  window.sessionLimitCheck = check;
  window.sessionLimitAge   = hoursOld;
  window.sessionLimitMax   = function(){ return MAX_HOURS; };

  setInterval(check, CHECK_MS);

  document.addEventListener('visibilitychange', function(){
    if(!document.hidden) check();
  });

  // A tab left open overnight is the case this exists for, so check on load.
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(check, 1500); });
  }else{
    setTimeout(check, 1500);
  }
})();
