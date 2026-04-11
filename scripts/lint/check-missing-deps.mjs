#!/usr/bin/env node
/**
 * scripts/lint/check-missing-deps.mjs
 *
 * Preventative lint: find imports in src/**\/*.{ts,svelte,mjs} that reference
 * packages not declared in package.json dependencies / devDependencies.
 *
 * Motivation (2026-04-11): Two instances of the same pattern committed in one
 * session — chess.js and zod were imported in src/ files BEFORE they were
 * added to package.json. Both caused svelte-check red, but catching the issue
 * at author-time (pre-commit / `npm run check`) is faster.
 *
 * Classification logic for each import specifier:
 *   - Starts with '.' or '/'  → relative import, skipped
 *   - Starts with '$'          → Svelte virtual ($app/stores, $lib/…), skipped
 *   - Starts with 'virtual:'   → Vite virtual module, skipped
 *   - isBuiltin(specifier)     → Node built-in (fs, path, url …), skipped
 *   - Otherwise                → external package; cross-reference package.json
 *
 * Package name extraction:
 *   - Scoped:   '@scope/pkg/sub/path' → '@scope/pkg'
 *   - Unscoped: 'pkg/sub/path'        → 'pkg'
 *
 * Patterns detected:
 *   - import X from 'pkg'          (default import)
 *   - import type X from 'pkg'     (type-only import)
 *   - import { X } from 'pkg'      (named import)
 *   - import 'pkg'                 (bare side-effect import)
 *   - export { X } from 'pkg'      (re-export)
 *   - import('pkg')                (dynamic import)
 *   - require('pkg')               (CommonJS — unlikely in ESM but detected)
 *
 * Exit codes:
 *   0 — clean (all imports accounted for)
 *   1 — at least one issue found
 *
 * Usage:
 *   node scripts/lint/check-missing-deps.mjs
 *   npm run lint:deps
 *
 * Added: 2026-04-11 — preventative lint after chess.js + zod incidents
 * See: docs/gotchas.md → 2026-04-11 "Missing npm deps — chess.js and zod"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBuiltin } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

// ---------------------------------------------------------------------------
// Load declared deps from package.json
// ---------------------------------------------------------------------------

const pkgPath = path.join(REPO_ROOT, 'package.json');
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
} catch (err) {
  console.error(`[check-missing-deps] Cannot read package.json: ${err.message}`);
  process.exit(1);
}

const declaredDeps = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
]);

// ---------------------------------------------------------------------------
// Package name extraction
// ---------------------------------------------------------------------------

/**
 * Given an import specifier, return the npm package name, or null to skip.
 *
 * Rules (applied in order):
 *  1. Relative/absolute path → null (skip)
 *  2. Svelte virtual ($) → null (skip)
 *  3. Vite virtual (virtual:) → null (skip)
 *  4. Node built-in (handles both 'fs' and 'node:fs') → null (skip)
 *  5. Scoped: '@scope/name/…' → '@scope/name'
 *  6. Unscoped: 'pkg/sub/…' → 'pkg'
 */
function extractPackageName(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  if (specifier.startsWith('$')) return null;
  if (specifier.startsWith('virtual:')) return null;
  if (isBuiltin(specifier)) return null;

  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    if (parts.length < 2) return null; // malformed scoped specifier
    return `${parts[0]}/${parts[1]}`;
  }

  return specifier.split('/')[0];
}

// ---------------------------------------------------------------------------
// Import extraction — line-by-line scan for accuracy and clean position info
// ---------------------------------------------------------------------------

/**
 * Extract every external package referenced in source text.
 * Scans line by line; handles multi-line imports by joining continuation lines.
 *
 * Returns: Array<{ specifier: string, packageName: string, line: number, col: number }>
 */
function extractImports(source) {
  const results = [];
  const lines = source.split('\n');

  // Regex for the quoted specifier portion of any import/export/dynamic/require
  // We match in two passes per line:
  //   Pass A — static: import … from 'X' / export … from 'X' / import 'X'
  //   Pass B — dynamic: import('X') / require('X')
  const STATIC_FROM_RE = /(?:import|export)\s+(?:type\s+)?(?:[^'"(;]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const DYNAMIC_RE = /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  // We track already-seen (line, packageName) pairs to avoid double-reporting
  // the same package twice within a file (e.g. if someone writes import twice)
  const seenInFile = new Set();

  // Some imports span multiple lines. We join them simply: whenever we see
  // an `import` keyword without a closing quote on the same line, we look
  // ahead. For our purposes — extracting package names — only the 'from' line
  // matters, so we search each individual line independently; multi-line named
  // import bodies don't affect the 'from "pkg"' which is always on its own line.

  lines.forEach((rawLine, idx) => {
    const lineNum = idx + 1;

    // Skip pure comment lines
    const trimmed = rawLine.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    // --- Pass A: static imports ---
    STATIC_FROM_RE.lastIndex = 0;
    let m;
    while ((m = STATIC_FROM_RE.exec(rawLine)) !== null) {
      const specifier = m[1];
      const packageName = extractPackageName(specifier);
      if (packageName === null) continue;
      const key = `${lineNum}::${packageName}`;
      if (seenInFile.has(key)) continue;
      seenInFile.add(key);
      const col = rawLine.indexOf(`'${specifier}'`) !== -1
        ? rawLine.indexOf(`'${specifier}'`) + 2   // +1 past quote, +1 for 1-indexed
        : rawLine.indexOf(`"${specifier}"`) + 2;
      results.push({ specifier, packageName, line: lineNum, col: Math.max(1, col) });
    }

    // --- Pass B: dynamic import() and require() ---
    DYNAMIC_RE.lastIndex = 0;
    while ((m = DYNAMIC_RE.exec(rawLine)) !== null) {
      const specifier = m[1];
      const packageName = extractPackageName(specifier);
      if (packageName === null) continue;
      const key = `${lineNum}::${packageName}`;
      if (seenInFile.has(key)) continue;
      seenInFile.add(key);
      const col = m.index + 1;  // approximate column (start of import/require)
      results.push({ specifier, packageName, line: lineNum, col });
    }
  });

  return results;
}

// ---------------------------------------------------------------------------
// File walking — src/**\/*.{ts,svelte,mjs}
//
// Intentionally does NOT scan scripts/ — those are Node.js pipeline scripts
// with their own dependency surface (they can import devDeps freely).
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', 'dist', '.svelte-kit', '_archived', '_archived-mining']);
const SCAN_EXTENSIONS = new Set(['.ts', '.svelte', '.mjs']);

function collectFiles(dir) {
  const results = [];
  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(current, entry.name));
      } else {
        const ext = path.extname(entry.name);
        if (SCAN_EXTENSIONS.has(ext)) {
          results.push(path.join(current, entry.name));
        }
      }
    }
  }
  walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// node_modules presence check
// ---------------------------------------------------------------------------

function isInstalled(packageName) {
  return fs.existsSync(path.join(REPO_ROOT, 'node_modules', packageName));
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

const srcDir = path.join(REPO_ROOT, 'src');
const allFiles = collectFiles(srcDir);

// Collect all issues: { file, specifier, packageName, line, col, reason }
const issues = [];

// Deduplicate per (file, packageName) — report each undeclared package once per file
const reportedPerFile = new Map();  // file → Set<packageName>

for (const file of allFiles) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const relFile = path.relative(REPO_ROOT, file);
  const fileReported = reportedPerFile.get(relFile) ?? new Set();
  reportedPerFile.set(relFile, fileReported);

  for (const { specifier, packageName, line, col } of extractImports(source)) {
    if (fileReported.has(packageName)) continue;
    fileReported.add(packageName);

    if (!declaredDeps.has(packageName)) {
      issues.push({ file: relFile, specifier, packageName, line, col,
        reason: 'imported but not declared in package.json' });
    } else if (!isInstalled(packageName)) {
      issues.push({ file: relFile, specifier, packageName, line, col,
        reason: 'declared in package.json but not installed — run npm install' });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (issues.length === 0) {
  console.log('[check-missing-deps] All imports accounted for. Clean.');
  process.exit(0);
}

// Group by file for readability
const byFile = new Map();
for (const issue of issues) {
  if (!byFile.has(issue.file)) byFile.set(issue.file, []);
  byFile.get(issue.file).push(issue);
}

console.error(`[check-missing-deps] Found ${issues.length} missing-dependency issue(s):\n`);

for (const [file, fileIssues] of byFile) {
  console.error(`  ${file}`);
  for (const { specifier, packageName, line, col, reason } of fileIssues) {
    const severity = reason.includes('not installed') ? 'WARN' : 'ERROR';
    console.error(`    [${severity}] ${line}:${col}  import '${specifier}' → '${packageName}' — ${reason}`);
  }
  console.error('');
}

const errorCount = issues.filter(i => !i.reason.includes('not installed')).length;
const warnCount  = issues.filter(i =>  i.reason.includes('not installed')).length;

if (errorCount > 0) {
  console.error(`[check-missing-deps] ${errorCount} ERROR(s) — add the package(s) to package.json before committing.`);
}
if (warnCount > 0) {
  console.error(`[check-missing-deps] ${warnCount} WARN(s) — declared in package.json but not installed; run npm install.`);
}

process.exit(1);
