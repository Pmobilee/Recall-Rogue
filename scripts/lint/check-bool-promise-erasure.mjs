#!/usr/bin/env node
/**
 * scripts/lint/check-bool-promise-erasure.mjs
 *
 * Preventative lint for "bool-vs-void IPC contract erasure".
 *
 * The pattern: a function declared `async function foo(...): Promise<boolean>` that
 * returns a meaningful success/fail boolean (Steam IPC, Tauri invoke, transport
 * `send` returning ack-resolved status, etc.) is invoked by callers that only
 * `.catch()` the rejection and never read the resolved boolean. The boolean is
 * silently erased. Failures look like successes.
 *
 * Triggered the BUG-1, BUG-2, BUG-25 silent-failure cluster in the multiplayer
 * stack — see docs/gotchas.md / leaderboard MP-STEAM-20260422-035.
 *
 * What this script does
 * ─────────────────────
 * 1. Scan a curated set of source files (steamNetworkingService.ts,
 *    multiplayerTransport.ts, multiplayerLobbyService.ts, multiplayerCoopSync.ts,
 *    multiplayerGameService.ts) — extend WATCH_LIST below as new IPC layers land.
 * 2. Find every exported async function whose declared return type is
 *    `Promise<boolean>` (or `Promise<boolean | …>`).
 * 3. For each such symbol, scan ALL TypeScript files under src/ for callers.
 * 4. A caller is flagged if the call expression is followed only by `.catch(…)`
 *    with no `.then(…)` / `await` / variable assignment / `if (await foo())`
 *    pattern that inspects the resolved value.
 *
 * Allowlist
 * ─────────
 *   - `// lint-allow: bool-promise-erasure — <reason>` on the same line or the
 *     line immediately above suppresses the flag.
 *   - Test files (*.test.ts, tests/**) are exempt — assertions cover them.
 *   - Calls inside an `await Promise.all([...])` array literal are exempt
 *     (Promise.all surfaces the resolved value to the caller).
 *
 * Usage
 * ─────
 *   node scripts/lint/check-bool-promise-erasure.mjs           # exits 0/1
 *   node scripts/lint/check-bool-promise-erasure.mjs --json    # machine output
 *
 * Added 2026-04-22 — preventative side of two-sided enforcement for
 * MP-STEAM-20260422-035. Reactive side is the contentSelection-on-start unit
 * test (multiplayerLobbyService.test.ts BUG-14 + 014 cases).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');

// Files to scan for Promise<boolean>-returning declarations.
const WATCH_LIST = [
  'src/services/steamNetworkingService.ts',
  'src/services/multiplayerTransport.ts',
  'src/services/multiplayerLobbyService.ts',
  'src/services/multiplayerCoopSync.ts',
  'src/services/multiplayerGameService.ts',
  'src/services/multiplayerWorkshopService.ts',
];

const JSON_OUT = process.argv.includes('--json');

// ─── Helpers ──────────────────────────────────────────────────────────────

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules' || entry.name === '_archived') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|svelte)$/.test(entry.name)) yield full;
  }
}

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

// Find every exported `async function NAME(...): Promise<boolean ...>` declaration
// in a watched source file. Returns Map<funcName, { file, line }>.
function findBoolPromiseExports() {
  const out = new Map();
  for (const rel of WATCH_LIST) {
    const abs = path.join(REPO_ROOT, rel);
    const src = readSafe(abs);
    if (!src) continue;
    const lines = src.split('\n');
    // Match: export async function name(...): Promise<boolean> {
    //        export async function name(...): Promise<boolean | null> {
    // Spread across lines is allowed via multiline regex on the joined source.
    // We use a stricter line-anchored single-line match first; multiline rare.
    const re = /^export\s+async\s+function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*:\s*Promise<\s*boolean\b/;
    lines.forEach((ln, i) => {
      const m = ln.match(re);
      if (m) out.set(m[1], { file: rel, line: i + 1 });
    });
    // Multiline form — collapse signature into one line by joining until first `{`.
    const reMulti = /export\s+async\s+function\s+([A-Za-z_$][\w$]*)[\s\S]*?:\s*Promise<\s*boolean\b[\s\S]*?\{/g;
    let mm;
    while ((mm = reMulti.exec(src)) !== null) {
      const name = mm[1];
      if (!out.has(name)) {
        const lineNum = src.slice(0, mm.index).split('\n').length;
        out.set(name, { file: rel, line: lineNum });
      }
    }
  }
  return out;
}

// Determine if a call site is a "bool-erased" usage.
// Heuristic: the call (`name(...)`) is immediately followed by `.catch(`
// with no surrounding `await`, no `.then(`, no `if (`, no assignment, and not
// inside `Promise.all([ ... ])`.
function isBoolErasedCall(text, callIdx, name) {
  // Look backwards a small window for context.
  const before = text.slice(Math.max(0, callIdx - 80), callIdx);
  // Look forward enough to clear the closing paren plus chain.
  const after = text.slice(callIdx, callIdx + 200);

  // Must be a bare `name(` call, not `.name(` (method) or `_name`.
  const charBefore = text[callIdx - 1] || '';
  if (charBefore === '.' || /[A-Za-z0-9_$]/.test(charBefore)) return false;

  // Skip `await name(...)` — caller is reading the resolved value.
  if (/\bawait\s*$/.test(before)) return false;

  // Skip `void name(...)` — explicit intentional discard, callers chose this.
  if (/\bvoid\s*$/.test(before)) return false;

  // Skip `= name(...)` / `return name(...)` — value flows somewhere.
  if (/[=]\s*$/.test(before)) return false;
  if (/\breturn\s*$/.test(before)) return false;

  // Skip arrow body `=> name(...)` — value flows back through the arrow's
  // resolved promise (typical inside `.map(x => fn(x).catch(() => false))`
  // wrapped by Promise.all, where the .catch returns a real fallback value).
  if (/=>\s*$/.test(before)) return false;

  // Skip Promise.all(...) array context — both [literal] and .map() forms.
  const widerBefore = text.slice(Math.max(0, callIdx - 400), callIdx);
  if (/Promise\.all\(\s*\[[^\]]*$/.test(widerBefore)) return false;
  if (/Promise\.all\([^)]*\.map\(/.test(widerBefore)) return false;

  // Find matching close paren of THIS call.
  let depth = 0;
  let i = callIdx + name.length;
  if (text[i] !== '(') return false;
  for (; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  // Now i points just past the matching ')'. Look at the chain that follows.
  const chain = text.slice(i, i + 200);
  // Allow whitespace + comments before `.`
  const trimmed = chain.replace(/^[\s\n]+/, '');

  // Pattern `.catch(...)` only, no `.then(...)`.
  if (!trimmed.startsWith('.catch(')) return false;

  // Inspect the catch handler. If it returns a real value (e.g. `() => false`,
  // `() => null`, `(e) => fallback`), the caller still receives a defined
  // boolean / value via Promise resolution — not an erasure. Only `.catch(()=>{})`,
  // `.catch(noop)`, `.catch(err => console.log(err))` (no return) are erasures.
  const catchOpen = trimmed.indexOf('(');
  let cd = 0;
  let ce = catchOpen;
  for (; ce < trimmed.length; ce++) {
    if (trimmed[ce] === '(') cd++;
    else if (trimmed[ce] === ')') { cd--; if (cd === 0) { ce++; break; } }
  }
  const handler = trimmed.slice(catchOpen + 1, ce - 1).trim();
  // Heuristic: handler returns a value if it is an arrow with non-empty
  // expression body (e.g. `() => false`, `(e) => fallback`, `x => null`)
  // or contains a `return <value>` statement inside a block body.
  const isArrowExprBody = /=>\s*[^{][^]*$/.test(handler) && !/^\([^)]*\)\s*=>\s*\{\s*\}\s*$/.test(handler);
  const hasReturnValue = /\breturn\s+[^;\s]/.test(handler);
  if (isArrowExprBody || hasReturnValue) return false;

  // Walk past the .catch(...) to see if `.then(` follows (uncommon but legal).
  // Find matching close of catch.
  let j = trimmed.indexOf('(');
  let d = 0;
  for (; j < trimmed.length; j++) {
    if (trimmed[j] === '(') d++;
    else if (trimmed[j] === ')') {
      d--;
      if (d === 0) { j++; break; }
    }
  }
  const tail = trimmed.slice(j);
  if (/^\s*\.then\(/.test(tail)) return false;

  return true;
}

function lineOf(text, idx) {
  return text.slice(0, idx).split('\n').length;
}

function isAllowed(srcLines, lineNum) {
  // 1-indexed lineNum. Check this line and the line above for allow comment.
  const here = srcLines[lineNum - 1] ?? '';
  const above = srcLines[lineNum - 2] ?? '';
  const tag = 'lint-allow: bool-promise-erasure';
  return here.includes(tag) || above.includes(tag);
}

// ─── Main ─────────────────────────────────────────────────────────────────

const exports = findBoolPromiseExports();

if (exports.size === 0) {
  if (JSON_OUT) console.log(JSON.stringify({ violations: [], scanned: 0 }));
  else console.log('check-bool-promise-erasure: no Promise<boolean> exports in watch list — nothing to check.');
  process.exit(0);
}

const violations = [];
let filesScanned = 0;

for (const file of walk(SRC_DIR)) {
  // Skip test files — assertions check resolved value.
  if (/\.test\.ts$/.test(file)) continue;
  if (/\/__tests__\//.test(file)) continue;
  // Skip the declaration files themselves — call inside the same module is
  // usually internal recursion or wrapper, not an erasure point. (Keep noise low.)
  const rel = path.relative(REPO_ROOT, file);
  if (WATCH_LIST.includes(rel)) {
    // Still scan — internal callers can erase too, e.g. fire-and-forget cleanup.
  }
  const src = readSafe(file);
  if (!src) continue;
  filesScanned++;
  const srcLines = src.split('\n');

  for (const [name, decl] of exports) {
    // Quick reject — name must appear textually.
    if (!src.includes(name + '(')) continue;
    // Find every occurrence.
    const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
      const callIdx = m.index;
      if (!isBoolErasedCall(src, callIdx, name)) continue;
      const ln = lineOf(src, callIdx);
      if (isAllowed(srcLines, ln)) continue;
      violations.push({
        file: rel,
        line: ln,
        callee: name,
        decl: `${decl.file}:${decl.line}`,
        snippet: srcLines[ln - 1].trim(),
      });
    }
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ violations, scanned: filesScanned, exportsTracked: exports.size }, null, 2));
  process.exit(violations.length > 0 ? 1 : 0);
}

if (violations.length === 0) {
  console.log(`check-bool-promise-erasure: OK (${filesScanned} files scanned, ${exports.size} Promise<boolean> exports tracked)`);
  process.exit(0);
}

console.error(`check-bool-promise-erasure: ${violations.length} violation(s) found\n`);
console.error('A function returning Promise<boolean> was called with .catch() only —');
console.error('the resolved boolean is silently discarded. Inspect the value (await,');
console.error('then, or assignment), or add `// lint-allow: bool-promise-erasure — <reason>`.\n');
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${v.callee}() — declared at ${v.decl}`);
  console.error(`    ${v.snippet}`);
}
process.exit(1);
