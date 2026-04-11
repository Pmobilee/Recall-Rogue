#!/usr/bin/env node
// check-skill-drift.mjs — fail when a SKILL.md has drifted from its template.
//
// Thin wrapper around `build-skills.mjs --check`. Exists as a separate file so
// the pre-commit hook and the linter namespace can reference a stable path.
//
// See docs/roadmap/active/autonomy-overhaul-followups.md Item 4.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BUILDER = path.join(REPO_ROOT, 'scripts', 'build-skills.mjs');

const result = spawnSync('node', [BUILDER, '--check'], {
  stdio: 'inherit',
  cwd: REPO_ROOT,
});

if (result.status === 0) {
  // No drift.
  process.exit(0);
}

if (result.status === 1) {
  console.error('');
  console.error('[check-skill-drift] One or more SKILL.md files have drifted from their .template.');
  console.error('  Fix: edit the SKILL.md.template, then run `node scripts/build-skills.mjs` to regenerate SKILL.md.');
  console.error('  Do NOT edit SKILL.md directly when a .template exists — the next build will overwrite you.');
  process.exit(1);
}

// Status 2 (expansion error) or any other non-zero — surface it.
process.exit(result.status ?? 2);
