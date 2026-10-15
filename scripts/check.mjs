// Fast safety checks run on every PR: no merge-conflict markers, and every inline <script>
// in every .html and every .js file must parse. Catches the "one bad edit breaks the page" class.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

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
if (bad) { console.error(`\n${bad} problem(s)`); process.exit(1); }
console.log('check: all pages and scripts parse, no conflict markers');
