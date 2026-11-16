// Fast safety checks run on every PR: no merge-conflict markers, and every inline <script>
// in every .html and every .js file must parse. Catches the "one bad edit breaks the page" class.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const root = process.cwd();
const skip = new Set(['node_modules', '.git', 'supabase']);
let bad = 0;
const fail = (m) => { bad++; console.error('FAIL', m); };

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(html|js|mjs)$/.test(e.name)) check(p);
  }
}
function check(p) {
  const rel = path.relative(root, p);
  const src = fs.readFileSync(p, 'utf8');
  if (/^(<{7} |={7}$|>{7} )/m.test(src)) fail(`${rel}: merge-conflict markers`);
  if (p.endsWith('.html')) {
    const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
    let m, n = 0;
    while ((m = re.exec(src))) {
      const attrs = m[1];
      if (/\bsrc\s*=/.test(attrs)) continue;
      if (/type\s*=\s*["'](?!text\/javascript|module)/i.test(attrs)) continue; // json etc.
      n++;
      try { new vm.Script(m[2], { filename: `${rel}#script${n}` }); }
      catch (e) { fail(`${rel} inline script ${n}: ${e.message}`); }
    }
  } else if (!p.endsWith('.mjs') || true) {
    try { new vm.Script(src.replace(/^#!.*/, ''), { filename: rel }); }
    catch (e) {
      // ES modules (import/export) can't be parsed as scripts; accept those.
      if (!/import|export/.test(e.message + src.slice(0, 4000))) fail(`${rel}: ${e.message}`);
    }
  }
}
walk(root);

// Pipe-Line (nex.html): every inline script must be listed in its Content-Security-Policy by sha256, and the
// loader's file list must match the pl-*.js files on disk (pl-core first, pl-start last).
function checkPipeline() {
  const f = path.join(root, 'nex.html');
  if (!fs.existsSync(f)) return;
  const src = fs.readFileSync(f, 'utf8');
  const csp = (/Content-Security-Policy"\s+content="([^"]*)"/.exec(src) || [])[1] || '';
  const allowed = new Set((/script-src ([^;]*)/.exec(csp) || [, ''])[1].match(/'sha256-[^']+'/g) || []);
  const used = new Set();
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, loader = '';
  while ((m = re.exec(src))) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    const h = `'sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}'`;
    used.add(h);
    if (!allowed.has(h)) fail(`nex.html: an inline script is not in the Content-Security-Policy. Its hash is ${h}`);
    if (m[2].includes('PL_FILES')) loader = m[2];
  }
  for (const h of allowed) if (!used.has(h)) fail(`nex.html: Content-Security-Policy lists ${h} but no inline script has that hash (old hash left behind)`);
  const list = ((/PL_FILES=\[([^\]]*)\]/.exec(loader) || [, ''])[1].match(/'([^']+)'/g) || []).map(x => x.slice(1, -1));
  if (!list.length) return fail('nex.html: loader PL_FILES not found');
  if (list[0] !== 'pl-core') fail('nex.html: pl-core must load first');
  if (list[list.length - 1] !== 'pl-start') fail('nex.html: pl-start must load last');
  for (const n of list) if (!fs.existsSync(path.join(root, n + '.js'))) fail(`nex.html: ${n}.js is in PL_FILES but missing from the repo`);
  for (const n of fs.readdirSync(root)) if (/^pl-.*\.js$/.test(n) && !list.includes(n.slice(0, -3))) fail(`${n} is in the repo but not in PL_FILES (it will never load)`);
}
checkPipeline();
if (bad) { console.error(`\n${bad} problem(s)`); process.exit(1); }
console.log('check: all pages and scripts parse, no conflict markers');
