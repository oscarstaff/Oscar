/* ── CHRISTMAS ACTIVITY: "GUESS THE CHILDHOOD PICTURE" ────────────────────────────────────────
   Staff add up to 5 photos of themselves as a child (5 MB each, JPEG / PNG / WebP), or choose "Count me out".
   Photos go into the PRIVATE storage bucket xmas-photos; each person only ever sees their own. Only the organiser
   (the database function xmas_is_organiser(), see scripts/sql/xmas-photo-game.sql) can see who joined, who counted
   themselves out, and the photos. The checks are in the database; this file only draws the screens.
   If the SQL has not been run yet, nothing shows at all.
   The popup opens once a day for people who have not answered yet; the small "Christmas photo game" button stays until XM.closes. */
const XM = {
  enabled: true,                        /* false = locked: nothing shows to anyone and no requests are made */
  title: 'Guess the Childhood Picture',
  bucket: 'xmas-photos',
  maxPhotos: 5,
  maxBytes: 5 * 1024 * 1024,
  closes: '2026-12-25',                 /* last day (Sydney) the button and the popup show; change the date here */
  types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  organiserLabel: 'Sanskar'
};

function _xmEsc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function _xmH(extra) { return Object.assign({ apikey: KEY, Authorization: 'Bearer ' + _sbBearer() }, extra || {}); }
function _xmToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date()); }
function _xmOpen() { return _xmToday() <= XM.closes; }
function _xmMB(n) { return (n / 1048576).toFixed(1) + ' MB'; }
function _xmUid() { try { return typeof _myAuthUid === 'function' ? _myAuthUid() : null; } catch (e) { return null; } }
function _xmToast(m) { try { if (typeof showToast === 'function') showToast(m); } catch (e) { /* ignore */ } }

/* a read that says "not there" (null) instead of pretending it is empty, so a missing table hides the feature */
async function _xmGet(path) {
  try { const r = await fetch(SB + '/rest/v1/' + path, { headers: _xmH() }); return r.ok ? await r.json() : null; } catch (e) { return null; }
}
async function _xmState(name) {
  const q = encodeURIComponent(name);
  const [photos, out] = await Promise.all([
    _xmGet('xmas_photos?staff_name=eq.' + q + '&select=id,path,size_bytes,created_at&order=created_at.asc'),
    _xmGet('xmas_optout?staff_name=eq.' + q + '&select=staff_name')
  ]);
  if (!Array.isArray(photos) || !Array.isArray(out)) return null;
  return { photos: photos, out: out.length > 0 };
}
async function _xmSign(paths) {
  const urls = {};
  for (let i = 0; i < paths.length; i += 50) {
    const part = paths.slice(i, i + 50);
    try {
      const r = await fetch(SB + '/storage/v1/object/sign/' + XM.bucket, { method: 'POST', headers: _xmH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ expiresIn: 3600, paths: part }) });
      const j = r.ok ? await r.json() : [];
      (Array.isArray(j) ? j : []).forEach(function (x) { if (x && x.path && x.signedURL) urls[x.path] = SB + '/storage/v1' + x.signedURL; });
    } catch (e) { /* the photo just shows as a blank tile */ }
  }
  return urls;
}
async function _xmRemoveFiles(paths) {
  for (let i = 0; i < paths.length; i += 50) {
    await fetch(SB + '/storage/v1/object/' + XM.bucket, { method: 'DELETE', headers: _xmH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: paths.slice(i, i + 50) }) });
  }
}

const XM_CSS = '' +
  '@keyframes xmFade{from{opacity:0}to{opacity:1}}@keyframes xmPop{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}' +
  '#xmModal{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.52);animation:xmFade .2s ease-out both}' +
  '#xmModal .xm-card{--xm:#15803d;position:relative;box-sizing:border-box;width:min(520px,100%);max-height:90vh;overflow:auto;border-radius:20px;padding:26px 22px 20px;background:var(--ui-surface,#fff);color:var(--ui-ink,#0f172a);box-shadow:0 28px 80px rgba(15,23,42,.38);outline:none;animation:xmPop .35s cubic-bezier(.16,1,.3,1) both}' +
  '#xmModal h2{font-size:20px;line-height:1.25;font-weight:800;margin:0 0 6px;padding-right:34px}' +
  '#xmModal p{font-size:14.5px;line-height:1.55;margin:0 0 12px;color:var(--ui-ink-2,#334155)}' +
  '#xmModal .xm-small{font-size:12.5px;color:var(--ui-ink-3,#64748b)}' +
  '#xmModal .xm-x{position:absolute;top:10px;right:10px;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:var(--ui-ink-3,#64748b);font-size:22px;line-height:1;cursor:pointer}' +
  '#xmModal .xm-x:hover{background:rgba(100,116,139,.14)}' +
  '#xmModal .xm-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;min-height:44px;padding:10px 16px;margin:0 8px 8px 0;border:1px solid rgba(100,116,139,.35);border-radius:12px;background:transparent;color:inherit;font:inherit;font-size:14.5px;font-weight:700;cursor:pointer}' +
  '#xmModal .xm-btn:disabled{opacity:.5;cursor:not-allowed}' +
  '#xmModal .xm-main{background:var(--xm);border-color:var(--xm);color:#fff}' +
  '#xmModal .xm-danger{border-color:#be123c;color:#be123c}' +
  '#xmModal .xm-btn:focus-visible,#xmModal .xm-x:focus-visible{outline:3px solid rgba(21,128,61,.45);outline-offset:2px}' +
  '#xmModal .xm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin:0 0 14px}' +
  '#xmModal .xm-tile{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:rgba(100,116,139,.16)}' +
  '#xmModal .xm-tile img{width:100%;height:100%;object-fit:cover;display:block}' +
  '#xmModal .xm-tile button{position:absolute;right:4px;bottom:4px;min-height:30px;padding:2px 9px;border:0;border-radius:8px;background:rgba(15,23,42,.78);color:#fff;font:inherit;font-size:12px;font-weight:700;cursor:pointer}' +
  '#xmModal .xm-msg{font-size:13.5px;line-height:1.5;margin:0 0 12px;padding:10px 12px;border-radius:10px;background:rgba(100,116,139,.12)}' +
  '#xmModal .xm-msg.bad{background:rgba(190,18,60,.1);color:#9f1239}' +
  '#xmModal h3{font-size:14px;margin:14px 0 6px}' +
  '#xmModal .xm-who{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 4px;font-size:14px;font-weight:700}' +
  '.xm-slot:empty{display:none}' +
  '.xm-slot-desk{margin:0 0 12px}' +
  '.xm-slot-phone{display:none}' +
  '.xm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:8px 14px;border:0;border-radius:10px;background:#15803d;color:#fff;font:inherit;font-size:13.5px;font-weight:700;line-height:1.2;cursor:pointer}' +
  '.xm-slot-desk .xm-btn{width:100%}' +
  '.xm-btn:focus-visible{outline:3px solid rgba(21,128,61,.5);outline-offset:2px}' +
  '@media (max-width:700px){.xm-slot-desk{display:none}.xm-slot-phone:not(:empty){display:block;flex:0 0 auto;align-self:flex-end;margin-left:auto}.xm-slot-phone .xm-btn{min-height:44px;max-width:86px;min-height:42px;padding:5px 8px;font-size:12px;line-height:1.15;text-align:center;border-radius:9px}}' +
  '@media (prefers-reduced-motion:reduce){#xmModal,#xmModal .xm-card{animation-duration:.01s!important}}';
function _xmCss() { if (document.getElementById('xmCss')) return; const s = document.createElement('style'); s.id = 'xmCss'; s.textContent = XM_CSS; document.head.appendChild(s); }

/* one modal at a time: showing a new screen replaces the old one */
function _xmShell(html) {
  _xmCss();
  let el = document.getElementById('xmModal');
  if (!el) {
    el = document.createElement('div'); el.id = 'xmModal';
    el.addEventListener('click', function (e) { if (e.target === el) _xmClose(); });
    document.addEventListener('keydown', _xmKey);
    document.body.appendChild(el);
  }
  el.innerHTML = '<div class="xm-card" role="dialog" aria-modal="true" aria-labelledby="xmTitle" tabindex="-1"><button type="button" class="xm-x" id="xmX" aria-label="Close">&times;</button>' + html + '</div>';
  el.querySelector('#xmX').onclick = _xmClose;
  try { el.querySelector('.xm-card').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  return el;
}
function _xmKey(e) { if (e.key === 'Escape') _xmClose(); }
function _xmClose() { document.removeEventListener('keydown', _xmKey); const m = document.getElementById('xmModal'); if (m) m.remove(); _xmRelease(); }

/* ---- the screen every staff member sees ---- */
async function openXmas(auto) {
  const name = (typeof me !== 'undefined' && me) || window.me; if (!name || !XM.enabled) return;
  _xmShell('<h2 id="xmTitle">' + _xmEsc(XM.title) + '</h2><p class="xm-small">Loading…</p>');
  const st = await _xmState(name);
  if (!st) { _xmClose(); _xmToast('The photo game is not set up yet.'); return; }
  const org = await _xmIsOrganiser();
  const full = st.photos.length >= XM.maxPhotos, left = XM.maxPhotos - st.photos.length, open = _xmOpen();
  const intro = '<p>Our Christmas team game. Send a photo or two of yourself as a child, and everyone guesses who is who. Only ' + _xmEsc(XM.organiserLabel) + ' can see who takes part and the photos. They are shown in the game without names and deleted when it is over.</p>';
  let body;
  if (st.out) {
    body = intro + '<div class="xm-msg">You counted yourself out. No problem, and nobody else can see that.</div>' +
      (open ? '<button type="button" class="xm-btn xm-main" id="xmIn">I changed my mind</button>' : '');
  } else {
    body = intro + '<div id="xmMsg"></div><div class="xm-grid" id="xmGrid"></div>' +
      (open ? '<input type="file" id="xmFile" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple hidden>' +
        '<button type="button" class="xm-btn xm-main" id="xmAdd"' + (full ? ' disabled' : '') + '>' + (full ? 'You have added ' + XM.maxPhotos + ' photos' : 'Add photos') + '</button>' +
        '<button type="button" class="xm-btn" id="xmOut">Count me out</button>' : '') +
      '<div class="xm-small">' + st.photos.length + ' of ' + XM.maxPhotos + ' photos added. Up to ' + XM.maxPhotos + ' photos, ' + _xmMB(XM.maxBytes).replace('.0', '') + ' each. JPEG, PNG or WebP.</div>';
  }
  if (!open) body += '<div class="xm-msg">This activity has finished.</div>';
  if (org) body += '<div style="margin-top:12px"><button type="button" class="xm-btn" id="xmOrg">Organiser view</button></div>';
  _xmShell('<h2 id="xmTitle">' + _xmEsc(XM.title) + '</h2>' + body);
  if (auto) { try { localStorage.setItem('nxxm:' + name, _xmToday()); } catch (e) { /* it may open again, that is fine */ } }

  const q = function (id) { return document.getElementById(id); };
  const say = function (t, bad) { const m = q('xmMsg'); if (m) m.innerHTML = t ? '<div class="xm-msg' + (bad ? ' bad' : '') + '">' + t + '</div>' : ''; };
  if (q('xmOrg')) q('xmOrg').onclick = openXmasOrganiser;
  if (q('xmIn')) q('xmIn').onclick = async function () {
    this.disabled = true;
    try { const r = await fetch(SB + '/rest/v1/xmas_optout?staff_name=eq.' + encodeURIComponent(name), { method: 'DELETE', headers: _xmH() }); if (!r.ok) throw new Error(); } catch (e) { _xmToast('Could not save that. Try again.'); }
    openXmas();
  };
  if (st.out) return;

  /* own photos */
  const grid = q('xmGrid');
  const urls = await _xmSign(st.photos.map(function (p) { return p.path; }));
  grid.innerHTML = st.photos.map(function (p, i) {
    return '<div class="xm-tile">' + (urls[p.path] ? '<img src="' + _xmEsc(urls[p.path]) + '" alt="Your photo ' + (i + 1) + '" loading="lazy">' : '') + (open ? '<button type="button" data-rm="' + _xmEsc(p.id) + '">Remove</button>' : '') + '</div>';
  }).join('');
  grid.querySelectorAll('[data-rm]').forEach(function (b) {
    b.onclick = async function () {
      const p = st.photos.find(function (x) { return x.id === b.dataset.rm; }); if (!p) return;
      b.disabled = true;
      try {
        await _xmRemoveFiles([p.path]);
        const r = await fetch(SB + '/rest/v1/xmas_photos?id=eq.' + encodeURIComponent(p.id), { method: 'DELETE', headers: _xmH() });
        if (!r.ok) throw new Error();
      } catch (e) { _xmToast('Could not remove that photo. Try again.'); }
      openXmas();
    };
  });

  if (q('xmOut')) q('xmOut').onclick = function () {
    const n = st.photos.length;
    _xmShell('<h2 id="xmTitle">Count yourself out?</h2><p>' + (n ? 'This also deletes the ' + n + (n === 1 ? ' photo' : ' photos') + ' you added. ' : '') + 'Nobody but ' + _xmEsc(XM.organiserLabel) + ' can see your answer, and you can change your mind any time before the game.</p>' +
      '<button type="button" class="xm-btn xm-main" id="xmYes">Yes, count me out</button><button type="button" class="xm-btn" id="xmNo">Go back</button>');
    q('xmNo').onclick = function () { openXmas(); };
    q('xmYes').onclick = async function () {
      this.disabled = true;
      try {
        if (n) { await _xmRemoveFiles(st.photos.map(function (p) { return p.path; })); const d = await fetch(SB + '/rest/v1/xmas_photos?staff_name=eq.' + encodeURIComponent(name), { method: 'DELETE', headers: _xmH() }); if (!d.ok) throw new Error(); }
        const r = await fetch(SB + '/rest/v1/xmas_optout', { method: 'POST', headers: _xmH({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify({ staff_name: name }) });
        if (!r.ok) throw new Error();
        _xmToast('Done. You are counted out.');
      } catch (e) { _xmToast('Could not save that. Try again.'); }
      openXmas();
    };
  };

  /* adding photos: checked here for a clear message, and again by the database and the bucket (they are what actually enforce it) */
  if (q('xmAdd')) {
    q('xmAdd').onclick = function () { q('xmFile').click(); };
    q('xmFile').onchange = async function () {
      const files = Array.from(this.files || []); this.value = '';
      if (!files.length) return;
      const problems = [], ok = [];
      files.forEach(function (f) {
        const t = XM.types[f.type] ? f.type : (/\.(jpe?g)$/i.test(f.name) ? 'image/jpeg' : /\.png$/i.test(f.name) ? 'image/png' : /\.webp$/i.test(f.name) ? 'image/webp' : '');
        if (!t) problems.push(_xmEsc(f.name) + ' is not a JPEG, PNG or WebP photo.');
        else if (f.size > XM.maxBytes) problems.push(_xmEsc(f.name) + ' is ' + _xmMB(f.size) + '. The limit is 5 MB.');
        else if (!f.size) problems.push(_xmEsc(f.name) + ' is empty.');
        else ok.push({ file: f, type: t });
      });
      if (ok.length > left) { problems.push('You can add ' + left + ' more ' + (left === 1 ? 'photo' : 'photos') + ', so only the first ' + left + ' ' + (left === 1 ? 'was' : 'were') + ' used.'); ok.length = left; }
      if (!ok.length) { say(problems.join('<br>'), true); return; }
      q('xmAdd').disabled = true; if (q('xmOut')) q('xmOut').disabled = true;
      const uid = _xmUid(); let done = 0;
      if (!uid) { say('Please sign in again.', true); q('xmAdd').disabled = false; return; }
      for (let i = 0; i < ok.length; i++) {
        say('Uploading ' + (i + 1) + ' of ' + ok.length + '…');
        const item = ok[i], path = uid + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + XM.types[item.type];
        let rowId = null;
        try {
          /* the row goes first (the database counts it and refuses a 6th photo), then the file */
          const rr = await fetch(SB + '/rest/v1/xmas_photos', { method: 'POST', headers: _xmH({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ staff_name: name, path: path, size_bytes: item.file.size }) });
          const rj = await rr.json().catch(function () { return null; });
          if (!rr.ok) throw new Error((rj && rj.message) || 'Could not save the photo.');
          rowId = rj && rj[0] && rj[0].id;
          const up = await fetch(SB + '/storage/v1/object/' + XM.bucket + '/' + path, { method: 'POST', headers: _xmH({ 'Content-Type': item.type, 'cache-control': '3600' }), body: item.file });
          if (!up.ok) throw new Error('The photo did not upload.');
          done++;
        } catch (e) {
          if (rowId) fetch(SB + '/rest/v1/xmas_photos?id=eq.' + encodeURIComponent(rowId), { method: 'DELETE', headers: _xmH() }).catch(function () {});
          problems.push(_xmEsc(item.file.name) + ': ' + _xmEsc(e.message || 'did not upload.'));
        }
      }
      if (done) _xmToast(done === 1 ? 'Photo added' : done + ' photos added');
      await openXmas();
      if (problems.length) { const m = document.getElementById('xmMsg'); if (m) m.innerHTML = '<div class="xm-msg bad">' + problems.join('<br>') + '</div>'; }
    };
  }
}

/* ---- organiser only ---- */
let _xmOrgCache = null;
async function _xmIsOrganiser() {
  if (_xmOrgCache !== null) return _xmOrgCache;
  try {
    const r = await fetch(SB + '/rest/v1/rpc/xmas_is_organiser', { method: 'POST', headers: _xmH({ 'Content-Type': 'application/json' }), body: '{}' });
    _xmOrgCache = r.ok ? (await r.json()) === true : false;
  } catch (e) { _xmOrgCache = false; }
  return _xmOrgCache;
}
async function openXmasOrganiser() {
  _xmShell('<h2 id="xmTitle">Organiser view</h2><p class="xm-small">Loading…</p>');
  const [photos, outs, names] = await Promise.all([
    _xmGet('xmas_photos?select=id,staff_name,path,size_bytes,created_at&order=staff_name.asc,created_at.asc&limit=1000'),
    _xmGet('xmas_optout?select=staff_name&order=staff_name.asc'),
    _xmGet('staff_names?select=name&order=name.asc')
  ]);
  if (!Array.isArray(photos) || !Array.isArray(outs)) { _xmShell('<h2 id="xmTitle">Organiser view</h2><p>Could not load. Try again.</p>'); return; }
  const by = {}; photos.forEach(function (p) { (by[p.staff_name] = by[p.staff_name] || []).push(p); });
  const joined = Object.keys(by).sort(), outNames = outs.map(function (o) { return o.staff_name; });
  const waiting = (Array.isArray(names) ? names : []).map(function (n) { return n.name; }).filter(function (n) { return !by[n] && outNames.indexOf(n) < 0; });
  const urls = await _xmSign(photos.map(function (p) { return p.path; }));
  const list = function (arr) { return arr.length ? '<p>' + arr.map(_xmEsc).join(', ') + '</p>' : '<p class="xm-small">Nobody.</p>'; };
  _xmShell('<h2 id="xmTitle">Organiser view</h2><p class="xm-small">Only you can see this page. ' + joined.length + ' joined with ' + photos.length + ' photos · ' + outNames.length + ' counted out · ' + waiting.length + ' have not answered.</p>' +
    '<h3>Joined</h3>' + (joined.length ? joined.map(function (n) {
      return '<div class="xm-who">' + _xmEsc(n) + '<span class="xm-small">' + by[n].length + (by[n].length === 1 ? ' photo' : ' photos') + '</span></div><div class="xm-grid">' +
        by[n].map(function (p) { return '<div class="xm-tile">' + (urls[p.path] ? '<a href="' + _xmEsc(urls[p.path]) + '" target="_blank" rel="noopener noreferrer"><img src="' + _xmEsc(urls[p.path]) + '" alt="Photo from ' + _xmEsc(n) + '" loading="lazy"></a>' : '') + '</div>'; }).join('') + '</div>';
    }).join('') : '<p class="xm-small">Nobody yet.</p>') +
    '<h3>Counted out</h3>' + list(outNames) + '<h3>Have not answered</h3>' + list(waiting) +
    '<div style="margin-top:14px"><button type="button" class="xm-btn" id="xmBack">Back</button><button type="button" class="xm-btn xm-danger" id="xmWipe">Delete everything</button></div>');
  document.getElementById('xmBack').onclick = function () { openXmas(); };
  document.getElementById('xmWipe').onclick = function () {
    _xmShell('<h2 id="xmTitle">Delete everything?</h2><p>This permanently deletes all ' + photos.length + ' photos and everyone\'s answers (joined and counted out). Do it after the game. It cannot be undone.</p>' +
      '<button type="button" class="xm-btn xm-danger" id="xmGo">Yes, delete everything</button><button type="button" class="xm-btn" id="xmNo2">Go back</button>');
    document.getElementById('xmNo2').onclick = openXmasOrganiser;
    document.getElementById('xmGo').onclick = async function () {
      this.disabled = true;
      try {
        await _xmRemoveFiles(photos.map(function (p) { return p.path; }));
        const a = await fetch(SB + '/rest/v1/xmas_photos?id=not.is.null', { method: 'DELETE', headers: _xmH() });
        const b = await fetch(SB + '/rest/v1/xmas_optout?staff_name=not.is.null', { method: 'DELETE', headers: _xmH() });
        if (!a.ok || !b.ok) throw new Error();
        _xmToast('Everything deleted');
      } catch (e) { _xmToast('Could not delete everything. Try again.'); }
      openXmasOrganiser();
    };
  };
}

/* ---- after sign-in: the small button, and the popup once a day for people who have not answered ----
   This popup goes FIRST. Until it has decided (and, if it opens, until it is closed) window._xmBlocking is true, and the
   wellbeing popup and the "turn on push reminders" clock popup wait their turn (they check it and try again in a moment). */
window._xmBlocking = !!(XM.enabled && _xmOpen());
function _xmRelease() { window._xmBlocking = false; }
setTimeout(function () { if (!document.getElementById('xmModal')) _xmRelease(); }, 15000);   /* safety: never hold the other popups back for long */
let _xmBusy = false;
async function checkXmas() {
  const name = (typeof me !== 'undefined' && me) || window.me;
  if (!XM.enabled || !name || !_xmOpen()) { _xmRelease(); return; }
  if (_xmBusy) return;
  _xmBusy = true;
  try {
    const st = await _xmState(name);
    if (!st) return;                                                    /* the SQL has not been run: show nothing */
    _xmCss();
    ['xmSlotCal', 'xmSlotClock'].forEach(function (id) {
      const slot = document.getElementById(id);
      if (!slot || slot.querySelector('.xm-btn')) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'xm-btn'; b.textContent = 'Christmas photo game';
      b.onclick = function () { openXmas(); };
      slot.appendChild(b);
    });
    const answered = st.out || st.photos.length > 0;
    let seen = ''; try { seen = localStorage.getItem('nxxm:' + name) || ''; } catch (e) { /* ignore */ }
    if (!answered && seen !== _xmToday() && !document.getElementById('wbModal') && !document.getElementById('rcnModal') && !document.getElementById('xmModal')) openXmas(true);
  } catch (e) { console.warn('checkXmas', e); }
  finally { _xmBusy = false; if (!document.getElementById('xmModal')) _xmRelease(); }
}
