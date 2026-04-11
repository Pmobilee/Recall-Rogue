#!/usr/bin/env node
// check-skill-drift.mjs — two checks for skill files:
//
//   1. DRIFT (blocking): fail when a SKILL.md has drifted from its
//      SKILL.md.template. Wraps `build-skills.mjs --check`.
//
//   2. MONOLITH SIZE (non-blocking warning): warn when any SKILL.md
//      exceeds the soft cap (600 lines) with no sibling `references/`
//      directory. This is the author-time half of the two-sided
//      enforcement described in .claude/rules/agent-mindset.md →
//      "Two-Sided Enforcement". Its runtime half is the
//      content-too-long experience when the monolith gets invoked.
//
// Exit codes:
//   0 — no drift, monolith-size check is advisory-only
//   1 — drift detected (fails the commit)
//   2 — expansion error
//
// See docs/roadmap/active/autonomy-overhaul-followups.md Items 4.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BUILDER = path.join(REPO_ROOT, 'scripts', 'build-skills.mjs');

// Soft cap on SKILL.md size. Pair-refactor target: split into
// overview + references/*.md once the monolith exceeds this.
const MONOLITH_SOFT_CAP = 600;

// --- 1. DRIFT CHECK --------------------------------------------------------

const driftResult = spawnSync('node', [BUILDER, '--check'], {
  stdio: 'inherit',
  cwd: REPO_ROOT,
});

let driftExit = 0;
if (driftResult.status === 1) {
  console.error('');
  console.error('[check-skill-drift] One or more SKILL.md files have drifted from their .template.');
  console.error('  Fix: edit the SKILL.md.template, then run `node scripts/build-skills.mjs` to regenerate SKILL.md.');
  console.error('  Do NOT edit SKILL.md directly when a .template exists — the next build will overwrite you.');
  driftExit = 1;
} else if (driftResult.status !== 0) {
  // Expansion error or other failure — propagate.
  process.exit(driftResult.status ?? 2);
}

// --- 2. MONOLITH SIZE CHECK (non-blocking) --------------------------------

const skillsDir = path.join(REPO_ROOT, '.claude', 'skills');
let monolithOffenders = [];

if (fs.existsSync(skillsDir)) {
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue; // skip internal/fixture skills
    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const lineCount = fs.readFileSync(skillFile, 'utf8').split('\n').length;
    if (lineCount <= MONOLITH_SOFT_CAP) continue;
    // If a sibling references/ directory exists, the skill has already
    // applied the split pattern — spare it the warning.
    const referencesDir = path.join(skillsDir, entry.name, 'references');
    if (fs.existsSync(referencesDir) && fs.statSync(referencesDir).isDirectory()) continue;
    monolithOffenders.push({ name: entry.name, lines: lineCount });
  }
}

if (monolithOffenders.length > 0) {
  monolithOffenders.sort((a, b) => b.lines - a.lines);
  console.warn('');
  console.warn(`[check-skill-drift] ⚠ Monolith-size warning: ${monolithOffenders.length} SKILL.md file(s) exceed the ${MONOLITH_SOFT_CAP}-line soft cap.`);
  console.warn('  These skills should be split into an overview + references/*.md sub-files following');
  console.warn('  the deck-master / llm-playtest pattern. See docs/roadmap/active/autonomy-overhaul-followups.md Item 3.');
  console.warn('');
  for (const { name, lines } of monolithOffenders) {
    console.warn(`    ${name.padEnd(30)} ${lines} lines`);
  }
  console.warn('');
  console.warn('  This is a non-blocking warning. It will promote to blocking once the current');
  console.warn('  candidates are split or the cap is explicitly raised.');
  console.warn('');
}

process.exit(driftExit);
