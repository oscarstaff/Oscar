'use strict';
/* pl-staff.js · YatraLine · who am I as a staff member (loadMe, team).
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* =========================================================
   YatraLine staff pages, copied from Nexus (15 Nov 2026): Quizzes, Documents, Profile.
   Nexus keeps its own versions and stays the place for quiz building, document upload,
   passwords, themes and notifications. Same Supabase tables, so both apps show the same data.
   ========================================================= */

/* ---------- who am I as a staff member ---------- */
const STAFF = { loaded: false, team: '', email: '', nickname: '', bio: '', show_bio: false, birthday: '', pronouns: '', shiftAdmin: false, shiftops: false, avatar: '' };
function avatarUrl(row) {
  if (!row) return '';
  if (row.avatar_path) return SB + '/storage/v1/object/public/avatars/' + String(row.avatar_path).split('/').map(encodeURIComponent).join('/');
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(row.avatar || '') ? row.avatar : '';
}
async function loadMe(force) {
  if (STAFF.loaded && !force) return STAFF;
  const n = encodeURIComponent(ME.name);
  const [cr, ap, av] = await Promise.all([
    sel('staff_credentials', 'select=staff_name,team,email,nickname,bio,show_bio,birthday,pronouns,is_shift_admin&staff_name=eq.' + n + '&limit=1'),
    sel('app_access', 'select=app&app=eq.shiftops&staff_name=eq.' + n + '&limit=1').catch(() => []),
    sel('staff_avatars', 'select=avatar,avatar_path&staff_name=eq.' + n + '&limit=1').catch(() => [])
  ]);
  const c = (Array.isArray(cr) && cr[0]) || {};
  Object.assign(STAFF, { loaded: true, team: c.team || '', email: c.email || '', nickname: c.nickname || '', bio: c.bio || '', show_bio: c.show_bio === true, birthday: c.birthday || '', pronouns: c.pronouns || '', shiftAdmin: c.is_shift_admin === true, shiftops: Array.isArray(ap) && ap.length > 0, avatar: avatarUrl(Array.isArray(av) && av[0]) });
  paintWho();
  return STAFF;
}
/* top bar: the name chip and avatar open Profile; the avatar shows the photo when there is one */
function paintWho() {
  const a = $('#whoAva'); if (!a) return;
  if (STAFF.avatar) { a.textContent = ''; a.style.backgroundImage = 'url("' + STAFF.avatar.replace(/["\\\n]/g, '') + '")'; a.classList.add('has-photo'); }
  else { a.style.backgroundImage = ''; a.classList.remove('has-photo'); a.textContent = initials(ME.name); }
}
function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
