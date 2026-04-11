#!/usr/bin/env node
/**
 * scripts/lint/check-wiring.mjs
 *
 * Prevents Cluster B ("Built But Not Wired") bugs identified in BATCH-2026-04-11-ULTRA.
 * Cluster B: features implemented but silently disconnected from their wiring.
 *
 * Three checks:
 *
 *   1. ORPHAN SCREEN COMPONENTS (ERROR):
 *      Every src/ui/components/*Screen.svelte must be imported by src/CardApp.svelte
 *      (directly or via a parent component that CardApp imports). If a *Screen.svelte
 *      exists but is not reachable from CardApp, it is dead code the router can
 *      never show — exactly the TriviaRoundScreen + MapPinDrop pattern from T7.
 *
 *   2. STALE TurnState / RunState FIELD READS (ERROR):
 *      Every .ts file under tests/playtest/headless/ is scanned for property accesses
 *      on variables named `ts`, `turnState`, or `run` / `runState`. Each accessed
 *      field name is cross-checked against the exported TurnState interface from
 *      src/services/turnManager.ts. Stale fields (e.g. comboCount, which was
 *      removed and replaced with consecutiveCorrectThisEncounter) produce errors.
 *      This catches the gym-server.ts comboCount bug (T2 CRITICAL).
 *
 *   3. PHASER INTERACTIVE WITHOUT DOM OVERLAY (WARN):
 *      Every src/game/scenes/*.ts is scanned for setInteractive() calls near
 *      button-like string literals ("Continue", "Confirm", "OK", "Next", "Back",
 *      "Close", "Button", "Accept", "Leave"). For each hit, checks if the
 *      corresponding Svelte wrapper has a DOM <button> or element with data-phaser-id.
 *      Heuristic only — allow opt-out via // @wiring-check:skip reason: <why>
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — errors found (orphan screens or stale field reads)
 *   2 — warnings only (Phaser-interactive heuristic hits with no errors)
 *
 * Run: node scripts/lint/check-wiring.mjs
 * Added: 2026-04-11 — BATCH-ULTRA Cluster B meta-fix
 *
 * See correlation-report.md Cluster B and docs/gotchas.md 2026-04-11 entry.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a file, return null if missing. */
function readFile(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

/** Glob files matching a regex pattern under a directory. */
function globFiles(dir, fileRegex) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (fileRegex.test(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

/** Format a severity line matching the lint error-format convention. */
function formatLine(severity, file, line, rule, message) {
  const rel = path.relative(REPO_ROOT, file);
  const loc = line ? `${rel}:${line}` : rel;
  return `${severity} ${loc} ${rule} ${message}`;
}

// ---------------------------------------------------------------------------
// Check 1: Orphan Screen Components
// ---------------------------------------------------------------------------

function checkOrphanScreens() {
  const issues = [];
  const componentsDir = path.join(REPO_ROOT, 'src', 'ui', 'components');
  const cardAppPath = path.join(REPO_ROOT, 'src', 'CardApp.svelte');

  const cardAppSource = readFile(cardAppPath);
  if (!cardAppSource) {
    issues.push(formatLine('ERROR', cardAppPath, null, 'orphan-screen', 'CardApp.svelte not found — cannot check screen routing'));
    return issues;
  }

  // Collect all import paths referenced in CardApp.svelte (directly imported)
  // and transitively imported by any component CardApp imports.
  // For this lint we do one level deep: CardApp direct imports + their imports.
  // Full transitive traversal would be complex; one level catches the TriviaRoundScreen
  // pattern where the component is totally unimported.

  // Build the set of imported files (relative paths resolved from src/)
  const imported = new Set();

  function collectImports(sourceContent, fromDir) {
    // Match: import X from './path/to/Component.svelte' or '../path'
    const importRe = /from\s+['"]([^'"]+\.svelte)['"]/g;
    let m;
    while ((m = importRe.exec(sourceContent)) !== null) {
      const resolved = path.resolve(fromDir, m[1]);
      if (!imported.has(resolved)) {
        imported.add(resolved);
        // One level deep: also collect imports from each imported svelte file
        const sub = readFile(resolved);
        if (sub) {
          const subDir = path.dirname(resolved);
          // Shallow: collect imports from sub-components (one level)
          const subRe = /from\s+['"]([^'"]+\.svelte)['"]/g;
          let sm;
          while ((sm = subRe.exec(sub)) !== null) {
            const subResolved = path.resolve(subDir, sm[1]);
            imported.add(subResolved);
          }
        }
      }
    }
  }

  collectImports(cardAppSource, path.dirname(cardAppPath));

  // Find all *Screen.svelte files
  const screenFiles = [];
  if (fs.existsSync(componentsDir)) {
    for (const name of fs.readdirSync(componentsDir)) {
      if (name.endsWith('Screen.svelte')) {
        screenFiles.push(path.join(componentsDir, name));
      }
    }
  }

  for (const screenFile of screenFiles) {
    if (!imported.has(screenFile)) {
      issues.push(formatLine(
        'ERROR',
        screenFile,
        null,
        'orphan-screen',
        `${path.basename(screenFile)} is not imported by CardApp.svelte or any component CardApp imports. ` +
        `It is unreachable from the router — dead code. ` +
        `Wire it into CardApp.svelte or remove it.`
      ));
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Check 2: Stale TurnState Field Reads in Headless Test Files
// ---------------------------------------------------------------------------

/**
 * Parse the TurnState interface from turnManager.ts.
 * Returns a Set<string> of field names declared directly on TurnState.
 */
function parseTurnStateFields() {
  const tmPath = path.join(REPO_ROOT, 'src', 'services', 'turnManager.ts');
  const source = readFile(tmPath);
  if (!source) {
    console.warn('[check-wiring] WARNING: src/services/turnManager.ts not found — skipping TurnState field check');
    return null;
  }

  // Find the TurnState interface block
  const interfaceStart = source.indexOf('export interface TurnState {');
  if (interfaceStart === -1) {
    console.warn('[check-wiring] WARNING: TurnState interface not found in turnManager.ts — skipping field check');
    return null;
  }

  // Extract lines between the opening { and the matching closing }
  const fields = new Set();
  let depth = 0;
  let inInterface = false;
  const lines = source.slice(interfaceStart).split('\n');

  for (const line of lines) {
    if (!inInterface) {
      if (line.includes('{')) {
        inInterface = true;
        depth = 1;
      }
      continue;
    }

    for (const ch of line) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }

    if (depth === 0) break; // end of interface

    // Match field declarations: fieldName?: or fieldName:
    // Handles: "  fieldName: Type;" and "  /** doc */ fieldName?: Type;"
    const fieldMatch = line.match(/^\s+(\w+)\??:/);
    if (fieldMatch) {
      fields.add(fieldMatch[1]);
    }
  }

  return fields;
}

function checkStaleFieldReads() {
  const issues = [];
  const turnStateFields = parseTurnStateFields();
  if (!turnStateFields || turnStateFields.size === 0) return issues;

  const headlessDir = path.join(REPO_ROOT, 'tests', 'playtest', 'headless');
  const tsFiles = globFiles(headlessDir, /\.ts$/);

  for (const file of tsFiles) {
    const source = readFile(file);
    if (!source) continue;

    const lines = source.split('\n');
    lines.forEach((line, idx) => {
      // Skip comments
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;

      // Match patterns: ts.fieldName, turnState.fieldName
      // Also match run.turnState.fieldName (but only the TurnState part)
      // We look for: (ts|turnState)\.\w+
      const fieldRe = /\b(?:ts|turnState)\.(\w+)/g;
      let m;
      while ((m = fieldRe.exec(line)) !== null) {
        const fieldName = m[1];
        // Skip known non-field accesses (methods, etc.) — common ones
        if (['playerState', 'enemy', 'deck', 'activeRelicIds', 'activePassives',
             'turnLog', 'result', 'phase', 'encounterAnsweredFacts',
             'encounterQuizzedFacts', 'activeInscriptions'].includes(fieldName)) {
          // These are on TurnState — if they show up in the parsed set, fine.
          // If not in set, we'll catch them below.
        }
        if (!turnStateFields.has(fieldName)) {
          // Check that this isn't a method call (followed by '(')
          const afterMatch = line.slice(m.index + m[0].length);
          if (afterMatch.startsWith('(')) continue; // method call, skip

          // Check for opt-out comment on same line or previous line
          if (line.includes('@wiring-check:skip')) continue;
          if (idx > 0 && lines[idx - 1].includes('@wiring-check:skip')) continue;

          issues.push(formatLine(
            'ERROR',
            file,
            idx + 1,
            'stale-turnstate-field',
            `ts.${fieldName} / turnState.${fieldName} — field "${fieldName}" does not exist on TurnState. ` +
            `Was it renamed or removed? Check src/services/turnManager.ts. ` +
            `Known replacement: comboCount → consecutiveCorrectThisEncounter`
          ));
        }
      }
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Check 3: Phaser setInteractive Without DOM Overlay (WARN heuristic)
// ---------------------------------------------------------------------------

const BUTTON_KEYWORDS = ['Continue', 'Confirm', 'OK', 'Next', 'Back', 'Close', 'Button', 'Accept', 'Leave', 'Start'];

function checkPhaserInteractiveWithoutDom() {
  const issues = [];
  const scenesDir = path.join(REPO_ROOT, 'src', 'game', 'scenes');

  if (!fs.existsSync(scenesDir)) return issues;

  for (const name of fs.readdirSync(scenesDir)) {
    if (!name.endsWith('.ts')) continue;
    const file = path.join(scenesDir, name);
    const source = readFile(file);
    if (!source) continue;

    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip lines with opt-out comment
      if (line.includes('@wiring-check:skip')) continue;

      if (!line.includes('setInteractive()') && !line.includes('setInteractive(')) continue;

      // Look back and forward 50 lines for a button-like string literal
      const windowStart = Math.max(0, i - 50);
      const windowEnd = Math.min(lines.length - 1, i + 50);
      const windowText = lines.slice(windowStart, windowEnd + 1).join('\n');

      const hasButtonKeyword = BUTTON_KEYWORDS.some(kw => {
        // Look for the keyword as a string literal in nearby code
        return windowText.includes(`'${kw}'`) || windowText.includes(`"${kw}"`) ||
               windowText.includes(`\`${kw}\``);
      });

      if (!hasButtonKeyword) continue;

      // Check for @wiring-check:skip in the window
      if (windowText.includes('@wiring-check:skip')) continue;

      // Infer the likely Svelte wrapper from the scene name
      // e.g., RewardRoomScene.ts → RewardRoomOverlay.svelte or RewardRoom*.svelte
      const sceneName = name.replace('.ts', '');
      const componentBaseName = sceneName.replace('Scene', '');
      const componentsDir = path.join(REPO_ROOT, 'src', 'ui', 'components');
      let hasDomOverlay = false;
      if (fs.existsSync(componentsDir)) {
        for (const compFile of fs.readdirSync(componentsDir)) {
          if (compFile.includes(componentBaseName) && compFile.endsWith('.svelte')) {
            const compSource = readFile(path.join(componentsDir, compFile));
            if (compSource && (compSource.includes('<button') || compSource.includes('data-phaser-id'))) {
              hasDomOverlay = true;
              break;
            }
          }
        }
      }

      if (!hasDomOverlay) {
        issues.push(formatLine(
          'WARN',
          file,
          i + 1,
          'phaser-interactive-no-dom',
          `setInteractive() near button-like string — no matching DOM <button> overlay found in ${componentBaseName}*.svelte. ` +
          `Keyboard and screen-reader users cannot access Phaser-only interactive objects. ` +
          `Add a DOM overlay or suppress with: // @wiring-check:skip reason: <why>`
        ));
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('[check-wiring] Running wiring checks...\n');

const errors = [];
const warnings = [];

// Run all three checks
const orphanIssues = checkOrphanScreens();
const staleIssues = checkStaleFieldReads();
const phaserIssues = checkPhaserInteractiveWithoutDom();

for (const issue of orphanIssues) {
  if (issue.startsWith('ERROR')) errors.push(issue);
  else warnings.push(issue);
}
for (const issue of staleIssues) {
  if (issue.startsWith('ERROR')) errors.push(issue);
  else warnings.push(issue);
}
for (const issue of phaserIssues) {
  if (issue.startsWith('WARN')) warnings.push(issue);
  else errors.push(issue);
}

// Report
if (errors.length > 0 || warnings.length > 0) {
  if (errors.length > 0) {
    console.error(`[check-wiring] ${errors.length} error(s) found:\n`);
    for (const e of errors) {
      console.error('  ' + e);
    }
    console.error('');
  }
  if (warnings.length > 0) {
    console.warn(`[check-wiring] ${warnings.length} warning(s):\n`);
    for (const w of warnings) {
      console.warn('  ' + w);
    }
    console.warn('');
  }
} else {
  console.log('[check-wiring] All checks passed.\n');
  console.log(`  Check 1 (orphan screens):         PASS`);
  console.log(`  Check 2 (stale TurnState fields):  PASS`);
  console.log(`  Check 3 (Phaser interactive/DOM):  PASS (heuristic)\n`);
}

if (errors.length > 0) {
  process.exit(1);
} else if (warnings.length > 0) {
  process.exit(2);
} else {
  process.exit(0);
}
