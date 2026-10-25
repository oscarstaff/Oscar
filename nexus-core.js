/* v1778631856 */
const SB="https://jcfgldqrdbfkgbixszds.supabase.co";
const AUTH_EMAIL_DOMAIN = 'oscars.local';
const AUTH_ONLY_MODE = true;
let _authClient = null;
function getAuthClient(){
  if(_authClient) return _authClient;
  if(window.supabase && window.supabase.createClient){
    const client = window.supabase.createClient(SB, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'oscars_auth' }
    });
    _authClient = client.auth ? client.auth : client;
    try{
      if(_authClient.onAuthStateChange){
        _authClient.onAuthStateChange(function(event, session){
          if(event === 'TOKEN_REFRESHED' && session){
            window._sbAuthToken = session.access_token || window._sbAuthToken;
            try{ if(typeof _realtimeClient!=='undefined' && _realtimeClient && _realtimeClient.realtime && _realtimeClient.realtime.setAuth) _realtimeClient.realtime.setAuth(session.access_token); }catch(e){}
            return;
          }
          if(event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)){
            if(window.me || sessionStorage.getItem('ou')){
              if(!window._authExpiredHandled){
                window._authExpiredHandled = true;
                try{ if(typeof showToast === 'function') showToast('Your session expired — signing you out.', 'info'); }catch(e){}
                setTimeout(function(){ try{ doLogout(); }catch(e){ window.location.reload(); } }, 600);
              }
            }
          }
        });
      }
    }catch(e){ console.warn('[auth] onAuthStateChange wire failed', e); }
  }
  return _authClient;
}
function synthEmailFromName(name){
  const local = String(name).trim().toLowerCase()
    .replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'.').replace(/\.+/g,'.').replace(/^\.|\.$/g,'');
  return local + '@' + AUTH_EMAIL_DOMAIN;
}
let _mustResetPending = false;
const GAS_TOKEN = "oscars_gas_83235a5f0c1f6ba32b18235e2b2d544ac137167d";
(function(){
  if(location.protocol === 'file:') return;
  function sig(s){ let h=5381; for(let i=0;i<s.length;i+=7){ h=((h<<5)+h+s.charCodeAt(i))>>>0; } return h.toString(36)+'-'+s.length; }
  let _lastFgCheck = 0;
  let _updatePending = false;
  let _versionBaselined = false;
  let _lastActivity = Date.now();

  ['pointerdown','keydown','touchstart','scroll'].forEach(function(ev){
    window.addEventListener(ev, function(){ _lastActivity = Date.now(); }, {passive:true});
  });



  function _maybeInactiveReload(){
    if(!_updatePending) return;
    try{ localStorage.removeItem('app_update_pending'); }catch(_){}
    location.reload();
  }

  async function checkAppVersion(){
    try{
      const url = location.href.split('#')[0].split('?')[0] + '?_vchk=' + Date.now();
      const r = await fetch(url, {cache:'no-store'});
      if(!r.ok) return;
      const remote = sig(await r.text());
      const stored = localStorage.getItem('app_deploy_sig');
      if(!stored){ localStorage.setItem('app_deploy_sig', remote); return; }
      if(stored === remote) return;
      if(!_versionBaselined){
        _versionBaselined = true;
        localStorage.setItem('app_deploy_sig', remote);
        return;
      }
      localStorage.setItem('app_deploy_sig', remote);
      localStorage.setItem('app_update_pending', '1');
      _updatePending = true;
      try{ if(window.caches && caches.keys){ const ks = await caches.keys(); await Promise.all(ks.map(function(k){ return caches.delete(k); })); } }catch(e){}
      setTimeout(_maybeInactiveReload, 300);
    }catch(e){ /* offline etc — try again next cycle */ }
  }

  try{ if(localStorage.getItem('app_update_pending') === '1') _updatePending = true; }catch(_){}

  setTimeout(checkAppVersion, 8000);
  setInterval(checkAppVersion, 5*60*1000);
  setInterval(_maybeInactiveReload, 3000);
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){
      setTimeout(_maybeInactiveReload, 500);
      return;
    }
    const now = Date.now();
    _lastActivity = now;
    if(now - _lastFgCheck < 5*60*1000) return;
    _lastFgCheck = now;
    checkAppVersion();
  });
})();

(function(){
  const _origFetch = window.fetch.bind(window);
  window.fetch = function(url, opts){
    try{
      const u = (typeof url === 'string') ? url : (url && url.url) || '';
      if(u.indexOf('script.google.com/macros') !== -1 && opts && opts.body && typeof opts.body === 'string'){
        const b = JSON.parse(opts.body);
        if(b && typeof b === 'object' && b.token === undefined){
          b.token = GAS_TOKEN;
          if(window._sbAuthToken && b.sbAccessToken === undefined){
            b.sbAccessToken = window._sbAuthToken;
          }
          opts = Object.assign({}, opts, { body: JSON.stringify(b) });
        }
      }
      if(window._sbAuthToken &&
         u.indexOf('/rest/v1/') !== -1 && u.indexOf(SB) !== -1){
        const h = Object.assign({}, (opts && opts.headers) || {});
        const cur = h['Authorization'] || h['authorization'] || '';
        if(cur === 'Bearer '+KEY || cur === ''){
          h['Authorization'] = 'Bearer ' + window._sbAuthToken;
          h['apikey'] = KEY;
          opts = Object.assign({}, opts, { headers: h });
        }
      }
    }catch(e){ /* leave request untouched on any issue */ }
    return _origFetch(url, opts);
  };
})();
function esc(s){
  if(s==null) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
const escAttr = esc;
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZmdsZHFyZGJma2diaXhzemRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Nzc3NzEsImV4cCI6MjA5MDE1Mzc3MX0.Wj8cCpnlsoZOPj5sKWeEdfvgjG4Nc-UuTTYgbcrPfeI";
let STAFF=["Abhishek Karki","Anish Dhodari","Anurag Dahal","Bikash Dahal","Kushal Piya","Monika Kawadi","Musica Karki","Nabina Uchchai Thakuri","Nidhi Subedi","Nippu Pokhrel","Pavneet Kaur","Presna Aryal","Prashna Sapkota","Roshana Puri","Sachin Sanwa Limbu","Sagun Panta","Saksham Shrestha","Sami Basnet","Sameekshya Regmi","Sanju Gharti Magar","Sandhya Sangroula","Sanskar Pokharel","Santosh Singh Basnet","Supriya Thapa","Tejaswee Bhetwal","Umisha Ghimire","Usam Adhikari"];

async function loadStaffList(){
  try{
    const rows=await sbGet("staff_names","?order=name.asc");
    if(rows&&rows.length>0){
      STAFF=rows.map(r=>r.name).filter(Boolean).sort();
    }
  }catch(e){console.warn(e);}
}

async function validateStaffName(name){
  try{
    const rows=await sbGet("staff_names","?name=ilike."+encodeURIComponent(name.trim()));
    if(rows&&rows.length>0)return rows[0].name;
    return null;
  }catch(e){
    return STAFF.find(n=>n.toLowerCase().trim()===name.toLowerCase().trim())||null;
  }
}
const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function gMon(d){const r=new Date(d),day=r.getDay();r.setDate(r.getDate()-day+(day===0?-6:1));r.setHours(0,0,0,0);return r;}
function addD(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function fmt(d){return new Date(d).toLocaleDateString("en-AU",{day:"numeric",month:"short"});}
function fmtF(d){return new Date(d).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"});}
function iso(d){return new Date(d).toISOString().split("T")[0];}
function wkL(ws){return fmt(ws)+" \u2013 "+fmt(addD(ws,6));}


let weekStart=gMon(new Date()),rWS=gMon(new Date()),me=null;



function _availEmailPrefUI(on){
  const t=document.getElementById('availEmailPrefToggle');
  const s=document.getElementById('availEmailPrefSub');
  if(t) t.checked=!!on;
  if(s) s.textContent = on
    ? 'We\u2019ll email you a reminder to check your availability.'
    : 'Off. You can still update your availability here any time.';
}
async function loadAvailEmailPref(){
  try{
    const rows = await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=avail_email_optout');
    if(rows && rows.length) _availEmailPrefUI(!rows[0].avail_email_optout);
  }catch(e){ /* leave the default on-state showing */ }
}
async function setAvailEmailPref(on){
  const t=document.getElementById('availEmailPrefToggle');
  if(t) t.disabled=true;
  _availEmailPrefUI(on);
  try{
    const r = await fetch(SB+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(me),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+_sbBearer(),'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({avail_email_optout:!on})
    });
    if(!r.ok) throw new Error('http '+r.status);
    const rows = await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=avail_email_optout');
    if(!rows || !rows.length || !!rows[0].avail_email_optout !== !on) throw new Error('not saved');
    showToast(on ? 'Reminder emails on' : 'Reminder emails off');
  }catch(e){
    _availEmailPrefUI(!on);
    showToast('Couldn\u2019t save that \u2014 please try again');
  }
  if(t) t.disabled=false;
}

/* My Time was split up: Leave is its own page, and Availability now lives on
   My Hours (next to the hours report). showSchedTab stays as a router so the
   many old callers (notifications, home cards, onboarding) keep working. */
function showSchedTab(tab){
  if(tab==='availability'){
    const hp=document.getElementById('page-myhours');
    if(hp && hp.classList.contains('active')) showHoursTab('availability');
    else goTo('availability');
    return;
  }
  const lp=document.getElementById('page-leave');
  if(!(lp && lp.classList.contains('active'))){ goTo('leave'); return; }
  if(typeof setActiveNavChild === 'function') setActiveNavChild('leave');
  loadLeaveHistory();
}

/** My Hours page: switch between the hours report and Availability. */
function showHoursTab(tab){
  if(tab !== 'availability') tab = 'hours';
  const hrs=document.getElementById('rsec-hours'), av=document.getElementById('ssec-availability');
  if(hrs) hrs.style.display = tab==='hours' ? '' : 'none';
  if(av) av.style.display = tab==='availability' ? 'block' : 'none';
  ['hours','availability'].forEach(function(s){
    const b=document.getElementById('htab-'+s);
    if(b) b.classList.toggle('active', s===tab);
  });
  if(typeof setActiveNavChild === 'function') setActiveNavChild('myhours');
  if(tab==='hours'){
    if(typeof runHoursReport === 'function') setTimeout(runHoursReport, 60);
    if(typeof loadFortLeaderboard === 'function') loadFortLeaderboard();
  }
  if(tab==='availability'){
    if(typeof refreshAvailUnlock === 'function') refreshAvailUnlock();
    if(typeof applyAvailLock === 'function') setTimeout(applyAvailLock, 60);
    /* First open: hold the page behind a skeleton until the form/overview decision is made,
       so it doesn't flash the form and then swap to the overview. */
    const sec=document.getElementById('ssec-availability');
    const hold = sec && !window._availShownOnce;
    if(hold) sec.classList.add('av-loading');
    const reveal=function(){ if(sec) sec.classList.remove('av-loading'); window._availShownOnce=true; };
    if(hold) setTimeout(reveal, 5000);   /* never leave it hidden if a request hangs */
    Promise.allSettled([refreshAvailPendingStatus(), loadAvailEmailPref(), checkLock()]).then(reveal);
    if(myIsAdmin){
      document.getElementById('adminAvailSection').style.display='block';
      loadAdminAvailGrid();
    }else{
      document.getElementById('adminAvailSection').style.display='none';
    }
  }
}

let myTeam = '';
let docsData = [];
let _lastUploadedDocId = null;
let _quizBuilder = null;




let docSelectedFileP=null;
function _driveIdFromUrl(url){
  if(!url) return '';
  const m = String(url).match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
            String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
            String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}
async function fetchDriveDocBase64(driveId){
  if(!driveId) throw new Error('No Drive id');
  const sheetUrl = localStorage.getItem('oscars_sheet_url') || 'https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec';
  const r = await fetch(sheetUrl, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({ action:'fetchDoc', id: driveId })
  });
  if(!r.ok) throw new Error('Drive fetch failed: '+r.status);
  const j = await r.json();
  if(!j.ok) throw new Error(j.error || 'Drive fetch failed');
  return j;
}
async function downloadPrivateDoc(url, title){
  const id = _driveIdFromUrl(url);
  if(!id){
    const a=document.createElement('a'); a.href=url; a.download=(title||'document'); a.rel='noopener';
    document.body.appendChild(a); a.click(); a.remove(); return;
  }
  try{
    showToast && showToast('Downloading '+(title||'document')+'…','info');
    const j = await fetchDriveDocBase64(id);
    const bytes = Uint8Array.from(atob(j.base64), c=>c.charCodeAt(0));
    const blob = new Blob([bytes], {type: j.mime || 'application/octet-stream'});
    const blobUrl = URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=blobUrl;
    a.download = j.name || (title||'document');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(blobUrl), 60000);
  }catch(e){
    showToast && showToast('Could not download: '+e.message,'error');
  }
}
async function openPrivateDoc(url, title){
  const id = _driveIdFromUrl(url);
  if(!id){ window.open(url,'_blank','noopener'); return; }
  try{
    showToast && showToast('Opening '+(title||'document')+'…','info');
    const j = await fetchDriveDocBase64(id);
    const bytes = Uint8Array.from(atob(j.base64), c=>c.charCodeAt(0));
    const blob = new Blob([bytes], {type: j.mime || 'application/octet-stream'});
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl,'_blank','noopener');
    setTimeout(()=>URL.revokeObjectURL(blobUrl), 60000);
  }catch(e){
    showToast && showToast('Could not open: '+e.message,'error');
  }
}

async function loadDocuments(){
  try{
    window._docQuizzes = await sbGet('custom_quizzes', '?order=created_at.desc');
    window._myCustomQuizResults = await sbGet('custom_quiz_results', '?staff_name=eq.'+encodeURIComponent(me));
  }catch(e){ window._docQuizzes = []; window._myCustomQuizResults = []; }

  const el = document.getElementById('docsList');
  const adminArea = document.getElementById('docsAdminUpload');
  const sub = document.getElementById('docsSub');
  if(!el) return;
  if(adminArea) adminArea.style.display = myIsAdmin ? 'block' : 'none';
  el.innerHTML = '<div class="skel-card"><div class="skel skel-line" style="width:55%;height:14px;"></div><div class="skel skel-line" style="width:90%;"></div><div class="skel skel-line skel-meta"></div></div><div class="skel-card"><div class="skel skel-line" style="width:42%;height:14px;"></div><div class="skel skel-line" style="width:80%;"></div></div>';
  try{
    if(!myTeam){
      try{
        const creds = await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=team');
        myTeam = (creds.length && creds[0] && creds[0].team) ? creds[0].team : '';
      }catch(e){ myTeam = ''; }
    }
    if(!window.myTeams){
      window.myTeams = myTeam ? [myTeam] : [];
    }
    if(sub) sub.textContent = myTeam ? 'Documents for ' + myTeam + ' team' : 'All documents';

    const r = await fetch(SB+'/rest/v1/documents?order=created_at.desc',{
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Accept':'application/json'}
    });
    if(!r.ok){ el.innerHTML='<div style="color:#dc2626;text-align:center;padding:24px;font-size:13px;">Could not load documents ('+r.status+').</div>'; return; }
    docsData = await r.json();

    const filtered = myIsAdmin ? docsData : docsData.filter(d => {
      if(!d.teams || d.teams.length === 0) return true;
      if(!myTeam) return false;
      return Array.isArray(d.teams) ? d.teams.includes(myTeam) : false;
    });

    renderDocs(filtered);
    if(myIsAdmin) loadDocTeamPicker();
  }catch(e){
    console.warn('loadDocuments error:', e);
    el.innerHTML = '<div style="color:#dc2626;text-align:center;padding:24px;font-size:13px;">Could not load documents. Check your connection.</div>';
  }
}

function renderDocs(docs){
  const el=document.getElementById('docsList');
  if(!el)return;
  if(!docs.length){el.innerHTML='<div style="text-align:center;padding:40px 20px;"><svg width="40" height="40" viewBox="0 0 20 20" fill="#e2e8f0" style="margin:0 auto 12px;display:block;"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg><div style="font-size:14px;font-weight:600;color:var(--ui-ink-2b,#475569);margin-bottom:6px;">No documents yet</div><div style="font-size:12px;color:var(--ui-ink-4,#94a3b8);">Documents shared with your team will appear here.</div></div>';return;}
  const pdfSvg='<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>';
  const linkSvg='<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>';
  el.innerHTML='<div style="display:flex;flex-direction:column;gap:8px;">'+docs.map(function(d){
    const age=(new Date()-new Date(d.created_at))/(1000*60*60*24);
    const isNew=age<3;
    const url=d.url||'#';
    const ext=url.split('.').pop().toLowerCase();
    let iconClass='doc-icon-link', iconSvg=linkSvg;
    if(ext==='pdf'||url.includes('/documents/')){iconClass='doc-icon-pdf';iconSvg=pdfSvg;}
    else if(['doc','docx'].includes(ext)||url.includes('docs.google')){iconClass='doc-icon-doc';iconSvg=pdfSvg;}
    else if(['png','jpg','jpeg','gif','webp'].includes(ext)){iconClass='doc-icon-img';iconSvg=linkSvg;}
    const teamTags=(d.teams&&d.teams.length)?d.teams.map(function(t){return'<span class="doc-team-tag">'+t+'</span>';}).join(''):'';
    const deleteBtn=myIsAdmin?'<button class="doc-delete" data-id="'+d.id+'" onclick="event.preventDefault();event.stopPropagation();deleteDocument(this.dataset.id)">Delete</button>':'';
    const quizzes = (window._docQuizzes||[]).filter(function(q){return q.document_id===d.id;});
    let quizBtn = '';
    if(quizzes.length){
      quizBtn = '<button onclick="event.preventDefault();event.stopPropagation();goTo(\'training\');setTimeout(function(){scrollToTrainingItem(\''+quizzes[0].id+'\');},300);" style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;font-family:inherit;cursor:pointer;margin-right:6px;">Has Quiz</button>';
    } else {
      quizBtn = '<span style="background:var(--ui-surface-3,#f1f5f9);color:var(--ui-ink-4,#94a3b8);font-size:10px;font-weight:600;padding:3px 8px;border-radius:6px;margin-right:6px;">No Quiz</span>';
    }
    const isStorageFile=url.includes('/storage/v1/object/public/');
    const isDriveFile=!!_driveIdFromUrl(url);
    const linkAttr = isDriveFile
      ? 'href="#" onclick="event.preventDefault();openPrivateDoc(\''+url.replace(/'/g,"\\'")+'\',\''+esc(d.title).replace(/'/g,"\\'")+'\')"'
      : (isStorageFile?'href="'+url+'" download':'href="'+url+'" target="_blank" rel="noopener"');
    return'<a '+linkAttr+' class="doc-item">'+
      '<div class="doc-icon '+iconClass+'">'+iconSvg+'</div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'+
          '<span class="doc-title">'+esc(d.title)+'</span>'+
          (isNew?'<span class="doc-badge-new">New</span>':'')+
        '</div>'+
        (teamTags?'<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px;max-height:24px;overflow:hidden;">'+teamTags+'</div>':'')+
      '</div>'+quizBtn+deleteBtn+'</a>';
  }).join('')+'</div>';
}



function filterDocs(){
  const q=document.getElementById('docsSearch').value.toLowerCase().trim();
  if(!q){renderDocs(myIsAdmin?docsData:docsData.filter(d=>!d.teams||d.teams.length===0||(myTeam&&d.teams.includes(myTeam))));return;}
  renderDocs(docsData.filter(d=>d.title.toLowerCase().includes(q)||(d.category||'').toLowerCase().includes(q)));
}

async function loadDocTeamPicker(){
  try{
    const rows=await sbGet('staff_credentials','?select=team&team=not.is.null');
    const teams=[...new Set(rows.map(r=>r.team).filter(Boolean))].sort();
    const picker=document.getElementById('docTeamPicker');
    if(!picker)return;
    picker.innerHTML=teams.map(t=>'<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--ui-ink-2b,#475569);"><input type="checkbox" class="doc-team-cb" value="'+t+'"> '+t+'</label>').join('');
  }catch(e){console.warn(e);}
}

let docSelectedFile = null;

function handleDocFileSelect(input){
  if(input.files&&input.files[0]) setDocFile(input.files[0]);
}
function handleDocDrop(e){
  e.preventDefault();
  document.getElementById('docDropZone').style.borderColor='#e2e8f0';
  document.getElementById('docDropZone').style.background='';
  if(e.dataTransfer.files&&e.dataTransfer.files[0]) setDocFile(e.dataTransfer.files[0]);
}
function setDocFile(file){
  docSelectedFile=file;
  const label=document.getElementById('docDropLabel');
  const zone=document.getElementById('docDropZone');
  if(label){
    label.textContent=file.name;
    label.style.color='var(--accent)';
  }
  zone.style.borderColor='var(--accent)';
  zone.style.background='var(--accent-dim)';
  const titleEl=document.getElementById('docTitle');
  if(titleEl&&!titleEl.value){
    titleEl.value=file.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ');
  }
}

async function uploadDocument(){
  const title=document.getElementById('docTitle').value.trim();
  const err=document.getElementById('docErr'),ok=document.getElementById('docOk');
  const progress=document.getElementById('docProgress');
  const progressBar=document.getElementById('docProgressBar');
  const progressLabel=document.getElementById('docProgressLabel');
  err.classList.remove('show');ok.classList.remove('show');
  if(!title){err.textContent='Please enter a title.';err.classList.add('show');return;}
  if(!docSelectedFile){err.textContent='Please select a file to upload.';err.classList.add('show');return;}
  const teams=Array.from(document.querySelectorAll('.doc-team-cb:checked')).map(cb=>cb.value);
  const btn=document.getElementById('docUploadBtn');
  btn.disabled=true;btn.innerHTML='<span class="sp"></span> Uploading...';
  if(progress)progress.style.display='block';
  try{
    if(progressLabel)progressLabel.textContent='Uploading '+esc(docSelectedFile.name)+' to Drive...';
    if(progressBar)progressBar.style.width='15%';
    const fileData = await new Promise(function(resolve, reject){
      const reader = new FileReader();
      reader.onload = function(){
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(docSelectedFile);
    });
    if(progressBar)progressBar.style.width='40%';
    const sheetUrl = localStorage.getItem('oscars_sheet_url') || 'https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec';
    if(progressLabel)progressLabel.textContent='Sending to Drive...';
    if(progressBar)progressBar.style.width='60%';
    const uploadRes = await fetch(sheetUrl, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({
        action: 'uploadDoc',
        filename: docSelectedFile.name,
        mime: docSelectedFile.type || 'application/octet-stream',
        base64: fileData,
        uploadedBy: me
      })
    });
    if(!uploadRes.ok){
      throw new Error('Drive upload failed: '+uploadRes.status);
    }
    const uploadJson = await uploadRes.json();
    if(!uploadJson.ok){
      throw new Error(uploadJson.error || 'Drive upload failed');
    }
    if(progressBar)progressBar.style.width='80%';
    const fileUrl = uploadJson.url || (uploadJson.id ? 'https://drive.google.com/file/d/'+uploadJson.id+'/view' : '');
    if(!fileUrl) throw new Error('Drive upload returned no file id/url');
    if(progressLabel)progressLabel.textContent='Saving document info...';
    const res=await fetch(SB+'/rest/v1/documents',{
      method:'POST',
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify({title,category:'General',url:fileUrl,teams,uploaded_by:me,is_new:true})
    });
    if(progressBar)progressBar.style.width='100%';
    if(res.ok||res.status===201){
      try{
        const created = await res.json();
        if(created && created[0]) _lastUploadedDocId = created[0].id;
      }catch(e){}
      ok.textContent='Document uploaded successfully!';ok.classList.add('show');
      const attachQuizCb = document.getElementById('docAttachQuiz');
      if(attachQuizCb && attachQuizCb.checked && _lastUploadedDocId){
        showQuizModeChoice(_lastUploadedDocId, document.getElementById('docTitle').value, fileUrl);
        attachQuizCb.checked = false;
      }
      document.getElementById('docTitle').value='';
      document.getElementById('docFile').value='';
      document.getElementById('docDropLabel').textContent='Click to choose a file or drag it here';
      document.getElementById('docDropLabel').style.color='';
      document.getElementById('docDropZone').style.borderColor='#e2e8f0';
      document.getElementById('docDropZone').style.background='';
      document.querySelectorAll('.doc-team-cb').forEach(cb=>cb.checked=false);
      docSelectedFile=null;
      setTimeout(()=>{if(progress)progress.style.display='none';if(progressBar)progressBar.style.width='0%';},800);
      await loadDocuments();
    }else throw new Error('Failed to save document info: '+res.status);
  }catch(e){
    console.warn(e);
    err.textContent=e.message||'Upload failed. Please try again.';
    err.classList.add('show');
    if(progress)progress.style.display='none';
    if(progressBar)progressBar.style.width='0%';
  }finally{
    btn.disabled=false;btn.textContent='Upload Document';
  }
}

async function deleteDocument(id){
  if(!confirm('Delete this document?'))return;
  try{
    await fetch(SB+'/rest/v1/documents?id=eq.'+id,{method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}});
    await loadDocuments();
  }catch(e){console.warn(e);alert('Failed to delete.');}
}



async function getAuthIdentity(){
  try{
    const auth = getAuthClient();
    if(!auth || !auth.getSession) return null;
    const { data } = await auth.getSession();
    const session = data && data.session;
    if(!session) return null;
    const u = session.user || {};
    const nameFromMeta = u.user_metadata && u.user_metadata.staff_name;
    if(nameFromMeta) return nameFromMeta;
    try{
      const rows = await sbGet('staff_credentials','?auth_uid=eq.'+encodeURIComponent(u.id)+'&select=staff_name');
      if(rows.length) return rows[0].staff_name;
    }catch(e){}
    return null;
  }catch(e){ return null; }
}
async function restoreAuthSession(){
  const name = await getAuthIdentity();
  if(name){ await refreshSbAuthToken(); saveMe(name); return true; }
  return false;
}

async function doLogin(){
  const name=document.getElementById("loginName").value.trim();
  const pass=document.getElementById("loginPass").value;
  const err=document.getElementById("loginErr");err.classList.remove("show");
  if(!name){err.textContent="Please enter your name.";err.classList.add("show");return;}
  if(!pass){err.textContent="Please enter your password.";err.classList.add("show");return;}
  const btn=document.getElementById("loginBtn");btn.disabled=true;btn.innerHTML='<span class="sp"></span> Signing in...';
  try{
    const m=await validateStaffName(name);
    if(!m){err.textContent="Name not found. You may have been removed from the system.";err.classList.add("show");btn.disabled=false;btn.textContent="Sign In";return;}

    const auth = getAuthClient();
    let authedViaSupabase = false;
    let _authErrMsg = '';
    if(!auth){ console.warn('[auth] getAuthClient() returned null — supabase-js not loaded; using legacy login'); }
    if(auth){
      const synthEmail = synthEmailFromName(m);
      console.log('[auth] attempting Supabase sign-in as', synthEmail);
      try{
        const { data, error } = await auth.signInWithPassword({
          email: synthEmail, password: pass
        });
        if(error){
          console.warn('[auth] sign-in failed:', error.message);
          _authErrMsg = error.message || '';
        }
        if(!error && data && data.session){
          console.log('[auth] Supabase sign-in OK for', synthEmail);
          authedViaSupabase = true;
          window._sbAuthToken = data.session.access_token || null;
          let mustReset = false;
          try{
            const cr = await sbGet("staff_credentials","?staff_name=eq."+encodeURIComponent(m)+"&select=must_reset");
            mustReset = cr.length && cr[0].must_reset === true;
          }catch(e){}
          if(mustReset){
            _mustResetPending = true;
            saveMe(m);
            btn.disabled=false;btn.textContent="Sign In";
            showForcedReset(m);
            return;
          }
          saveMe(m); enterHub(); return;
        }
      }catch(e){ console.error('[auth] signInWithPassword THREW:', e && (e.message||e), e); }
    }

    if(AUTH_ONLY_MODE){
      const e = (_authErrMsg || '').toLowerCase();
      if(e.indexOf('invalid login') !== -1 || e.indexOf('invalid credentials') !== -1){
        err.textContent = "Wrong password. Check for caps lock, or use 'Forgot password' below.";
      }else if(e.indexOf('email not confirmed') !== -1){
        err.textContent = "Your account isn't activated yet. Ask an admin to set your password.";
      }else if(e.indexOf('rate') !== -1 || e.indexOf('too many') !== -1){
        err.textContent = "Too many attempts. Wait a few minutes and try again.";
      }else if(e.indexOf('network') !== -1 || e.indexOf('fetch') !== -1 || !e){
        err.textContent = "Couldn't reach the sign-in service. Check your connection and try again.";
      }else{
        err.textContent = "Couldn't sign you in. If this keeps happening, ask an admin.";
      }
      err.classList.add("show");
      btn.disabled=false;btn.textContent="Sign In";
      return;
    }
  }catch(e){err.textContent="Connection error. Please try again.";err.classList.add("show");}
  finally{btn.disabled=false;btn.textContent="Sign In";}
}

function showForcedReset(name){
  let ov = document.getElementById('forcedResetOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id='forcedResetOverlay';
    ov.style.cssText='position:fixed;inset:0;z-index:99999;background:var(--m-bg,#fdf8f2);display:flex;align-items:center;justify-content:center;padding:20px;';
    ov.innerHTML =
      '<div style="max-width:380px;width:100%;background:var(--m-card,var(--ui-surface,#fff));border:1px solid var(--m-border,#e7ddd0);border-radius:16px;padding:28px;box-shadow:0 12px 40px rgba(60,40,20,.18);">'+
      '<div style="font-family:var(--nx-font-display);font-size:20px;font-weight:800;margin-bottom:6px;color:var(--m-ink,#2b241c);">Set a new password</div>'+
      '<div style="font-size:13.5px;color:var(--m-ink-2,#6b5d4d);margin-bottom:18px;line-height:1.5;">For security, you must choose your own password before continuing.</div>'+
      '<input id="frNew" type="password" placeholder="New password (min 8 chars)" style="width:100%;margin-bottom:10px;padding:12px 14px;border:1px solid var(--m-border,#e7ddd0);border-radius:12px;font-size:14px;">'+
      '<input id="frConfirm" type="password" placeholder="Confirm new password" style="width:100%;margin-bottom:14px;padding:12px 14px;border:1px solid var(--m-border,#e7ddd0);border-radius:12px;font-size:14px;">'+
      '<div id="frErr" style="color:#c0392b;font-size:12.5px;margin-bottom:10px;display:none;"></div>'+
      '<button id="frBtn" style="width:100%;padding:13px;border:none;border-radius:12px;background:linear-gradient(100deg,#ffd23d,#ff6b3d);color:#1a1205;font-weight:800;font-size:15px;cursor:pointer;">Save & Continue</button>'+
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('frBtn').onclick = ()=>submitForcedReset(name);
  }
  ov.style.display='flex';
}
async function submitForcedReset(name){
  const np=document.getElementById('frNew').value;
  const cp=document.getElementById('frConfirm').value;
  const fe=document.getElementById('frErr');
  const show=(m)=>{fe.textContent=m;fe.style.display='block';};
  if(!np || np.length<8) return show('Password must be at least 8 characters.');
  if(np!==cp) return show('Passwords do not match.');
  const btn=document.getElementById('frBtn'); btn.disabled=true; btn.textContent='Saving...';
  try{
    const auth=getAuthClient();
    const { error } = await auth.updateUser({ password: np });
    if(error){ btn.disabled=false; btn.textContent='Save & Continue'; return show(error.message||'Could not update password.'); }
    await refreshSbAuthToken();
    try{
      await fetch(SB+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(name),{
        method:'PATCH',
        headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body: JSON.stringify({ must_reset:false })
      });
    }catch(e){}
    _mustResetPending=false;
    const ov=document.getElementById('forcedResetOverlay'); if(ov) ov.style.display='none';
    enterHub();
  }catch(e){ btn.disabled=false; btn.textContent='Save & Continue'; show('Something went wrong. Try again.'); }
}

async function doSetPass(){
  const name=document.getElementById("spName").value.trim();
  const pass=document.getElementById("spNew").value;
  const conf=document.getElementById("spConfirm").value;
  const err=document.getElementById("spErr"),ok=document.getElementById("spOk");
  err.classList.remove("show");ok.classList.remove("show");
  if(!name){err.textContent="Please enter your full name.";err.classList.add("show");return;}
  if(!pass||pass.length<8){err.textContent="Password must be at least 8 characters.";err.classList.add("show");return;}
  if(pass!==conf){err.textContent="Passwords do not match.";err.classList.add("show");return;}
  const btn=document.getElementById("spBtn");btn.disabled=true;btn.innerHTML='<span class="sp"></span>';
  try{
    if(AUTH_ONLY_MODE){
      err.textContent="New accounts are set up by an admin now. Please ask your manager to create your login.";
      err.classList.add("show");btn.disabled=false;btn.textContent="Set Password";return;
    }
    const m=await validateStaffName(name);
    if(!m){err.textContent="Name not found. Check your spelling or contact your manager.";err.classList.add("show");btn.disabled=false;btn.textContent="Set Password";return;}
  }catch(e){err.textContent="Failed. Please try again.";err.classList.add("show");}
  finally{btn.disabled=false;btn.textContent="Set Password";}
}

async function doFindQuestions(){
  const name=document.getElementById("rkName").value.trim();
  const err=document.getElementById("rkErr"),ok=document.getElementById("rkOk");
  err.classList.remove("show");ok.classList.remove("show");
  if(!name){err.textContent="Please enter your full name.";err.classList.add("show");return;}
  const btn=document.getElementById("rkFindBtn");btn.disabled=true;btn.innerHTML='<span class="sp"></span>';
  try{
    const m=await validateStaffName(name);
    if(!m){err.textContent="Name not found. Check your spelling.";err.classList.add("show");btn.disabled=false;btn.textContent="Continue";return;}
    const rows=await sbGet("staff_credentials","?staff_name=eq."+encodeURIComponent(m)+"&select=sq1_question,sq2_question");
    if(!rows.length||!rows[0].sq1_question||!rows[0].sq2_question){
      err.textContent="No security questions set. Ask your manager to reset your password.";err.classList.add("show");btn.disabled=false;btn.textContent="Continue";return;
    }
    document.getElementById("rkQ1Label").textContent=rows[0].sq1_question;
    document.getElementById("rkQ2Label").textContent=rows[0].sq2_question;
    document.getElementById("rk-step1").style.display="none";
    document.getElementById("rk-step2").style.display="";
  }catch(e){err.textContent="Failed. Please try again.";err.classList.add("show");}
  finally{btn.disabled=false;btn.textContent="Continue";}
}

async function doResetKey(){
  const name=document.getElementById("rkName").value.trim();
  const a1=document.getElementById("rkA1").value.trim().toLowerCase();
  const a2=document.getElementById("rkA2").value.trim().toLowerCase();
  const pass=document.getElementById("rkNew").value;
  const conf=document.getElementById("rkConfirm").value;
  const err=document.getElementById("rkErr"),ok=document.getElementById("rkOk");
  err.classList.remove("show");ok.classList.remove("show");
  if(!a1||!a2){err.textContent="Please answer both security questions.";err.classList.add("show");return;}
  if(!pass||pass.length<8){err.textContent="Password must be at least 8 characters.";err.classList.add("show");return;}
  if(pass!==conf){err.textContent="Passwords do not match.";err.classList.add("show");return;}
  const btn=document.getElementById("rkBtn");btn.disabled=true;btn.innerHTML='<span class="sp"></span>';
  try{
    const m=await validateStaffName(name);
    if(!m){err.textContent="Name not found.";err.classList.add("show");btn.disabled=false;btn.textContent="Reset Password";return;}
    const [h1,h2]=await Promise.all([hash(a1),hash(a2)]);

    const execUrl = localStorage.getItem('oscars_sheet_url') || 'https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec';
    let serverOk = false, serverErr = '';
    try{
      const resp = await fetch(execUrl, {
        method:'POST', headers:{'Content-Type':'text/plain'},
        body: JSON.stringify({ action:'resetPwViaSQ', staff:m, a1hash:h1, a2hash:h2, newPassword:pass })
      });
      const j = await resp.json().catch(()=>({}));
      serverOk = j && j.ok === true;
      serverErr = (j && j.error) || '';
    }catch(e){ serverErr = 'network'; }

    if(serverOk){
      try{
      }catch(e){}
      ok.textContent="Password reset! Signing you in...";ok.classList.add("show");
      try{
        const auth=getAuthClient();
        if(auth){ await auth.signInWithPassword({ email:synthEmailFromName(m), password:pass }); await refreshSbAuthToken(); }
      }catch(e){}
      saveMe(m);setTimeout(enterHub,1500);
      return;
    }

    if(serverErr === 'incorrect answers'){
      err.textContent="Incorrect answers. Please try again.";err.classList.add("show");btn.disabled=false;btn.textContent="Reset Password";return;
    }
    err.textContent="Password reset is unavailable right now. Please try again shortly, or ask an admin to reset it for you.";err.classList.add("show");btn.disabled=false;btn.textContent="Reset Password";return;
  }catch(e){err.textContent="Failed. Please try again.";err.classList.add("show");}
  finally{btn.disabled=false;btn.textContent="Reset Password";}
}

function _resetExecUrl(){
  return localStorage.getItem('oscars_sheet_url') || 'https://script.google.com/macros/s/AKfycby0Bq97bCZAsmnruXFuJuCqXQE_kOxhYE2KFuJnVzLXtT5CV0Y12k5176dxZbdaYVGE/exec';
}
function _resetLinkBase(){
  try{ return location.origin + location.pathname; }catch(e){ return 'https://oscarstaff.github.io/Oscar/index.html'; }
}

async function doForgotRequest(){
  const email=document.getElementById("fpEmail").value.trim();
  const err=document.getElementById("fpErr"), ok=document.getElementById("fpOk");
  err.classList.remove("show"); ok.classList.remove("show");
  if(!email || email.indexOf("@")<1 || email.indexOf(".")<0){ err.textContent="Please enter a valid email address."; err.classList.add("show"); return; }
  const btn=document.getElementById("fpBtn"); btn.disabled=true; btn.innerHTML='<span class="sp"></span>';
  const generic="If that email is on file, a reset link is on its way. Check your inbox (and spam).";
  try{
    try{
      const resp=await fetch(_resetExecUrl(),{
        method:'POST', headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({ action:'sendResetEmail', email:email, linkBase:_resetLinkBase() })
      });
      await resp.json().catch(()=>({}));
    }catch(e){ /* swallow — still show generic message */ }
    ok.textContent=generic; ok.classList.add("show");
  }catch(e){ err.textContent="Something went wrong. Please try again."; err.classList.add("show"); }
  finally{ btn.disabled=false; btn.textContent="Email me a reset link"; }
}

async function doSetNewPassword(){
  const pass=document.getElementById("snNew").value;
  const conf=document.getElementById("snConfirm").value;
  const err=document.getElementById("snErr"), ok=document.getElementById("snOk");
  err.classList.remove("show"); ok.classList.remove("show");
  const token=window._resetToken||"";
  if(!token){ err.textContent="This reset link is invalid. Please request a new one."; err.classList.add("show"); return; }
  if(!pass||pass.length<8){ err.textContent="Password must be at least 8 characters."; err.classList.add("show"); return; }
  if(pass!==conf){ err.textContent="Passwords do not match."; err.classList.add("show"); return; }
  const btn=document.getElementById("snBtn"); btn.disabled=true; btn.innerHTML='<span class="sp"></span>';
  try{
    const resp=await fetch(_resetExecUrl(),{
      method:'POST', headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({ action:'consumeReset', resetToken:token, newPassword:pass })
    });
    const j=await resp.json().catch(()=>({}));
    if(!(j&&j.ok)){
      const map={ 'invalid token':"This reset link is invalid.", 'expired':"This reset link has expired. Please request a new one.", 'used':"This reset link has already been used." };
      err.textContent=(map[j&&j.error]||"Couldn't reset your password. Please request a new link."); err.classList.add("show");
      btn.disabled=false; btn.textContent="Set Password & Sign In"; return;
    }
    const staff=j.staff;
    ok.textContent="Password set! Signing you in..."; ok.classList.add("show");
    try{
      const auth=getAuthClient();
      if(auth&&staff){ await auth.signInWithPassword({ email:synthEmailFromName(staff), password:pass }); await refreshSbAuthToken(); }
    }catch(e){}
    try{ history.replaceState(null,'',_resetLinkBase()); }catch(e){}
    window._resetToken=null;
    if(staff) saveMe(staff);
    setTimeout(enterHub,1500);
  }catch(e){ err.textContent="Network error. Please try again."; err.classList.add("show"); btn.disabled=false; btn.textContent="Set Password & Sign In"; }
}

async function checkResetLink(){
  var t;
  try{
    var qs=new URLSearchParams(location.search);
    t=qs.get('reset');
  }catch(e){ return false; }
  if(!t) return false;

  document.getElementById('authLayer').style.display='flex';
  window._resetToken=t;
  showAuth('setnew');
  var err=document.getElementById('snErr'), form=document.getElementById('snForm');
  try{
    var resp=await fetch(_resetExecUrl(),{
      method:'POST', headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({ action:'checkReset', resetToken:t })
    });
    var j=await resp.json().catch(()=>({}));
    if(!(j&&j.ok)){
      window._resetToken=null;
      var map={ 'invalid token':"This reset link is invalid.", 'expired':"This reset link has expired.", 'used':"This reset link has already been used." };
      if(form) form.style.display='none';
      if(err){ err.textContent=(map[j&&j.error]||"This reset link is no longer valid.")+" Please request a new one below."; err.classList.add('show'); }
      try{ history.replaceState(null,'',_resetLinkBase()); }catch(e){}
      setTimeout(function(){ try{ showAuth('forgot'); }catch(e){} }, 2200);
      return true;
    }
    if(form) form.style.display='';
    if(err) err.classList.remove('show');
    return true;
  }catch(e){
    if(form) form.style.display='';
    return true;
  }
}

let _sessionWatchTimer = null;
async function _checkSessionAlive(){
  if(!(window.me || sessionStorage.getItem('ou'))) return;
  if(window._authExpiredHandled) return;
  try{
    const a = getAuthClient();
    if(!a || !a.getSession) return;
    const { data } = await a.getSession();
    let sess = data && data.session;
    const looksExpired = !sess || (sess.expires_at && (sess.expires_at * 1000) <= Date.now());
    if(looksExpired){
      let refreshed = null;
      try{
        if(a.refreshSession){
          const r = await a.refreshSession();
          refreshed = r && r.data && r.data.session;
        }
      }catch(_e){ /* refresh threw — treat as unrefreshable below */ }
      if(refreshed && refreshed.access_token &&
         (!refreshed.expires_at || (refreshed.expires_at * 1000) > Date.now())){
        window._sbAuthToken = refreshed.access_token || window._sbAuthToken;
        return;
      }
      window._authExpiredHandled = true;
      try{ if(typeof showToast === 'function') showToast('Your session expired — signing you out.', 'info'); }catch(e){}
      setTimeout(function(){ try{ doLogout(); }catch(e){ window.location.reload(); } }, 600);
    }
  }catch(e){ /* network hiccup — leave it for the next tick */ }
}
function startSessionExpiryWatch(){
  if(_sessionWatchTimer) return;
  _sessionWatchTimer = setInterval(_checkSessionAlive, 60000);
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible') _checkSessionAlive();
  });
  _checkSessionAlive();
}

async function doLogout(){
  try{ if(typeof sessionLimitClear==='function') sessionLimitClear(); }catch(e){}
  try{ teardownRealtime(); }catch(e){}
  if(typeof _clockTickTimer !== 'undefined' && _clockTickTimer){ clearInterval(_clockTickTimer); _clockTickTimer=null; }
  sessionStorage.removeItem("ou");
  window._sbAuthToken = null;
  try{
    const a=getAuthClient();
    if(a && a.signOut){ await a.signOut(); }
  }catch(e){}
  try{
    for(let i=localStorage.length-1;i>=0;i--){
      const k=localStorage.key(i);
      if(k && (k==='oscars_auth' || k.startsWith('sb-') || k.indexOf('supabase.auth')!==-1)) localStorage.removeItem(k);
    }
  }catch(e){}
  me=null;
  window.location.reload();
}

async function enterHub(){
  try{ if(typeof sessionLimitMark==='function') sessionLimitMark(); }catch(e){}
  try{ localStorage.removeItem('notif_local_anon'); }catch(e){}
  try{ startSessionExpiryWatch(); }catch(e){}
  try{
    for(let i = sessionStorage.length - 1; i >= 0; i--){
      const k = sessionStorage.key(i);
      if(k && (k.startsWith('rt_leave_') || k.startsWith('rt_react_') || k.startsWith('rt_disc_') || k.startsWith('rt_reply_'))){
        sessionStorage.removeItem(k);
      }
    }
  }catch(e){}
  try{ window.me = me; }catch(e){}

  if(typeof startNotifSyncWhenReady === 'function') setTimeout(startNotifSyncWhenReady, 1000);
  if(typeof captureMyPushEndpoint === 'function') setTimeout(captureMyPushEndpoint, 1500);
  if(typeof registerServiceWorker === 'function') registerServiceWorker();
  await loadStaffList();
  try{ gateCallLog(); }catch(e){}
  try{ setTimeout(loadHousekeepingDuty, 600); }catch(e){}
  document.getElementById("authLayer").style.display="none";
  document.getElementById("hubLayer").style.display="flex";
  document.getElementById("hubLayer").classList.add("ready");
  const first=me.split(" ")[0];
  await loadMySettings();
  try{ await loadGlowData(); }catch(e){}
  try{ await loadMyNickname(); }catch(e){}
  const ava=me.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const _myImg = (window.avatarFor && window.avatarFor(me)) || null;
  function _paintAva(elId){
    const el=document.getElementById(elId); if(!el) return;
    if(_myImg){
      el.textContent='';
      el.classList.add('has-photo');
      el.style.setProperty('background-image','url('+_myImg+')','important');
      el.style.setProperty('background-size','cover','important');
      el.style.setProperty('background-position','center','important');
    } else {
      el.classList.remove('has-photo');
      el.style.removeProperty('background-image');
      el.textContent=ava;
    }
  }
  _paintAva("sbAvatar"); _paintAva("mhAva"); _paintAva("profAva");
  const _disp=(window.myDisplayName?window.myDisplayName():me);
  const _dispFirst=_disp.split(" ")[0];
  const _el_sbName=document.getElementById("sbName");if(_el_sbName)_el_sbName.textContent=_disp;
  const _el_mhName=document.getElementById("mhName");if(_el_mhName)_el_mhName.textContent=_dispFirst;
  const _el_mhNameInline=document.getElementById("mhNameInline");if(_el_mhNameInline)_el_mhNameInline.textContent=_dispFirst;
  const profNameEl=document.getElementById("profName");if(profNameEl)profNameEl.innerHTML=renderStaffName(me, esc, _disp)+(window.achBadgesInline?window.achBadgesInline(me):""); if(window.paintMyNickLine)window.paintMyNickLine();
  const hr=new Date().getHours();
  const _el_homeGreeting=document.getElementById("homeGreeting");if(_el_homeGreeting)_el_homeGreeting.textContent=(hr<12?"Good morning":hr<17?"Good afternoon":"Good evening")+", "+first;
  const _el_homeWeekSub=document.getElementById("homeWeekSub");if(_el_homeWeekSub)_el_homeWeekSub.textContent=wkL(weekStart);
  const availSubEl=document.getElementById("availSub");if(availSubEl)availSubEl.textContent="Week of "+wkL(weekStart);
  const today=iso(new Date());
  document.getElementById("leaveFrom").value=today;
  document.getElementById("leaveTo").value=today;
  buildAvailForm();
  showSchedTab('leave');
  requestAnimationFrame(function(){ hideNexusBoot(); });
  startBackgroundLocation();ensureStaffSettingsRow();loadStaffTheme();Promise.all([loadHomeData(),loadNotifications(),loadLeaveHistory(),loadWhatsNew(),loadHomeCalendar(),loadHomeAttention(),renderTodayChip(),maybeShowOnboarding(),checkFeedbackInvites(),checkNewNotifications(),loadClockState(),loadAllClockLogs()]).then(function(){
    setTimeout(function(){
      maybeShowTour();
    }, 300);
    try{ checkShiftChangeNotices(); }catch(e){}
  }).catch(function(e){ console.warn('boot data', e); });
  if(typeof applySavedTextColor === 'function') applySavedTextColor();
  loadGlobalGeofence();
  setTimeout(startActivityPolling, 4000);
  /* Tasks feature removed — no loading, reminders, or shared-task polling */
  startAutoRefresh();
  initRealtime();
  loadBirthdays();
  setTimeout(maybeBirthdayCelebration, 1400);
  const hash=window.location.hash.replace('#','');
  const validPages=['home','schedule','profile','announcements','calendar','training','documents','myreports','notifs','leave','availability','hub','shifts','myhours','teamreport'];
  const hashMap={documents:'profile'};
  goTo(validPages.includes(hash)?hash:(hashMap[hash]||'home'));
  showProfileSection("account");
}


function openSubtabChooser(config){
  if(config.navGroupId){
    const g = document.getElementById(config.navGroupId);
    if(g) g.classList.add('open');
  }
  const isMobile = window.matchMedia('(max-width:700px)').matches;
  if(!isMobile){
    if(config.defaultTab) goTo(config.defaultTab);
    return;
  }
  let sheet = document.getElementById('subtabChooserSheet');
  if(sheet && sheet.dataset.title === config.title){ sheet.remove(); return; }
  if(sheet) sheet.remove();
  sheet = document.createElement('div');
  sheet.id = 'subtabChooserSheet';
  sheet.dataset.title = config.title;
  sheet.style.cssText = 'position:fixed;left:0;right:0;bottom:calc(56px + env(safe-area-inset-bottom,0px));z-index:9100;background:var(--ui-surface,#fff);border-top:1px solid var(--ui-line,#e2e8f0);border-radius:14px 14px 0 0;box-shadow:0 -8px 30px rgba(15,23,42,.18);padding:12px;display:flex;flex-direction:column;gap:8px;animation:libSheetUp .2s ease;';
  let html = '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 6px 6px;">'+
    '<div style="font-size:13px;font-weight:700;color:var(--ui-ink,#0f172a);">'+esc(config.title)+'</div>'+
    '<button onclick="document.getElementById(\'subtabChooserSheet\').remove();" style="background:none;border:none;font-size:20px;color:var(--ui-ink-4,#94a3b8);cursor:pointer;line-height:1;padding:2px 8px;">×</button>'+
  '</div>';
  config.options.forEach(function(o){
    html += '<button onclick="document.getElementById(\'subtabChooserSheet\').remove();'+o.action+'" style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--ui-surface,#fff);border:1.5px solid var(--ui-line,#e2e8f0);border-radius:10px;cursor:pointer;font-family:inherit;text-align:left;">'+
      '<div style="width:34px;height:34px;border-radius:10px;background:'+o.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+o.icon+'</div>'+
      '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--ui-ink,#0f172a);">'+o.label+'</div><div style="font-size:11.5px;color:var(--ui-ink-3,#64748b);margin-top:1px;">'+o.sub+'</div></div>'+
      '<svg width="14" height="14" viewBox="0 0 20 20" fill="#cbd5e1"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>'+
    '</button>';
  });
  sheet.innerHTML = html;
  document.body.appendChild(sheet);
  setTimeout(function(){
    const closeOnTap = function(e){
      if(!sheet.contains(e.target)){
        sheet.remove();
        document.removeEventListener('click', closeOnTap, true);
        document.removeEventListener('touchstart', closeOnTap, true);
      }
    };
    document.addEventListener('click', closeOnTap, true);
    document.addEventListener('touchstart', closeOnTap, true);
  }, 50);
}

function openLibrary(){
  openSubtabChooser({
    title: 'Library',
    navGroupId: 'navg-learning',
    defaultTab: 'training',
    options: [
      {
        label: 'Learnings',
        sub: 'Quizzes & compliance checks',
        bg: '#eff6ff',
        icon: '<svg width="18" height="18" viewBox="0 0 20 20" fill="#3b82f6"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/></svg>',
        action: "goTo('training');"
      },
      {
        label: 'Documents',
        sub: 'Training guides & resources',
        bg: '#fef3c7',
        icon: '<svg width="18" height="18" viewBox="0 0 20 20" fill="#d97706"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>',
        action: "goTo('documents');"
      }
    ]
  });
}

/**
 * "Shifts" page (under My Time) — the two things staff actually open a phone
 * for: what am I working, and what's going spare. Kept separate from Leave
 * (Leave / Availability), which is about requests rather than the roster.
 */
/** Shifts page: your roster, with open shifts to pick up shown above it when there are any.
 *  Both lists load together behind one skeleton, then appear in a single step so the page doesn't jump. */
let _shiftsLoadToken = 0;
async function loadShiftsPage(){
  const tok = ++_shiftsLoadToken;
  const skel=document.getElementById('shiftsSkel'), body=document.getElementById('shiftsBody');
  const first = !body || body.dataset.loaded !== '1';
  if(first){
    if(skel) skel.style.display='';
    if(body) body.style.display='none';
  }
  try{
    await Promise.allSettled([
      (typeof loadMyRoster==='function') ? loadMyRoster() : null,
      (typeof loadShiftPickup==='function') ? loadShiftPickup() : null
    ]);
  }catch(e){}
  if(tok !== _shiftsLoadToken) return;
  if(skel) skel.style.display='none';
  if(body){ body.style.display=''; body.dataset.loaded='1'; }
}
/** Kept so older callers still work — there is only one Shifts view now. */
function showShiftsTab(){ loadShiftsPage(); }

/** Open the Shifts page. */
function openShiftsTab(){
  goTo('shifts');
}

/** Badge the mobile tab with how many shifts are up for grabs. */
async function refreshShiftsBadge(){
  const el=document.getElementById('bnShiftsBadge');
  if(!el || !me) return;
  try{
    const creds=await sbGet('staff_credentials','?staff_name=eq.'+encodeURIComponent(me)+'&select=team');
    const team=(creds&&creds[0]&&creds[0].team)||'';
    if(!team){ el.textContent=''; el.style.display='none'; return; }
    const today=new Date();
    const iso=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
    const rows=await sbGet('roster_shifts',
      '?status=eq.open'+
      '&or=(open_to_team.is.null,open_to_team.eq.'+encodeURIComponent(team)+')'+
      '&shift_date=gte.'+iso+'&select=id,shift_date,staff_name');
    const pub=await _publishedWeeks();
    const visible=_filterPublished((rows||[]).filter(function(r){return r.staff_name!==me;}), pub);
    if(visible.length){ el.textContent=visible.length; el.style.display=''; }
    else { el.textContent=''; el.style.display='none'; }
  }catch(e){ /* badge is decoration — never let it break navigation */ }
}

function openRoster(){
  openSubtabChooser({
    title: 'My Time',
    navGroupId: 'navg-roster',
    defaultTab: 'myhours',
    options: [
      {
        label: 'Shifts',
        sub: 'Your roster & open shifts',
        bg: '#dbeafe',
        icon: '<svg width="18" height="18" viewBox="0 0 20 20" fill="#1d4ed8"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>',
        action: "openShiftsTab();"
      },
      {
        label: 'My Hours',
        sub: 'Timesheet & availability',
        bg: '#d1fae5',
        icon: '<svg width="18" height="18" viewBox="0 0 20 20" fill="#065f46"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>',
        action: "goTo('myhours');"
      }
    ]
  });
}

function toggleNavGroup(groupId){
  const g = document.getElementById('navg-'+groupId);
  if(!g) return;
  const wasOpen = g.classList.contains('open');
  document.querySelectorAll('.nav-group').forEach(function(x){x.classList.remove('open');});
  if(!wasOpen) g.classList.add('open');
}

function _setBottomNavActive(page){
  const groupMap = {
    'shifts':'schedule',
    'myhours':'schedule',
    'availability':'schedule',
    'training':'library',
    'documents':'library'
  };
  const target = groupMap[page] || page;
  document.querySelectorAll('.bn-item').forEach(function(b){
    b.classList.toggle('active', b.dataset.tab === target);
  });
}

function setActiveNavChild(tab){
  document.querySelectorAll('.nav-child').forEach(function(c){
    c.classList.toggle('active', c.dataset.tab === tab);
  });
  let openedAlready = false;
  document.querySelectorAll('.nav-child.active').forEach(function(c){
    const group = c.closest('.nav-group');
    if(group && !group.classList.contains('open') && !openedAlready){
      const anyOpen = document.querySelector('.nav-group.open');
      if(!anyOpen){
        group.classList.add('open');
        openedAlready = true;
      }
    }
  });
}

function goTo(p){
  if(p === 'diary' || p === 'tasks'){ p = 'home'; }
  /* My Time was split: Leave is its own page; Availability + hours live on My Hours. */
  let _hoursTab = null;
  if(p === 'schedule') p = 'leave';
  if(p === 'availability'){ p = 'myhours'; _hoursTab = 'availability'; }
  if(p === 'hours' || p === 'reports'){ p = 'myhours'; _hoursTab = 'hours'; }
  /* Report pages: Timesheet Manager is admin-only; Team Report is for people
     whose team has one, and admins. Only enforced once the flags have loaded. */
  if(window._nxFlagsLoaded){
    if(p === 'myreports' && !myIsAdmin) p = 'home';
    if(p === 'teamreport' && typeof nxTeamReportAllowed === 'function' && !nxTeamReportAllowed()) p = 'home';
  }
  if(p === 'announcements' || p === 'engagement' || p === 'discussions'){
    p = (window.innerWidth > 900) ? 'home' : 'notifs';
  }
  const _lock=document.getElementById('onboardLockOverlay');
  if(_lock && _lock.dataset.locked==='1' && p!=='myhours' && p!=='leave'){
    _lock.style.display='flex';
    return;
  }
  if(p === 'notifs' && window.innerWidth > 900) p = 'home';
  if(p === 'hub'){
    setTimeout(loadHubAccess, 50);
    setTimeout(function(){ if(typeof hubRadialLayout==='function') hubRadialLayout(); }, 60);
  }
  if(p === 'shifts'){ loadShiftsPage(); }
  if(p === 'calllog'){
    if(window._canCallLog === false){ p = 'home'; }
    else { setTimeout(function(){ if(typeof initCallLog==='function') initCallLog(); }, 50); }
  }
  try{
    const _m=document.querySelector('.main');
    if(_m) _m.classList.toggle('cl-fixed', p==='calllog');
  }catch(e){}
  const myName = window.me || (typeof me !== 'undefined' && me) || null;
  if(myName){
    if(p === 'myreports' || p === 'myhours') localStorage.setItem('nexus_visited_reports_'+myName,'1');
  }
  setActiveNavChild(p);
  if(typeof _setBottomNavActive==='function') _setBottomNavActive(p);
  const titles={home:'Home',leave:'Leave',shifts:'Shifts',myhours:'My Hours',myreports:'Timesheet Manager',teamreport:'Team Report',schedule:'Schedule',profile:'Profile','profile-view':'Profile',announcements:'Announcements',engagement:'Engagement',documents:'Documents',messages:'Messages',achievements:'Team Achievements'};
  const appName='Nexus';
  document.title='Nexus · '+(titles[p]||'Nexus');
  if(history.replaceState)history.replaceState(null,'','#'+p);
  document.querySelectorAll(".page").forEach(pg=>pg.classList.toggle("active",pg.id==="page-"+p));
  document.querySelectorAll("[data-tab]").forEach(item=>item.classList.toggle("active",item.getAttribute("data-tab")===p));
  if(typeof _setBottomNavActive==='function') _setBottomNavActive(p);
  if(p==="leave"){ if(typeof setActiveNavChild==='function') setActiveNavChild('leave'); loadLeaveHistory(); }
  if(p==="myhours"){ if(typeof initReportsPage==='function') initReportsPage(); showHoursTab(_hoursTab||'hours'); }
  if(p==="teamreport"){ if(typeof initReportsPage==='function') initReportsPage(); if(typeof initTeamReport==='function') initTeamReport(); }
  if(p==="profile")loadProfilePage();
  if(p==="home"){if(typeof nxApplyReportMenuCache==='function') nxApplyReportMenuCache();loadHomeData();loadClockState();loadWhatsNew();loadHomeCalendar();loadHomeAttention();renderTodayChip();loadHomeAchievements();}
  if(p==="achievements"){loadAchievementsPage();}
  if(p==="notifs"){renderNotifsPage();}
  
  if(p==="training"){renderMyTraining();}

  if(p==="documents"){loadDocuments();refreshQuizStrip();}
  /* Tasks feature removed */
  if(p==="myreports"){ initReportsPage(); if(typeof showMgrView==='function') showMgrView(typeof _repRead==='function' ? _repRead('nx_rep_mgr') : null); }
  
  if(p==="profile"){setTimeout(refreshPushToggleState, 100);
    setTimeout(renderNotifPanel, 50);
    setTimeout(populateSheetUrlField, 50);
    setTimeout(maybeShowGeofenceAdjuster, 50);
    setTimeout(function(){
      const sl = document.getElementById('brightnessSlider');
      if(sl) sl.value = parseInt(localStorage.getItem('oscars_brightness')||'100');
    }, 50);
  }
  
  const main=document.querySelector(".main");
  if(main)main.scrollTop=0;
}

function showProfileSection(sec){
  ["account"].forEach(s=>{
    const el=document.getElementById("psec-"+s);
    if(el)el.style.display=s===sec?"block":"none";
    const tab=document.getElementById("ptab-"+s);
    if(tab)tab.classList.toggle("active",s===sec);
  });

  markAllNotificationsRead(true);
  const main=document.querySelector(".main");
  if(main)main.scrollTop=0;
}

async function loadAdminAvailGrid(){
  const el=document.getElementById("adminContent");
  if(!el)return;
  el.innerHTML='<div style="color:var(--ui-ink-4,#94a3b8);font-size:13px;text-align:center;padding:16px;">'+nxSkel('table',6)+'</div>';
  let availRows=[];
  try{const r=await fetch(SB+"/rest/v1/staff_availability?select=*",{headers:{"apikey":KEY,"Authorization":"Bearer "+KEY}});if(r.ok)availRows=await r.json();}catch(e){console.warn(e);}
  const typeCol={all:"var(--accent)",no:"#dc2626",custom:"#0ea5e9"};
  const typeLbl={all:"Available",no:"Unavail",custom:""};
  let html='';
  STAFF.forEach(function(name){
    const row=availRows.find(function(r){return r.staff_name&&r.staff_name.toLowerCase()===name.toLowerCase();});
    html+='<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--ui-line,#e2e8f0);flex-wrap:wrap">';
    html+='<div style="font-size:12.5px;font-weight:700;min-width:150px;padding-top:2px">'+name+'</div>';
    if(!row){html+='<div style="font-size:11px;color:var(--ui-ink-4,#94a3b8);">Not set</div>';}
    else{
      const period=row.is_ongoing?"Ongoing":(row.valid_from?"From "+row.valid_from+(row.valid_until?" - "+row.valid_until:""):"");
      if(period)html+='<div style="font-size:10px;color:var(--ui-ink-4,#94a3b8);margin-right:6px;padding-top:3px;">'+period+'</div>';
      const av=row.availability||{};
      html+='<div style="display:flex;gap:3px;flex-wrap:wrap">';
      for(let i=0;i<7;i++){const a=av[i]||av[String(i)]||{type:"all"};const lbl=a.type==="custom"?(a.start.slice(0,5)+"–"+a.end.slice(0,5)):typeLbl[a.type];html+='<div style="font-size:9px;font-weight:700;padding:3px 5px;border-radius:4px;background:var(--ui-surface-2,#f8fafc);border:1px solid var(--ui-line,#e2e8f0);color:'+typeCol[a.type]+'">'+DS[i]+' '+lbl+'</div>';}
      html+='</div>';
    }
    html+='</div>';
  });
  el.innerHTML=html||'<div style="color:var(--ui-ink-4,#94a3b8);font-size:13px;padding:12px;">No availability submitted yet.</div>';
}




const dayState={};let fBuilt=false;
let availPeriod="ongoing";



let _effChosen = null;
let _effCalMonth = null;

function _effFortnightAnchor(){ const d=new Date(2026,7,10); d.setHours(0,0,0,0); return d; }
function _effIsFortnightStart(d){
  const diff=Math.round(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000 - Date.UTC(2026,7,10)/86400000);
  return diff>=0 && diff%7===0;
}
function _effSoonestValid(){
  const floor=_availCutoffFloor();
  let base;
  if(typeof window.availNextFortnight==='function'){ base=window.availNextFortnight(); }
  else {
    const a=_effFortnightAnchor(); const today=new Date(); today.setHours(0,0,0,0);
    let d=new Date(a);
    while(d<=today){ d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+7); }
    base=d;
  }
  return (base < floor) ? floor : base;
}
function _effFmtIso(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _effFmtNice(d){ return d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'}); }

function _sydneyNow(){
  return new Date(new Date().toLocaleString('en-US',{timeZone:'Australia/Sydney'}));
}
function _availCutoffFloor(now){
  now = now || _sydneyNow();
  const d = new Date(now); d.setHours(0,0,0,0);
  const dow = (d.getDay()+6)%7;
  const nextMon = new Date(d.getFullYear(), d.getMonth(), d.getDate()-dow+7);
  const friday = new Date(d.getFullYear(), d.getMonth(), d.getDate()-dow+4, 12, 0, 0, 0);
  return (now < friday) ? nextMon : new Date(d.getFullYear(), d.getMonth(), d.getDate()-dow+14);
}


let _availMode='from', _oneoffOK=false, _oneoffRows=[];
function setAvailMode(m){
  _availMode=(m==='oneoff' && _oneoffOK)?'oneoff':'from';
  const a=document.getElementById('availModeFrom'), b=document.getElementById('availModeOne');
  if(a&&b){
    a.classList.toggle('btn-green',_availMode==='from'); a.classList.toggle('btn-outline',_availMode!=='from');
    b.classList.toggle('btn-green',_availMode==='oneoff'); b.classList.toggle('btn-outline',_availMode!=='oneoff');
  }
  const n=document.getElementById('availModeNote');
  if(n) n.textContent=_availMode==='oneoff'
    ? 'These hours apply to the one week you pick only. Afterwards your usual hours carry on automatically.'
    : 'Your new hours begin on the Monday you pick and stay until you change them again. Until then your current hours stay live.';
  const bt=document.getElementById('availBtn');
  if(bt) bt.textContent=_availMode==='oneoff'?'Save one-off week':'Save availability';
}
async function loadOneoffs(){
  try{
    const r=await fetch(SB+"/rest/v1/availability_oneoffs?staff_name=eq."+encodeURIComponent(me)+"&select=week_start,availability&order=week_start.asc",
      {headers:{apikey:KEY,Authorization:"Bearer "+_sbBearer()}});
    if(!r.ok){ _oneoffOK=false; }
    else{ _oneoffRows=await r.json(); _oneoffOK=true; }
  }catch(e){ _oneoffOK=false; }
  const seg=document.getElementById('availModeSeg');
  if(seg) seg.style.display=_oneoffOK?'flex':'none';
  if(!_oneoffOK) _availMode='from';
  setAvailMode(_availMode);
  renderOneoffs();
  try{
    const sc=document.getElementById('availSuccess');
    if(sc && sc.style.display==='block' && window._availRow) renderAvailOverview(window._availRow);
  }catch(e){}
}
function renderOneoffs(){
  const card=document.getElementById('availOneoffCard'), el=document.getElementById('availOneoffList');
  if(!card||!el) return;
  const today=_effFmtIso(new Date());
  const rows=(_oneoffRows||[]).filter(function(r){ return r.week_start>=_effFmtIso(new Date(new Date().getTime()-6*864e5)); });
  card.style.display=(_oneoffOK&&rows.length)?'block':'none';
  const floor=_effFmtIso(_availCutoffFloor());
  el.innerHTML=rows.map(function(r){
    const d=new Date(r.week_start+'T00:00:00');
    const locked=r.week_start<floor;
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--ui-line,#e2e8f0);">'+
      '<span>Week of <b>'+_effFmtNice(d)+'</b></span>'+
      (locked?'<span style="font-size:11.5px;color:var(--ui-ink-4,#94a3b8);">locked</span>'
             :'<button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:12px;" onclick="cancelOneoff(\''+r.week_start+'\')">Cancel</button>')+
      '</div>';
  }).join('');
}
async function cancelOneoff(ws){
  if(!confirm('Cancel your one-off availability for that week? Your usual hours will apply.')) return;
  try{
    const r=await fetch(SB+"/rest/v1/availability_oneoffs?staff_name=eq."+encodeURIComponent(me)+"&week_start=eq."+ws,
      {method:'DELETE',headers:{apikey:KEY,Authorization:"Bearer "+_sbBearer(),Prefer:'return=representation'}});
    const out=await r.json().catch(function(){return null;});
    if(!r.ok||!Array.isArray(out)||!out.length) throw new Error('x');
  }catch(e){ alert('Could not cancel. Please try again.'); return; }
  await loadOneoffs();
}
async function _saveOneoff(avail,err,btn){
  let ws=_effChosen;
  const cd=ws?new Date(ws+'T00:00:00'):null;
  if(!cd || (cd.getDay()+6)%7!==0 || cd<_availCutoffFloor()){
    err.textContent='Pick a Monday that is still open for availability.'; err.classList.add('show'); return;
  }
  btn.disabled=true; btn.innerHTML='<span class="sp"></span> Saving...';
  try{
    const r=await fetch(SB+"/rest/v1/availability_oneoffs?on_conflict=staff_name,week_start",{
      method:'POST',
      headers:{apikey:KEY,Authorization:"Bearer "+_sbBearer(),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify({staff_name:me,week_start:ws,availability:avail,updated_at:new Date().toISOString()})
    });
    const out=await r.json().catch(function(){return null;});
    if(!r.ok||!Array.isArray(out)||!out.length) throw new Error('save '+r.status);
    window._oneoffJustSaved=ws;
    await loadOneoffs();
    if(typeof showToast==='function') showToast('One-off saved for week of '+_effFmtNice(cd));
    if(window._availRow) showAvailSuccess(window._availRow);
  }catch(e){ err.textContent='Failed to save the one-off. Please check your connection.'; err.classList.add('show'); }
  finally{ btn.disabled=false; setAvailMode(_availMode); }
}
function initEffDate(){
  const d=_effSoonestValid();
  _effChosen=_effFmtIso(d);
  _effCalMonth=new Date(d.getFullYear(), d.getMonth(), 1);
  _renderEffLabel();
}
function _renderEffLabel(){
  const lbl=document.getElementById('availEffLabel');
  const hint=document.getElementById('availEffHint');
  if(_effChosen){
    const d=new Date(_effChosen+'T00:00:00');
    if(lbl) lbl.textContent='Week of '+_effFmtNice(d);
    if(hint){
      const floor=_availCutoffFloor();
      const soonest=_effFmtIso(floor);
      hint.textContent = (_effChosen===soonest) ? '✓ soonest available week' : '✓ starts '+_effFmtNice(d);
    }
  }else{
    if(lbl) lbl.textContent='Select week…';
    if(hint) hint.textContent='';
  }
}
function toggleEffCal(){
  const cal=document.getElementById('availEffCal');
  if(!cal) return;
  if(cal.style.display==='none'){ _renderEffCal(); cal.style.display='block'; }
  else cal.style.display='none';
}
function effCalNav(delta){
  if(!_effCalMonth) _effCalMonth=new Date();
  _effCalMonth=new Date(_effCalMonth.getFullYear(), _effCalMonth.getMonth()+delta, 1);
  _renderEffCal();
}
function _renderEffCal(){
  const cal=document.getElementById('availEffCal');
  if(!cal) return;
  const m=_effCalMonth||new Date();
  const y=m.getFullYear(), mo=m.getMonth();
  const monthName=m.toLocaleDateString('en-AU',{month:'long',year:'numeric'});
  const first=new Date(y,mo,1);
  const startDow=(first.getDay()+6)%7;
  const daysInMonth=new Date(y,mo+1,0).getDate();
  const today=new Date(); today.setHours(0,0,0,0);
  const cutoffFloor=_availCutoffFloor();

  let html='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'+
    '<button type="button" onclick="effCalNav(-1)" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--ui-ink-3,#64748b);padding:2px 8px;">‹</button>'+
    '<div style="font-size:13px;font-weight:700;color:inherit;">'+monthName+'</div>'+
    '<button type="button" onclick="effCalNav(1)" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--ui-ink-3,#64748b);padding:2px 8px;">›</button>'+
  '</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:10px;font-weight:700;color:var(--ui-ink-4,#94a3b8);margin-bottom:4px;">'+
    ['Mo','Tu','We','Th','Fr','Sa','Su'].map(function(d){return '<div>'+d+'</div>';}).join('')+'</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">';
  for(let i=0;i<startDow;i++) html+='<div></div>';
  for(let day=1;day<=daysInMonth;day++){
    const d=new Date(y,mo,day); d.setHours(0,0,0,0);
    const iso=_effFmtIso(d);
    const selectable=_effIsFortnightStart(d) && d>=cutoffFloor;
    const isSel=(iso===_effChosen);
    if(selectable){
      html+='<button type="button" onclick="pickEffDate(\''+iso+'\')" title="Week starting '+_effFmtNice(d)+'" '+
        'style="cursor:pointer;border:1px solid '+(isSel?'var(--accent,#3b82f6)':'#e2e8f0')+';'+
        'background:'+(isSel?'var(--accent,#3b82f6)':'#fff')+';color:'+(isSel?'#fff':'#0f172a')+';'+
        'border-radius:8px;padding:7px 0;font-size:12px;font-weight:700;font-family:inherit;">'+day+'</button>';
    }else{
      html+='<div title="Week is locked for availability requests" '+
        'style="border-radius:8px;padding:7px 0;font-size:12px;color:#cbd5e1;background:var(--ui-surface-2,#f8fafc);cursor:not-allowed;text-align:center;">'+day+'</div>';
    }
  }
  html+='</div>';
  html+='<div style="font-size:10.5px;color:var(--ui-ink-4,#94a3b8);margin-top:10px;line-height:1.5;">'+
    '<span style="display:inline-block;width:9px;height:9px;background:var(--accent,#3b82f6);border-radius:4px;vertical-align:middle;margin-right:4px;"></span>'+
    'Selectable Monday · greyed days are locked.</div>';
  cal.innerHTML=html;
}
function pickEffDate(iso){
  _effChosen=iso;
  _renderEffLabel();
  _renderEffCal();
  const cal=document.getElementById('availEffCal');
  if(cal) cal.style.display='none';
}

function buildAvailForm(){
  if(fBuilt)return;
  loadEarlyStartApproval();
  const el=document.getElementById("availForm");
  DAYS.forEach((day,i)=>{
    dayState[i]={type:"unset"};
    const isWeekend = (i>=5);
    const availLabel = isWeekend ? 'Available (9\u20134)' : 'Available (9\u201319)';
    const defEnd = isWeekend ? '16:00' : '19:00';
    const wrap=document.createElement("div");
    wrap.id="dayWrap-"+i;
    wrap.className="av-fday";
    wrap.innerHTML=
      '<div class="av-ftop">'+
        '<div class="av-fname">'+day+'</div>'+
        '<div class="av-seg" role="group" aria-label="'+day+' availability">'+
          '<button type="button" class="av-opt" id="ao-yes-'+i+'" onclick="setDay('+i+',\'all\')">Available</button>'+
          '<button type="button" class="av-opt" id="ao-custom-'+i+'" onclick="setDay('+i+',\'custom\')">Custom</button>'+
          '<button type="button" class="av-opt" id="ao-no-'+i+'" onclick="setDay('+i+',\'no\')">Unavailable</button>'+
        '</div>'+
      '</div>'+
      '<div class="av-cap" id="cap-'+i+'"></div>'+
      '<div class="av-ctr" id="ctr-'+i+'">'+
        '<input type="time" class="f-input av-time" id="cs-'+i+'" value="09:00" aria-label="'+day+' start">'+
        '<span class="to">to</span>'+
        '<input type="time" class="f-input av-time" id="ce-'+i+'" value="'+defEnd+'" aria-label="'+day+' end">'+
      '</div>';
    el.appendChild(wrap);
  });
  fBuilt=true;
  initEffDate(); loadOneoffs();
  loadExistingAvail();
}

function setDay(i,type){

  dayState[i]={type};
  const base="av-opt";
  const _y=document.getElementById("ao-yes-"+i), _c=document.getElementById("ao-custom-"+i), _n=document.getElementById("ao-no-"+i);
  _y.className=base+(type==="all"?" is-yes":"");   _y.setAttribute("aria-pressed",type==="all");
  _c.className=base+(type==="custom"?" is-custom":""); _c.setAttribute("aria-pressed",type==="custom");
  _n.className=base+(type==="no"?" is-no":"");     _n.setAttribute("aria-pressed",type==="no");
  const ct=document.getElementById("ctr-"+i);
  if(ct)ct.style.display=type==="custom"?"flex":"none";
  const cap=document.getElementById("cap-"+i);
  if(cap)cap.textContent = type==="all" ? (i>=5?"Free from 9:00 to 16:00":"Free from 9:00 to 19:00") : "";
  if(type==="custom"){renderStartPresets(i);enforceStartFloor(i);syncStartPreset(i);}
}

let _earlyStartOk=true;
async function loadEarlyStartApproval(){ return true; }



function earliestStart(){return "";}

function renderStartPresets(){}
function enforceStartFloor(i){
  const s=document.getElementById("cs-"+i);
  if(s)s.removeAttribute('min');
}

function syncStartPreset(){}

function renderAvailPendingStatus(r){
  const el=document.getElementById('availPendingStatus'); if(!el) return;
  const ov=document.getElementById('availSuccess');
  const _bar=document.getElementById('availLockBar');
  if(!r || !r.pending_availability || !r.pending_from || (ov && ov.style.display==='block')){ el.style.display='none'; el.innerHTML=''; el.className=''; if(_bar) _bar.style.display=''; return; }
  if(_bar) _bar.style.display='none';
  const starts=_avNiceDate(r.pending_from,true);
  el.style.cssText='display:block;';
  el.className='';
  el.innerHTML='<div class="av-note"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><div>You\u2019re editing a change that\u2019s <b>waiting to start</b> on <b>'+starts+'</b>. Your current hours stay live until then. Days that differ from your current hours are highlighted. Saving again keeps the same start date unless you pick another below.</div></div>';
}
async function refreshAvailPendingStatus(){
  try{
    const rows=await sbGet('staff_availability','?staff_name=eq.'+encodeURIComponent(me)+'&select=pending_availability,pending_from,pending_set_at,availability_reviewed_at&limit=1');
    renderAvailPendingStatus((rows&&rows[0])||null);
  }catch(e){ /* status card is informational only */ }
}

async function loadExistingAvail(){
  try{
    const rows=await sbGet("staff_availability","?staff_name=eq."+encodeURIComponent(me)+"&limit=1");
    if(!rows.length)return;
    const r=rows[0];
    renderAvailPendingStatus(r);
    await loadEarlyStartApproval();
    const hasPending = !!(r.pending_availability && r.pending_from);
    const av = hasPending ? r.pending_availability : r.availability;

    if(hasPending && typeof _effIsFortnightStart==='function'){
      try{
        const pd=new Date(r.pending_from+'T00:00:00');
        _effChosen=r.pending_from;
        _effCalMonth=new Date(pd.getFullYear(), pd.getMonth(), 1);
        if(typeof _renderEffLabel==='function') _renderEffLabel();
      }catch(e){}
    }

    Object.keys(av).forEach(k=>{
      const a=av[k];
      setDay(parseInt(k),a.type);
      if(a.type==="custom"){
        const s=document.getElementById("cs-"+k),e=document.getElementById("ce-"+k);
        if(s&&a.start)s.value=a.start;
        if(e&&a.end)e.value=a.end;
        renderStartPresets(parseInt(k));
        enforceStartFloor(parseInt(k));
        syncStartPreset(parseInt(k));
      }
      if(hasPending){
        try{
          const live = (r.availability||{})[k];
          const changed = JSON.stringify(live) !== JSON.stringify(a);
          const row = document.getElementById('dayWrap-'+k);
          if(row) row.classList.toggle('av-changed', changed);
        }catch(e){}
      }
    });
  }catch(e){console.warn(e);}
}

async function checkLock(){
  adminHasSetAvail=false;
  myCanEditAvail=true;
  try{
    const r=await fetch(SB+"/rest/v1/staff_settings?name=eq."+encodeURIComponent(me),{headers:{"apikey":KEY,"Authorization":"Bearer "+KEY}});
    if(r.ok){
      const rows=await r.json();
      if(rows.length){
        myCanEditAvail=rows[0].can_edit_avail!==false;
        adminHasSetAvail=true;
      }
    }
  }catch(e){console.warn(e);}

  const locked=adminHasSetAvail&&!myCanEditAvail;
  const lockEl=document.getElementById("availLock");
  lockEl.style.display=locked?"block":"none";
  if(locked)lockEl.textContent="Your availability has been locked by your manager.";
  document.getElementById("availBtnArea").style.display=locked?"none":"block";

  if(!locked){
    try{
      const existing=await sbGet("staff_availability","?staff_name=eq."+encodeURIComponent(me)+"&order=updated_at.desc&limit=5");
      const valid=(typeof _hasValidAvailability==='function')?_hasValidAvailability(existing):(existing&&existing.length>0);
      if(existing && existing.length && valid){
        buildAvailForm();
        showAvailSuccess(existing[0]);
      }else if(existing && existing.length && !valid){
        buildAvailForm();
        showAvailForm();
        showAvailExpiredNotice(existing[0]);
      }else{
        buildAvailForm();
        showAvailForm();
      }
    }catch(e){buildAvailForm();showAvailForm();}
  }
}

function _avSydToday(){ return new Date().toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'}); }
function _avDaysUntil(ymd){ return Math.round((Date.parse(ymd+'T00:00:00Z')-Date.parse(_avSydToday()+'T00:00:00Z'))/86400000); }
function _avNiceDate(ymd,long){ return new Date(ymd+'T00:00:00').toLocaleDateString('en-AU', long?{weekday:'long',day:'numeric',month:'long'}:{weekday:'short',day:'numeric',month:'short'}); }
function _avNiceDT(iso){ return new Date(iso).toLocaleString('en-AU',{timeZone:'Australia/Sydney',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',hour12:true}); }
function _avNorm(a){ a=a||{}; const t=a.type||'unset'; return t==='custom' ? 'custom|'+(a.start||'')+'|'+(a.end||'') : t; }
function _avValHtml(a,i){
  a=a||{type:'unset'};
  if(a.type==='all') return '<span class="av-vdot yes"></span><span>Available<small>'+(i>=5?'9–16':'9–19')+'</small></span>';
  if(a.type==='custom') return '<span class="av-vdot custom"></span><span>'+(a.start||'?')+'–'+(a.end||'?')+'</span>';
  if(a.type==='no') return '<span class="av-vdot no"></span><span>Unavailable</span>';
  return '<span class="av-vdot"></span><span>Not set</span>';
}
function _avCheck(sz){ return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'; }

function renderAvailOverview(row){
  const host=document.getElementById('availOverview'); if(!host) return;
  window._availRow=row;
  const live=row.availability||{};
  const pend=(row.pending_availability && row.pending_from) ? row.pending_availability : null;
  const FULL=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const SHORT=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const get=(o,i)=>(o&&(o[i]||o[String(i)]))||{type:'unset'};
  let changed=0;
  const rows=FULL.map((d,i)=>{
    const a=get(live,i), b=pend?get(pend,i):null;
    const diff=pend && _avNorm(a)!==_avNorm(b);
    if(diff) changed++;
    const day='<div class="av-d"><span class="l">'+d+'</span><span class="s">'+SHORT[i]+'</span></div>';
    return pend
      ? '<div class="av-row'+(diff?' changed':'')+'">'+day+'<div class="av-v old">'+_avValHtml(a,i)+'</div><div class="av-v new">'+_avValHtml(b,i)+'</div></div>'
      : '<div class="av-row single">'+day+'<div class="av-v">'+_avValHtml(a,i)+'</div></div>';
  }).join('');

  let pill, title, sub, steps='';
  if(pend){
    const days=_avDaysUntil(row.pending_from);
    const setAt=row.pending_set_at?Date.parse(row.pending_set_at):0;
    const revAt=row.availability_reviewed_at?Date.parse(row.availability_reviewed_at):0;
    const acked=!!(setAt && revAt && revAt>=setAt);
    pill='<span class="av-pill pending"><i></i>Pending</span>';
    title='New hours start '+_avNiceDate(row.pending_from,true);
    sub='Your change is <b>saved but not live yet</b>. Until then your current hours stay in place and rosters for the weeks before then don’t change.';
    const when = days>1 ? 'in '+days+' days' : days===1 ? 'tomorrow' : 'today';
    steps='<ol class="av-steps">'+
      '<li class="done"><span class="av-sdot">'+_avCheck(12)+'</span><b>Submitted</b><small>'+(setAt?_avNiceDT(row.pending_set_at):'Saved')+'</small></li>'+
      '<li class="'+(acked?'done':'wait')+'"><span class="av-sdot">'+(acked?_avCheck(12):'')+'</span><b>Acknowledged</b><small>'+(acked?_avNiceDT(row.availability_reviewed_at):'Waiting for your manager')+'</small></li>'+
      '<li class="next"><span class="av-sdot"></span><b>Goes live</b><small>'+_avNiceDate(row.pending_from,false)+' · '+when+'</small></li>'+
    '</ol><div class="av-fine">Tip: changes saved after Friday 12:00 pm start a week later, because the next week’s roster is built then.</div>';
  }else{
    let expired=false;
    if(!row.is_ongoing && row.valid_until){ const u=new Date(row.valid_until+'T00:00:00'), t=new Date(); t.setHours(0,0,0,0); expired=u<t; }
    pill = expired ? '<span class="av-pill expired"><i></i>Expired</span>' : '<span class="av-pill live"><i></i>Live</span>';
    title = expired ? 'Your availability has expired' : 'Your availability is live';
    let per = (!row.is_ongoing && row.valid_from) ? 'Valid from '+fmtF(row.valid_from)+(row.valid_until?' until '+fmtF(row.valid_until):'')+'. ' : '';
    sub = per+(typeof availStartNote==='function' ? availStartNote() : 'Any change you make starts from an upcoming Monday, so the current roster isn’t disturbed.');
  }
  const saved = row._justSaved ? '<div class="av-saved">'+_avCheck(14)+(row._appliedNow?'Saved. These hours are live now.':'Saved. We’ll switch to these hours on the start date.')+'</div>' : '';

  let h='<div class="av-card av-hero">'+
    '<div class="av-top"><span class="av-eyebrow">Availability</span>'+pill+'</div>'+
    '<div class="av-title">'+title+'</div><div class="av-sub">'+sub+'</div>'+saved+steps+
    '<div class="av-actions"><button type="button" class="av-btn" onclick="availStartEdit()">'+(pend?'Edit this change':'Edit availability')+'</button></div>'+
  '</div>';

  if(pend){
    h+='<div class="av-card"><div class="av-cmp-hd"><div></div>'+
      '<div class="av-col">Now<span class="av-pill live"><i></i>Live</span></div>'+
      '<div class="av-col">From '+_avNiceDate(row.pending_from,false)+'<span class="av-pill pending"><i></i>Pending</span></div></div>'+
      '<div class="av-rows">'+rows+'</div>'+
      '<div class="av-foot">'+(changed?'<b>'+changed+' day'+(changed!==1?'s':'')+' will change</b> · '+(7-changed)+' stay the same':'No days change. Your hours stay the same.')+'</div></div>';
  }else{
    h+='<div class="av-card"><div class="av-cmp-hd single"><div></div><div class="av-col">Your hours</div></div><div class="av-rows">'+rows+'</div></div>';
  }
  try{
    const _t=new Date(); _t.setHours(0,0,0,0); _t.setDate(_t.getDate()-((_t.getDay()+6)%7));
    const _cut=_effFmtIso(_t);
    const oo=(typeof _oneoffRows!=='undefined'&&_oneoffOK)?(_oneoffRows||[]).filter(function(o){return o.week_start>=_cut;}):[];
    if(oo.length){
      const floor=_effFmtIso(_availCutoffFloor());
      h+='<div class="av-card"><div class="av-cmp-hd single"><div></div><div class="av-col">One-off weeks<span class="av-pill pending"><i></i>This week only</span></div></div>'+
        '<div class="av-fine" style="margin:0 0 6px;">These replace your usual hours for that week only. Your usual hours carry on afterwards.</div>'+
        oo.map(function(o){
          const d=new Date(o.week_start+'T00:00:00');
          const just=(window._oneoffJustSaved===o.week_start);
          const days=FULL.map(function(dn,i){
            return '<div class="av-row single"><div class="av-d"><span class="l">'+dn+'</span><span class="s">'+SHORT[i]+'</span></div><div class="av-v">'+_avValHtml(get(o.availability,i),i)+'</div></div>';
          }).join('');
          return '<div style="padding:8px 0 4px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:4px 0;"><b>Week of '+_effFmtNice(d)+'</b>'+
            (just?'<span class="av-saved" style="margin:0;">'+_avCheck(14)+'Saved</span>':'')+
            (o.week_start>=floor?'<button type="button" class="av-btn" style="padding:4px 10px;font-size:12px;" onclick="cancelOneoff(\''+o.week_start+'\')">Cancel</button>':'<span style="font-size:11.5px;opacity:.6;">locked</span>')+
            '</div><div class="av-rows">'+days+'</div></div>';
        }).join('')+'</div>';
    }
  }catch(e){}
  host.innerHTML=h;
}

function showAvailSuccess(row){
  document.getElementById("availSuccess").style.display="block";
  document.getElementById("availFormArea").style.display="none";
  const banner=document.getElementById("availStatusBanner"); if(banner) banner.style.display="none";
  const ps=document.getElementById("availPendingStatus"); if(ps){ ps.style.display="none"; ps.innerHTML=""; }
  const _lb=document.getElementById("availLockBar"); if(_lb) _lb.style.display="none";
  renderAvailOverview(row);
  try{ if(typeof loadOneoffs==='function') loadOneoffs(); }catch(e){}
}
function availStartEdit(){
  showAvailForm();
  try{ loadExistingAvail(); }catch(e){}
}
function availBackToOverview(){
  if(window._availRow) showAvailSuccess(window._availRow);
}

function showAvailForm(){
  document.getElementById("availSuccess").style.display="none";
  document.getElementById("availFormArea").style.display="block";
  const bk=document.getElementById("availBack"); if(bk) bk.style.display = window._availRow ? "inline-flex" : "none";
  const banner=document.getElementById("availStatusBanner");
  if(banner){
    document.getElementById("availBannerIcon").textContent="";
    document.getElementById("availBannerTitle").textContent="Set your availability";
    document.getElementById("availBannerSub").textContent="Pick the days and hours you can work so your manager can plan the roster.";
    banner.style.display = window._availRow ? "none" : "flex";
  }
  try{ if(typeof applyAvailLock==='function') applyAvailLock(); }catch(e){}
  try{ refreshAvailPendingStatus(); }catch(e){}
}

function showAvailExpiredNotice(row){
  const banner=document.getElementById("availStatusBanner");
  let until="";
  if(row && !row.is_ongoing && row.valid_until){
    until=fmtF(row.valid_until);
  } else if(row && row.is_ongoing && row.updated_at){
    const exp=new Date(row.updated_at); exp.setMonth(exp.getMonth()+1);
    until=fmtF(exp.toISOString().slice(0,10));
  }
  if(banner){
    const t=document.getElementById("availBannerTitle");
    const s=document.getElementById("availBannerSub");
    if(t)t.textContent="Your availability has expired";
    if(s)s.textContent=(until?("It was valid until "+until+". "):"")+"Please set your availability again below.";
    banner.style.display="flex";
    banner.classList.add("avail-expired");
  }
  const area=document.getElementById("availFormArea");
  if(area && !document.getElementById("availExpiredStrip")){
    const strip=document.createElement("div");
    strip.id="availExpiredStrip";
    strip.style.cssText="display:flex;align-items:center;gap:10px;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:13px;font-weight:600;line-height:1.45;";
    strip.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'+
      '<span>'+(until?("Your availability expired on "+until+". "):"Your availability has expired. ")+'Please set it again before using the portal.</span>';
    area.insertBefore(strip, area.firstChild);
  }
}

const AVAIL_EARLY_THRESH_MIN = 30;
const AVAIL_EARLY_MIN_DAYS   = 3;

function _availDayIdx(d){ return (d.getDay()+6)%7; }
function _availToMin(hhmm){ if(!hhmm) return null; const p=hhmm.split(':'); return (+p[0])*60+(+p[1]); }
function _availFmt(min){ const h=Math.floor(min/60),m=min%60; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); }
function _availFloor15(min){ return Math.floor(min/15)*15; }

async function _availClockPattern(){
  try{
    const since = new Date(); since.setDate(since.getDate()-30);
    const rows = await sbGet('clock_log',
      '?staff_name=eq.'+encodeURIComponent(me)+
      '&action=eq.in&ts=gte.'+since.toISOString()+
      '&order=ts.asc&limit=500');
    if(!rows || !rows.length) return null;
    const perDate={};
    rows.forEach(r=>{
      const d=new Date(r.ts);
      const key=d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();
      const mins=d.getHours()*60+d.getMinutes();
      if(perDate[key]===undefined || mins<perDate[key].mins){ perDate[key]={mins,idx:_availDayIdx(d)}; }
    });
    const byDay={};
    Object.values(perDate).forEach(v=>{ (byDay[v.idx]=byDay[v.idx]||[]).push(v.mins); });
    const avg={};
    Object.keys(byDay).forEach(idx=>{
      const arr=byDay[idx];
      avg[idx]={ avgMin:Math.round(arr.reduce((a,b)=>a+b,0)/arr.length), n:arr.length };
    });
    return avg;
  }catch(e){ console.warn('availClockPattern failed',e); return null; }
}

function _availMismatch(avail, pattern){
  if(!pattern) return null;
  let totalDays=0; const days=[]; let earliestAvg=null;
  for(let i=0;i<7;i++){
    const a=avail[i]; if(!a) continue;
    let startMin;
    if(a.type==='all') startMin=_availToMin('09:00');
    else if(a.type==='custom' && a.start) startMin=_availToMin(a.start);
    else continue;
    const p=pattern[i]; if(!p) continue;
    if((startMin - p.avgMin) >= AVAIL_EARLY_THRESH_MIN){
      totalDays += p.n;
      days.push(i);
      if(earliestAvg===null || p.avgMin<earliestAvg) earliestAvg=p.avgMin;
    }
  }
  if(totalDays < AVAIL_EARLY_MIN_DAYS) return null;
  return {
    days, totalDays,
    suggest: _availFmt(_availFloor15(earliestAvg)),
    worstIdx: days[0]
  };
}

async function _availNudgedBefore(){
  try{
    const rows = await sbGet('staff_credentials',
      '?staff_name=eq.'+encodeURIComponent(me)+'&select=avail_nudged_at');
    return !!(rows && rows.length && rows[0].avail_nudged_at);
  }catch(e){ return false; }
}
async function _availMarkNudged(){
  try{
    await fetch(SB+'/rest/v1/staff_credentials?staff_name=eq.'+encodeURIComponent(me),{
      method:'PATCH',
      headers:{'apikey':KEY,'Authorization':'Bearer '+_sbBearer(),'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({avail_nudged_at:new Date().toISOString()})
    });
  }catch(e){ /* non-critical */ }
}

function _availShowNudge(mismatch, escalate){
  const host=document.getElementById('availErr');
  if(!host) return;
  let el=document.getElementById('availClockNudge');
  if(!el){
    el=document.createElement('div');
    el.id='availClockNudge';
    el.style.cssText='margin:10px 0;padding:12px 14px;border-radius:10px;font-size:13px;line-height:1.5;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;';
    host.parentNode.insertBefore(el, host);
  }
  const dayNames=mismatch.days.map(i=>DAYS[i]).join(', ');
  if(!escalate){
    el.innerHTML =
      '<strong>Heads up.</strong> Your recent clock-ins on '+dayNames+
      ' average earlier than the start you\'ve set. Your saved availability is fine for now — '+
      'just something to keep in mind next time.';
  }else{
    el.innerHTML =
      '<strong>Your clock-ins don\'t match your hours.</strong> On '+dayNames+
      ' you usually clock in around <strong>'+mismatch.suggest+'</strong>, earlier than the start you set. '+
      'Want to set your start to '+mismatch.suggest+'?'+
      '<div style="margin-top:10px;display:flex;gap:8px;">'+
        '<button class="btn btn-green" style="padding:6px 14px;font-size:12px;" onclick="_availApplySuggested(\''+mismatch.suggest+'\','+JSON.stringify(mismatch.days)+')">Yes, use '+mismatch.suggest+'</button>'+
        '<button class="btn btn-outline" style="padding:6px 14px;font-size:12px;" onclick="_availDismissNudge()">Keep my hours</button>'+
      '</div>';
  }
  el.style.display='block';
}
function _availDismissNudge(){ const el=document.getElementById('availClockNudge'); if(el)el.style.display='none'; }

function _availApplySuggested(suggest, dayIdxs){
  try{
    (dayIdxs||[]).forEach(i=>{
      const cur=dayState[i];
      if(!cur || cur.type==='no' || cur.type==='unset') return;
      setDay(i,'custom');
      const s=document.getElementById('cs-'+i), e=document.getElementById('ce-'+i);
      if(s){ s.value=suggest; enforceStartFloor(i); }
      if(e && (!e.value)) e.value='19:00';
      syncStartPreset(i);
    });
  }catch(_e){}
  _availDismissNudge();
  submitAvail();
}


/** Monday of NEXT week, Sydney, as yyyy-mm-dd. */
function nextMondaySydney(){
  const s = new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' });
  const d = new Date(s);
  d.setHours(0,0,0,0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + (7 - dow));
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

async function submitAvail(){
  const avail={},err=document.getElementById("availErr");err.classList.remove("show");
  const _dfmt=function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  if(typeof availLocked === 'function' && availLocked()){
    err.textContent = (typeof availLockMessage === 'function')
      ? availLockMessage() : 'Availability is locked right now.';
    err.classList.add("show");
    if(typeof applyAvailLock === 'function') applyAvailLock();
    return;
  }
  await loadEarlyStartApproval();
  const floor=earliestStart();
  for(let i=0;i<7;i++){
    const s=dayState[i];
    if(s.type==="custom"){
      const st=document.getElementById("cs-"+i).value,en=document.getElementById("ce-"+i).value;
      if(st<floor){err.textContent=DAYS[i]+": earliest start you're approved for is "+floor+".";err.classList.add("show");document.getElementById("cs-"+i).value=floor;return;}
      if(st>=en){err.textContent=DAYS[i]+": end time must be after start time.";err.classList.add("show");return;}
      avail[i]={type:"custom",start:st,end:en};
    }else if(s.type==="all" && i>=5){
      avail[i]={type:"custom",start:"09:00",end:"16:00"};
    }else avail[i]={type:s.type};
  }
  if(_availMode==='oneoff'){ return _saveOneoff(avail,err,document.getElementById("availBtn")); }
  const isOngoing=true, validFrom=null, validUntil=null;

  const btn=document.getElementById("availBtn");btn.disabled=true;btn.innerHTML='<span class="sp"></span> Saving...';
  try{
    const existing=await sbGet("staff_availability","?staff_name=eq."+encodeURIComponent(me)+"&limit=1");
    const _fortnight = (typeof window.availNextFortnight === 'function')
      ? _dfmt(window.availNextFortnight())
      : nextMondaySydney();
    let _effectiveFrom = _fortnight;
    if(typeof _effChosen==='string' && _effChosen){
      try{
        const cd=new Date(_effChosen+'T00:00:00');
        const _today=new Date(); _today.setHours(0,0,0,0);
        const _floor=(typeof _availCutoffFloor==='function')?_availCutoffFloor():_today;
        if(typeof _effIsFortnightStart==='function' && _effIsFortnightStart(cd) && cd>=_floor){
          _effectiveFrom = _effChosen;
        }
      }catch(e){}
    }
    try{
      const _p=_effectiveFrom.split('-').map(Number);
      const _dow=(new Date(_p[0],_p[1]-1,_p[2]).getDay()+6)%7;
      if(_dow!==0){
        let _m=new Date(_p[0],_p[1]-1,_p[2]-_dow);
        const _fl=(typeof _availCutoffFloor==='function')?_availCutoffFloor():null;
        if(_fl && _m<_fl) _m=new Date(_p[0],_p[1]-1,_p[2]-_dow+7);
        _effectiveFrom=_dfmt(_m);
      }
    }catch(_e){}
    const _liveValid = (typeof _hasValidAvailability === 'function')
      ? _hasValidAvailability(existing) : false;
    const _applyNow = !existing.length || !_liveValid;

    const payload = _applyNow
      ? { staff_name: me, availability: avail, is_ongoing: isOngoing,
          valid_from: null, valid_until: null,
          pending_availability: null, pending_from: null, pending_set_at: null,
          updated_at: new Date().toISOString() }
      : { pending_availability: avail,
          pending_from: _effectiveFrom,
          pending_set_at: new Date().toISOString(),
          updated_at: new Date().toISOString() };
    let res, _wroteRows=null;
    if(existing.length){
      res=await fetch(SB+"/rest/v1/staff_availability?staff_name=eq."+encodeURIComponent(me),{
        method:"PATCH",
        headers:{"apikey":KEY,"Authorization":"Bearer "+_sbBearer(),"Content-Type":"application/json","Prefer":"return=representation"},
        body:JSON.stringify(payload)
      });
      try{ _wroteRows = await res.clone().json(); }catch(_e){ _wroteRows = null; }
    }else{
      res=await sbPost("staff_availability",payload);
    }
    const _okStatus = res.ok||res.status===201||res.status===204;
    const _wroteOk = existing.length ? (Array.isArray(_wroteRows) && _wroteRows.length>0) : true;
    if(_okStatus && _wroteOk){
      try{
        await sbPost("staff_availability_history",{staff_name:me,availability:avail,is_ongoing:isOngoing,valid_from:validFrom||null,valid_until:validUntil||null,saved_at:payload.updated_at});
      }catch(_e){ /* history is non-critical */ }
      try{
        const _pattern = await _availClockPattern();
        const _mis = _availMismatch(avail, _pattern);
        if(_mis){
          const _before = await _availNudgedBefore();
          _availShowNudge(_mis, _before);
          if(!_before) await _availMarkNudged();
        }else{
          const _n=document.getElementById('availClockNudge'); if(_n)_n.style.display='none';
        }
      }catch(_e){ /* nudge is best-effort, never blocks the save */ }
      const _strip=document.getElementById("availExpiredStrip");
      if(_strip)_strip.remove();
      const _bn=document.getElementById("availStatusBanner");
      if(_bn)_bn.classList.remove("avail-expired");
      let _fresh=null;
      try{ const _rr=await sbGet("staff_availability","?staff_name=eq."+encodeURIComponent(me)+"&limit=1"); _fresh=_rr&&_rr[0]; }catch(_e){}
      if(!_fresh){
        const _was=(existing&&existing[0])||{};
        _fresh=_applyNow
          ? {availability:avail,is_ongoing:isOngoing,valid_from:validFrom,valid_until:validUntil}
          : {availability:_was.availability||{},is_ongoing:_was.is_ongoing,pending_availability:avail,pending_from:_effectiveFrom,pending_set_at:payload.pending_set_at};
      }
      _fresh._justSaved=true; _fresh._appliedNow=_applyNow;
      showAvailSuccess(_fresh);
      refreshAvailPendingStatus();
      loadHomeData();
      if(typeof recheckOnboarding==='function') recheckOnboarding();
    }else throw new Error("Server error "+res.status);
  }catch(e){err.textContent="Failed to save. Please check your connection.";err.classList.add("show");}
  finally{btn.disabled=false;btn.textContent="Save Availability";}
}


