'use strict';
/* pl-profile.js · Pipe-Line · Documents, Profile, Team achievements, Staff profile view.
   One of the Pipe-Line files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* ---------- Documents (read and open; upload and delete stay in Nexus) ---------- */
const DC = { q: '' };
route(/^\/documents$/, async () => {
  const [me, docs, quizzes] = await Promise.all([loadMe(), sel('documents', 'select=id,title,category,url,teams,uploaded_by,created_at&order=created_at.desc'), sel('custom_quizzes', 'select=id,document_id,status').catch(() => [])]);
  const mine = (docs || []).filter(d => ME.admin || !Array.isArray(d.teams) || !d.teams.length || (me.team && d.teams.includes(me.team)));
  const hasQuiz = {}; (quizzes || []).forEach(q => { if (q.document_id && q.status !== 'draft') hasQuiz[q.document_id] = true; });
  afterRender(() => {
    const body = $('#dcBody');
    const paint = () => {
      const q = DC.q.trim().toLowerCase();
      const list = mine.filter(d => !q || String(d.title || '').toLowerCase().includes(q) || String(d.category || '').toLowerCase().includes(q));
      body.innerHTML = list.length ? '<div class="nx-tablewrap"><table class="nx-table tight auto"><thead><tr><th>Document</th><th>Category</th><th>For</th><th>Added</th><th></th></tr></thead><tbody>' + list.map(d => {
        const u = safeUrl(d.url);
        return '<tr><td><b>' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(d.title || 'Untitled') + '</a>' : esc(d.title || 'Untitled')) + '</b>' + (hasQuiz[d.id] ? ' <span class="nx-tag walk">Has a quiz</span>' : '') + '</td><td>' + esc(d.category || '–') + '</td><td>' + (Array.isArray(d.teams) && d.teams.length ? d.teams.map(t => '<span class="nx-tag">' + esc(t) + '</span>').join(' ') : 'Everyone') + '</td><td>' + esc(fmtDate(d.created_at)) + (d.uploaded_by ? ' <span class="nx-muted">· ' + esc(d.uploaded_by) + '</span>' : '') + '</td><td class="nx-right">' + (u ? '<a class="nx-btn sm" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">Open</a>' : '<span class="nx-muted">No link</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : empty(q ? 'No documents match' : 'No documents yet', q ? 'Try a different word.' : 'Documents are added in Nexus and show here for your team.');
    };
    let t = 0; $('#dcQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { DC.q = e.target.value; paint(); }, 200); });
    paint();
  });
  return pageHead('doc', ME.admin ? 'All teams' : me.team ? 'Documents for the ' + me.team + ' team' : 'Documents for everyone', 'Documents', '') +
    '<div class="nx-card"><div class="nx-toolbar" style="border-top:0"><input class="nx-in sm" style="min-width:280px" id="dcQ" placeholder="Search documents" value="' + esc(DC.q) + '"><span class="nx-grow"></span><span class="nx-muted">Upload and delete in Nexus</span></div><div id="dcBody"></div></div>';
});

/* ---------- Profile (the parts that are about you; password, themes and notifications stay in Nexus) ---------- */
route(/^\/profile$/, async () => {
  const [me, dir] = await Promise.all([loadMe(true), staffDir().catch(() => ({}))]);
  const teams = {}; Object.keys(dir).sort().forEach(n => { const t = dir[n].team || 'No team'; (teams[t] = teams[t] || []).push(n); });
  afterRender(() => {
    const f = k => $('#pf_' + k);
    const snap = () => JSON.stringify([f('nickname').value.trim(), f('pronouns').value.trim(), f('birthday').value, f('bio').value.trim(), f('show_bio').checked]);
    let base = snap(); const save = $('#pfSave'), msg = $('#pfMsg');
    const dirty = () => { save.disabled = snap() === base; msg.textContent = ''; };
    ['nickname', 'pronouns', 'birthday', 'bio', 'show_bio'].forEach(k => { f(k).addEventListener('input', dirty); f(k).addEventListener('change', dirty); });
    save.onclick = async () => {
      const patch = { nickname: f('nickname').value.trim().slice(0, 40) || null, pronouns: f('pronouns').value.trim().slice(0, 30) || null, birthday: f('birthday').value || null, bio: f('bio').value.trim().slice(0, 280) || null, show_bio: f('show_bio').checked };
      save.classList.add('busy'); save.disabled = true;
      try { await upd('staff_credentials', 'staff_name=eq.' + encodeURIComponent(ME.name) + '&select=staff_name', patch); Object.assign(STAFF, { nickname: patch.nickname || '', pronouns: patch.pronouns || '', birthday: patch.birthday || '', bio: patch.bio || '', show_bio: patch.show_bio }); base = snap(); PV_CACHE = null; toast('Profile saved'); }
      catch (e) { msg.textContent = 'Not saved. ' + e.message; save.disabled = false; }
      save.classList.remove('busy');
    };
    const pick = $('#pfPhoto'), file = $('#pfFile');
    pick.onclick = () => file.click();
    file.onchange = async () => {
      const fl = file.files && file.files[0]; file.value = ''; if (!fl) return;
      if (!/^image\/(jpeg|png|webp)$/.test(fl.type)) return toast('Choose a JPG, PNG or WebP photo', true);
      if (fl.size > 8 * 1024 * 1024) return toast('That photo is over 8 MB', true);
      pick.classList.add('busy'); pick.disabled = true;
      try { await savePhoto(fl); toast('Photo updated'); render(); }
      catch (e) { toast('Photo not saved. ' + e.message, true); }
      pick.classList.remove('busy'); pick.disabled = false;
    };
  });
  const fact = (k, v) => '<div><dt>' + k + '</dt><dd>' + (v ? esc(v) : '<span class="nx-muted">–</span>') + '</dd></div>';
  return pageHead('user', 'Shared with your Nexus profile', 'Profile', '') +
    '<div class="nx-card"><div class="nx-hl"><span class="nx-avatar nx-pfava' + (me.avatar ? ' has-photo" style="background-image:url(&quot;' + esc(me.avatar) + '&quot;)"' : '"') + '>' + (me.avatar ? '' : esc(initials(ME.name))) + '</span><div><div class="nx-eyebrow">' + (ME.admin ? 'Hub admin' : 'Staff') + '</div><h2 class="nx-title">' + esc(ME.name) + '</h2></div>' +
    '<dl class="nx-facts">' + fact('Team', me.team) + fact('Email', me.email) + '</dl><div class="nx-btnrow"><a class="nx-btn" href="' + esc(staffHref(ME.name)) + '">View my profile</a><button class="nx-btn" id="pfPhoto">' + ico('edit') + 'Change photo</button><input type="file" id="pfFile" accept="image/jpeg,image/png,image/webp" hidden></div></div></div>' +
    '<div class="nx-card"><div class="nx-card-h"><h3>About you</h3></div><div class="nx-card-b"><div class="nx-form">' +
    '<div><label class="nx-lbl" for="pf_nickname">Nickname</label><input class="nx-in" id="pf_nickname" maxlength="40" value="' + esc(me.nickname) + '"><div class="nx-help">Shown beside your name in Nexus.</div></div>' +
    '<div><label class="nx-lbl" for="pf_pronouns">Pronouns</label><input class="nx-in" id="pf_pronouns" maxlength="30" value="' + esc(me.pronouns) + '"></div>' +
    '<div><label class="nx-lbl" for="pf_birthday">Birthday</label><input class="nx-in" type="date" id="pf_birthday" value="' + esc(me.birthday) + '"></div>' +
    '<div class="full"><label class="nx-lbl" for="pf_bio">Bio</label><textarea class="nx-ta" id="pf_bio" rows="3" maxlength="280">' + esc(me.bio) + '</textarea></div>' +
    '<div class="full"><label class="nx-check"><input type="checkbox" id="pf_show_bio"' + (me.show_bio ? ' checked' : '') + '> Show my bio to other staff</label></div></div>' +
    '<div class="nx-btnrow" style="margin-top:16px"><button class="nx-btn primary" id="pfSave" disabled>Save changes</button><span class="nx-err" id="pfMsg" role="alert"></span></div></div></div>' +
    (Object.keys(teams).length ? '<div class="nx-card"><div class="nx-card-h"><div><h3>Team directory</h3><div class="nx-muted">Open anyone’s profile.</div></div></div><div class="nx-card-b nx-dir">' + Object.keys(teams).sort().map(t => '<div><div class="nx-lbl">' + esc(t) + '</div><div class="nx-dirnames">' + teams[t].map(n => '<a href="' + esc(staffHref(n)) + '">' + esc(n) + '</a>').join('') + '</div></div>').join('') + '</div></div>' : '') +
    '<div class="nx-card"><div class="nx-note">' + ico('lock') + 'Password, security questions, themes and notification settings are changed in Nexus.</div></div>';
});
/* shrink the photo to 320px JPEG in the browser, store it in the avatars bucket under the person's own folder, then point staff_avatars at it */
async function savePhoto(file) {
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read that file.')); r.readAsDataURL(file); });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not a photo Pipe-Line can open.')); i.src = dataUrl; });
  const S = 320, c = document.createElement('canvas'); c.width = c.height = S;
  const side = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
  c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, S, S);
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Could not prepare the photo.');
  const tok = await bearer(), uid = (tokenPayload(tok) || {}).sub;
  if (!uid) throw new Error('Sign in again from Nexus and retry.');
  const path = uid + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
  let up; try { up = await fetch(SB + '/storage/v1/object/avatars/' + path, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'image/jpeg', 'cache-control': 'max-age=31536000' }, body: blob }); } catch (e) { throw offlineError(); }
  if (!up.ok) throw new Error('The photo store refused it (' + up.status + ').');
  const old = await sel('staff_avatars', 'select=avatar_path&staff_name=eq.' + encodeURIComponent(ME.name) + '&limit=1').catch(() => []);
  await api('staff_avatars?on_conflict=staff_name', { method: 'POST', body: [{ staff_name: ME.name, updated_at: new Date().toISOString(), avatar_path: path, avatar: null }], headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  const op = old && old[0] && old[0].avatar_path;
  if (op && op !== path) fetch(SB + '/storage/v1/object/avatars/' + op, { method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + tok } }).catch(() => {});
  STAFF.loaded = false; PV_CACHE = null;
}

/* ---------- Team achievements (same feed as Nexus: trainings passed, Glow for a perfect fortnight, call milestones) ---------- */
function achAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (!(days > 0)) return 'today'; if (days === 1) return 'yesterday'; if (days < 7) return days + ' days ago';
  if (days < 30) return Math.floor(days / 7) + (days < 14 ? ' week ago' : ' weeks ago'); if (days < 365) return Math.floor(days / 30) + (days < 60 ? ' month ago' : ' months ago');
  return Math.floor(days / 365) + (days < 730 ? ' year ago' : ' years ago');
}
route(/^\/achievements$/, async () => {
  const safe = p => p.catch(() => []);
  const [cq, tq, ph, cm, av] = await Promise.all([
    safe(sel('custom_quiz_results', 'select=staff_name,created_at&passed=is.true&order=created_at.desc&limit=200')),
    safe(sel('training_quiz_results', 'select=staff_name,created_at&passed=is.true&order=created_at.desc&limit=200')),
    safe(sel('punctuality_history', 'select=staff_name,score,x,fort_start&order=fort_start.desc&limit=2000')),
    safe(sel('call_milestones', 'select=staff_name,milestone,reached_at&order=reached_at.desc&limit=500')),
    safe(sel('staff_avatars', 'select=staff_name,avatar,avatar_path&limit=500'))
  ]);
  const ev = [];
  (cq || []).concat(tq || []).forEach(r => { if (r.staff_name && r.created_at) ev.push({ name: r.staff_name, type: 'training', date: r.created_at }); });
  /* Glow: a fortnight scored 100 with at least 4 shifts. The feed shows the first time each person earned it. */
  const perfect = (ph || []).filter(r => r.staff_name && r.fort_start && Number(r.score) === 100 && Number(r.x) >= 4);
  const firstGlow = {}; perfect.forEach(r => { if (!firstGlow[r.staff_name] || r.fort_start < firstGlow[r.staff_name]) firstGlow[r.staff_name] = r.fort_start; });
  Object.keys(firstGlow).forEach(n => ev.push({ name: n, type: 'glow', date: firstGlow[n] }));
  (cm || []).forEach(r => { if (r.staff_name && r.milestone && r.reached_at) ev.push({ name: r.staff_name, type: 'calls', n: Number(r.milestone), date: r.reached_at }); });
  ev.sort((a, b) => new Date(b.date) - new Date(a.date));
  /* glowing now: perfect in the most recent fortnight that has finished */
  const starts = Array.from(new Set((ph || []).map(r => r.fort_start).filter(Boolean))).sort();
  let target = null; for (let i = starts.length - 1; i >= 0; i--) { if (new Date(starts[i] + 'T00:00:00').getTime() + 14 * 86400000 <= Date.now()) { target = starts[i]; break; } }
  const glowing = target ? Array.from(new Set(perfect.filter(r => r.fort_start === target).map(r => r.staff_name))).sort() : [];
  const pic = {}; (av || []).forEach(r => { const u = avatarUrl(r); if (u && r.staff_name) pic[r.staff_name] = u; });
  const face = n => pic[n] ? '<span class="nx-avatar has-photo" style="background-image:url(&quot;' + esc(pic[n]) + '&quot;)"></span>' : '<span class="nx-avatar">' + esc(initials(n)) + '</span>';
  const what = e => e.type === 'glow' ? ['warn', 'Glow', 'earned Glow, a perfect fortnight'] : e.type === 'calls' ? ['info', 'Calls', 'logged ' + (e.n || 0).toLocaleString('en-AU') + ' calls'] : ['ok', 'Training', 'passed a training quiz'];
  const shown = ev.slice(0, 150);
  return pageHead('star', 'Same feed as Nexus', 'Team achievements', '') +
    (glowing.length ? '<div class="nx-card"><div class="nx-card-h"><div><h3>Glowing this fortnight</h3><div class="nx-muted">A perfect punctuality score in the last finished fortnight.</div></div></div><div class="nx-card-b nx-glowrow">' + glowing.map(n => '<a class="nx-who nx-wholink" href="' + esc(staffHref(n)) + '">' + face(n) + '<b>' + esc(n) + '</b></a>').join('') + '</div></div>' : '') +
    '<div class="nx-card"><div class="nx-card-h"><h3>Recently earned</h3></div>' + (shown.length ? '<ul class="nx-list nx-achlist">' + shown.map(e => { const w = what(e); return '<li><a class="nx-who nx-wholink" href="' + esc(staffHref(e.name)) + '">' + face(e.name) + '<span class="nx-achtxt"><b>' + esc(e.name) + '</b> ' + esc(w[2]) + '</span></a><span class="nx-btnrow"><span class="nx-pill ' + w[0] + '">' + w[1] + '</span><span class="nx-muted nx-achago">' + esc(achAgo(e.date)) + '</span></span></li>'; }).join('') + '</ul>' : empty('No achievements yet', 'Passed quizzes, perfect fortnights and call milestones show up here.')) + '</div>';
});

/* ---------- Staff profile view (#/staff/<name>): the Nexus "profile-view" page ----------
   Anyone's public profile: team, nickname, what they are known for, quick stats, bio and achievements.
   Built from the same tables as Nexus. Nexus-only cosmetics (name glow skins, banner perks) are not shown here. */
const PV_THEMES = { Enrolment: '#0369a1', Processing: '#c2410c', Placement: '#047857', Evershine: '#6d28d9', Accounts: '#334155', Education: '#4338ca', Office: '#0f766e' };
let PV_CACHE = null, PV_AT = 0;
function staffHref(n) { return '#/staff/' + encodeURIComponent(n); }
async function staffDir(force) {
  if (!force && PV_CACHE && Date.now() - PV_AT < 120000) return PV_CACHE;
  const safe = p => p.catch(() => []);
  const [names, creds, sett, pc, pt, ph, cm, mv, av] = await Promise.all([
    sel('staff_names', 'select=name&order=name.asc'),
    safe(sel('staff_credentials', 'select=staff_name,team,pronouns,nickname')),
    safe(sel('staff_settings', 'select=name,is_hub_admin')),
    safe(sel('custom_quiz_results', 'select=staff_name,quiz_id&passed=is.true&limit=5000')),
    safe(sel('training_quiz_results', 'select=staff_name,quiz_id&passed=is.true&limit=5000')),
    safe(sel('punctuality_history', 'select=staff_name,score,x,fort_start&order=fort_start.desc&limit=2000')),
    safe(sel('call_milestones', 'select=staff_name,milestone&limit=1000')),
    safe(sel('staff_team_history', 'select=staff_name,from_team,to_team,changed_at&order=changed_at.desc&limit=500')),
    safe(sel('staff_avatars', 'select=staff_name,avatar,avatar_path&limit=500'))
  ]);
  const by = {}; (names || []).forEach(n => { if (n && n.name) by[n.name] = { name: n.name, team: '', pronouns: '', nickname: '', admin: false, training: 0, punct: null, calls: 0, moves: [], avatar: '', glow: false, elite: false }; });
  (creds || []).forEach(c => { const p = by[c.staff_name]; if (p) { p.team = c.team || ''; p.pronouns = c.pronouns || ''; p.nickname = (c.nickname || '').trim(); } });
  (sett || []).forEach(x => { const p = by[x.name]; if (p) p.admin = x.is_hub_admin === true; });
  const passed = {}; (pc || []).concat(pt || []).forEach(r => { if (r && r.staff_name && r.quiz_id != null) (passed[r.staff_name] = passed[r.staff_name] || new Set()).add(String(r.quiz_id)); });
  Object.keys(passed).forEach(n => { if (by[n]) by[n].training = passed[n].size; });
  /* punctuality: each person's latest fortnight; Glow = a perfect score in the last fortnight that has finished */
  const starts = Array.from(new Set((ph || []).map(r => r.fort_start).filter(Boolean))).sort();
  let target = null; for (let i = starts.length - 1; i >= 0; i--) { if (new Date(starts[i] + 'T00:00:00').getTime() + 14 * 86400000 <= Date.now()) { target = starts[i]; break; } }
  (ph || []).forEach(r => {
    const p = by[r.staff_name]; if (!p) return;
    const days = Number(r.x) || 0, sc = Number(r.score) || 0;
    if (!p.punct) p.punct = { tier: days >= 4 && sc >= 90 ? 'gold' : days >= 4 && sc >= 80 ? 'silver' : null, score: sc, days, fort: String(r.fort_start || '').slice(0, 10) };
    if (target && r.fort_start === target && sc === 100 && days >= 4) p.glow = true;
  });
  (cm || []).forEach(r => { const p = by[r.staff_name]; if (!p) return; const m = Number(r.milestone) || 0; if (m > p.calls) p.calls = m; if (m >= 1000) { p.elite = true; p.glow = true; } });
  (mv || []).forEach(r => { const p = by[r.staff_name]; if (p) p.moves.push(r); });
  (av || []).forEach(r => { const p = by[r.staff_name]; if (p) p.avatar = avatarUrl(r); });
  PV_CACHE = by; PV_AT = Date.now(); return by;
}
function pvPeriod(fort) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fort || '')); if (!m) return 'last fortnight';
  const a = new Date(+m[1], +m[2] - 1, +m[3]), b = new Date(+m[1], +m[2] - 1, +m[3] + 13), f = d => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  return f(a) + ' to ' + f(b);
}
/* up to four tags earned from real activity, same rules as Nexus */
function pvKnownFor(p) {
  const t = [];
  if (p.elite) t.push(['The Call-Handler', 'ok']); else if (p.calls >= 500) t.push(['Phone legend', 'warn']); else if (p.calls >= 100) t.push(['Dial-ready', 'info']);
  if (p.punct && p.punct.tier === 'gold') t.push(['Never late', 'warn']); else if (p.punct && p.punct.tier === 'silver') t.push(['Reliably on time', '']);
  if (p.training >= 10) t.push(['Walking handbook', 'ok']); else if (p.training >= 5) t.push(['Quiz champion', 'ok']); else if (p.training >= 1) t.push(['Always learning', 'ok']);
  if (p.glow && !p.elite) t.push(['Perfect fortnight', 'accent']);
  const m0 = p.moves[0]; if (m0 && Date.now() - new Date(m0.changed_at).getTime() < 30 * 86400000) t.unshift(['New to ' + (m0.to_team || 'the team'), 'accent']);
  if (p.admin) t.push(['Behind the scenes', 'warn']);
  return t.slice(0, 4);
}
/* earned achievements, plus the next one to aim for shown as locked */
function pvAchievements(p) {
  const rows = [], add = (title, sub, badge, tone, locked) => rows.push({ title, sub, badge, tone, locked: !!locked });
  if (p.glow) add(p.elite ? 'The Call-Handler' : 'Perfect Fortnight', p.elite ? 'Elite glow: 1,000 calls logged' : 'Glow earned for a perfect fortnight', p.elite ? 'Elite' : 'Glow', p.elite ? 'ok' : 'warn');
  if (p.calls >= 1000) add('1,000 Calls Logged', 'Elite call milestone', '1,000', 'ok');
  else {
    if (p.calls >= 100) add('100 Calls Logged', 'Call volume milestone', '100', 'info');
    if (p.calls >= 500) add('500 Calls Logged', 'Consistent dedication', '500', 'warn');
    const nx = p.calls < 100 ? 100 : p.calls < 500 ? 500 : 1000;
    add('Next: ' + nx.toLocaleString('en-AU') + ' Calls Logged', nx === 1000 ? 'Unlocks the Call-Handler glow' : 'Keep logging calls', 'Locked', '', true);
  }
  const pu = p.punct;
  if (pu && pu.score != null) {
    const pd = pu.days, ps = pu.score, per = pvPeriod(pu.fort) + ' · ' + ps + '% on time (' + (pd || '?') + ' days)';
    if (pd >= 4 && ps >= 90) add('Gold: On-Time Club', per, 'Gold', 'warn'); else if (pd >= 4 && ps >= 80) add('Silver: On-Time Club', per, 'Silver', ''); else if (pd >= 4 && ps >= 70) add('Bronze: On-Time Club', per, 'Bronze', 'warn');
    if (pd >= 4 && ps >= 100) add('Spotless Fortnight', 'Every measured day on time · ' + pvPeriod(pu.fort), '100%', 'ok');
    if (!(pd >= 4 && ps >= 90)) { const n = pd >= 4 && ps >= 80 ? ['Gold', 90] : pd >= 4 && ps >= 70 ? ['Silver', 80] : ['Bronze', 70]; add('Next: ' + n[0] + ', On-Time Club', pd < 4 ? 'Needs 4 or more measured days' : 'Reach ' + n[1] + '% on time (now ' + ps + '%)', 'Locked', '', true); }
  }
  const tc = p.training, steps = [[1, 'First Quiz Passed'], [3, 'Getting Into It'], [5, 'Quiz Regular'], [10, 'Walking Handbook'], [20, 'Training Master']];
  let top = null; steps.forEach(k => { if (tc >= k[0]) top = k; });
  if (top) add(top[1], tc + (tc === 1 ? ' training passed' : ' trainings passed'), String(tc), 'ok');
  const nxs = steps.find(k => tc < k[0]); if (nxs) add('Next: ' + nxs[1], (nxs[0] - tc) + (nxs[0] - tc === 1 ? ' more training to go' : ' more trainings to go'), 'Locked', '', true);
  if (p.moves.length >= 1) add(p.moves.length >= 2 ? 'Team Explorer' : 'Fresh Start', p.moves.length >= 2 ? 'Worked across ' + (p.moves.length + 1) + ' teams' : 'Moved to a new team', p.moves.length >= 2 ? String(p.moves.length + 1) : 'New', 'info');
  return rows;
}
route(/^\/staff\/(.+)$/, async m => {
  let name = m[1]; try { name = decodeURIComponent(name); } catch (e) {}
  const dir = await staffDir(), p = dir[name];
  const back = '<div class="nx-crumbs"><button type="button" class="nx-btn quiet sm" id="pvBack">' + ico('back') + 'Back</button></div>';
  afterRender(() => { const b = $('#pvBack'); if (b) b.onclick = () => { if (history.length > 1) history.back(); else go('#/achievements'); }; });
  if (!p) return back + '<div class="nx-card">' + empty('Staff member not found', 'Nobody called ' + name + ' is in the staff list.') + '</div>';
  let bio = '';
  try { const r = await sel('staff_credentials', 'select=bio,show_bio&staff_name=eq.' + encodeURIComponent(name) + '&limit=1'); const b = ((r && r[0] && r[0].bio) || '').trim(); if (b && (name === ME.name || r[0].show_bio !== false)) bio = b; } catch (e) {}
  const col = PV_THEMES[p.team] || 'var(--nx-accent)';
  const known = pvKnownFor(p), ach = pvAchievements(p), earned = ach.filter(a => !a.locked).length;
  const stats = [];
  if (p.calls > 0) stats.push([p.calls.toLocaleString('en-AU') + '+', 'Calls logged']);
  if (p.training > 0) stats.push([String(p.training), p.training === 1 ? 'Training passed' : 'Trainings passed']);
  if (p.punct && p.punct.score != null) stats.push([p.punct.score + '%', 'On time, ' + pvPeriod(p.punct.fort)]);
  const day = v => { const d = new Date(v); return isNaN(d) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); };
  return back +
    '<div class="nx-card nx-pv"><div class="nx-pvband" style="background:' + col + '"><span aria-hidden="true">' + esc((p.team || '').toUpperCase()) + '</span></div><div class="nx-pvbody">' +
    '<span class="nx-avatar nx-pvava' + (p.avatar ? ' has-photo" style="background-image:url(&quot;' + esc(p.avatar) + '&quot;)"' : '"') + '>' + (p.avatar ? '' : esc(initials(name))) + '</span>' +
    '<div class="nx-pvhead"><div><h1 class="nx-title">' + esc(name) + (p.nickname ? ' <span class="nx-pvaka">aka “' + esc(p.nickname) + '”</span>' : '') + '</h1>' + (p.elite ? '<div class="nx-pvtitle">The Call-Handler</div>' : '') +
    '<div class="nx-pvmeta">' + (p.team ? '<span class="nx-tag">' + esc(p.team) + ' team</span>' : '') + (p.admin ? '<span class="nx-tag walk">Admin</span>' : '') + (p.pronouns ? '<span class="nx-muted">' + esc(p.pronouns) + '</span>' : '') + '</div></div>' +
    (name === ME.name ? '<a class="nx-btn" href="#/profile">' + ico('edit') + 'Edit profile</a>' : '') + '</div>' +
    (p.moves.length ? '<ul class="nx-pvmoves">' + p.moves.slice(0, 3).map(r => '<li>Moved from <b>' + esc(r.from_team || '?') + '</b> to <b>' + esc(r.to_team || '?') + '</b> · ' + esc(day(r.changed_at)) + '</li>').join('') + '</ul>' : '') +
    (known.length ? '<div class="nx-pvknown"><div class="nx-lbl">Known for</div><div>' + known.map(k => '<span class="nx-pill ' + k[1] + '">' + esc(k[0]) + '</span>').join('') + '</div></div>' : '') +
    (stats.length ? '<dl class="nx-pvstats">' + stats.map(x => '<div><dd class="nx-big">' + esc(x[0]) + '</dd><dt>' + esc(x[1]) + '</dt></div>').join('') + '</dl>' : '') +
    '</div></div>' +
    (bio ? '<div class="nx-card"><div class="nx-card-h"><h3>In their words</h3></div><div class="nx-card-b"><blockquote class="nx-pvbio">' + esc(bio) + '</blockquote></div></div>' : '') +
    '<div class="nx-card"><div class="nx-card-h"><h3>Achievements</h3>' + (earned ? '<span class="nx-muted">' + earned + ' earned</span>' : '') + '</div>' +
    (ach.length ? '<ul class="nx-list nx-achrows">' + ach.map(a => '<li class="' + (a.locked ? 'locked' : '') + '"><div class="nx-qz"><b>' + esc(a.title) + '</b><small>' + esc(a.sub) + '</small></div>' + (a.locked ? '<span class="nx-tag">Locked</span>' : '<span class="nx-pill ' + a.tone + '">' + esc(a.badge) + '</span>') + '</li>').join('') + '</ul>' : empty('No achievements yet', 'Early days.')) + '</div>';
});
