// Tests for the hours calculation in index.html (calcHoursForRange). The function is lifted
// out of the page and run against fixtures, including the stray-extra-clock-out bug.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function calcHoursForRange(');
assert.ok(start > 0, 'calcHoursForRange not found in index.html');
let depth = 0, i = html.indexOf('{', start), end = -1;
for (let j = i; j < html.length; j++) {
  if (html[j] === '{') depth++;
  else if (html[j] === '}' && --depth === 0) { end = j + 1; break; }
}
const ctx = { _hoursLogs: [] };
vm.createContext(ctx);
vm.runInContext(html.slice(start, end), ctx);
const calc = (logs, s, e) => { ctx._hoursLogs = logs; return vm.runInContext('calcHoursForRange', ctx)(new Date(s), new Date(e)); };
const H = (ms) => ms / 3600000;
const L = (action, ts) => ({ action, ts });

const day = ['2026-10-14T00:00:00Z', '2026-10-15T00:00:00Z'];

// normal day: 12:06 -> 19:00 local (Sydney +11) = 01:06Z -> 08:00Z
let r = calc([L('in', '2026-10-14T01:06:00Z'), L('out', '2026-10-14T08:00:00Z')], ...day);
assert.equal(r.sessions, 1); assert.ok(Math.abs(H(r.totalMs) - 6.9) < 0.01);

// stray extra auto 8pm out after the real out must NOT add hours
r = calc([L('in', '2026-10-14T01:06:00Z'), L('out', '2026-10-14T08:00:00Z'), L('out', '2026-10-14T09:00:00Z')], ...day);
assert.equal(r.sessions, 1); assert.ok(Math.abs(H(r.totalMs) - 6.9) < 0.01);

// forgot to clock out: auto 8pm closes the session
r = calc([L('in', '2026-10-14T01:06:00Z'), L('out', '2026-10-14T09:00:00Z')], ...day);
assert.ok(Math.abs(H(r.totalMs) - 7.9) < 0.01);

// still clocked in: open session reported, no completed hours
r = calc([L('in', '2026-10-14T01:06:00Z')], '2026-10-14T00:00:00Z', '2026-10-16T00:00:00Z');
assert.equal(r.sessions, 0); assert.ok(r.openIn);

// two shifts in one day
r = calc([L('in', '2026-10-14T00:00:00Z'), L('out', '2026-10-14T02:00:00Z'), L('in', '2026-10-14T04:00:00Z'), L('out', '2026-10-14T06:00:00Z')], ...day);
assert.equal(r.sessions, 2); assert.equal(H(r.totalMs), 4);

console.log('test-clock: all hours-calculation tests passed');
