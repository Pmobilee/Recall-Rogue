#!/usr/bin/env node
/**
 * check-human-prose.mjs
 *
 * Preventative lint for the Human-Prose rule (.claude/rules/human-prose.md).
 *
 * Scans the staged diff for user-facing text files and flags the five top
 * LLM-tell patterns. If the commit message includes [humanizer-verified],
 * the lint runs in report-only mode (prints warnings, exits 0) — this is
 * the conscious-override token for cases where the lint's heuristics
 * disagree with a real human pass.
 *
 * Usage:
 *   node scripts/lint/check-human-prose.mjs             # scan staged diff
 *   node scripts/lint/check-human-prose.mjs --all       # scan every tracked user-facing file
 *   node scripts/lint/check-human-prose.mjs --file path # scan one file
 *
 * Exit codes:
 *   0 = no tells found, OR tells found but commit message has [humanizer-verified]
 *   1 = tells found and no override token
 *
 * The five tells:
 *   1. Em-dash triplets — "X — Y, Z, and W" parallel construction
 *   2. "It's not just X — it's Y" cadence
 *   3. Rule-of-three parallel verb/noun chains
 *   4. Vague evocative nouns: tapestry/symphony/dance/journey/landscape/realm/essence/legacy/saga/odyssey
 *   5. Wikipedia-tone puffery: "pivotal moment", "lasting mark", "stands as testament"
 *
 * User-facing text glob (hardcoded — keep in sync with .claude/rules/human-prose.md):
 *   data/decks/**\/*.json         (description, explanation, wowFactor fields only; Q/A/distractors exempt)
 *   public/data/narratives/**\/*.json
 *   src/data/mechanics.ts
 *   src/data/relics/**\/*.ts
 *   src/data/enemies.ts
 *   src/data/enemyDialogue.ts
 *   src/data/specialEvents.ts
 *   src/data/steamAchievements.ts
 *   src/i18n/locales/**\/*.json
 *   src/ui/**\/*.svelte           (hardcoded English strings — heuristic match)
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Paths under _wip are work-in-progress and not shipped — exempt.
const EXCLUDE_GLOBS = [/^data\/decks\/_wip\//];

const USER_FACING_GLOBS = [
  /^data\/decks\/.+\.json$/,
  /^public\/data\/narratives\/.+\.json$/,
  /^src\/data\/mechanics\.ts$/,
  /^src\/data\/relics\/.+\.ts$/,
  /^src\/data\/enemies\.ts$/,
  /^src\/data\/enemyDialogue\.ts$/,
  /^src\/data\/specialEvents\.ts$/,
  /^src\/data\/steamAchievements\.ts$/,
  /^src\/data\/statusEffects\.ts$/,
  /^src\/i18n\/locales\/.+\.json$/,
  /^src\/ui\/.+\.svelte$/,
];

// Deck-level voice fields — the ONLY fields linted inside data/decks/*.json.
// Per-fact fields (explanation/wowFactor/statement/variants) contain legitimate
// factual lists ("Germany, Italy, and Japan") that would drown the lint in
// noise. Those are covered by the Phase 4 sampling protocol instead.
const DECK_LINTABLE_TOP_LEVEL_KEYS = new Set([
  'name',
  'description',
  'tagline',
  'flavorText',
  'narrativeIntro',
  'narrativeOutro',
  'subtitle',
  'summary',
]);

const TELLS = [
  {
    id: 'em-dash-triplet',
    label: 'Em-dash followed by rule-of-three parallel',
    // "word — word, word, and word" or "word — word, word and word"
    re: /\w+\s+—\s+\w+(?:[^.!?\n]{0,40}),\s+\w+(?:[^.!?\n]{0,40}),?\s+and\s+\w+/g,
  },
  {
    id: 'not-just-cadence',
    label: '"It\'s not just X — it\'s Y" cadence',
    re: /\b(?:it'?s|was|is|this is)\s+not\s+just\b[^.!?\n]{1,60}[—,\-]\s*(?:it'?s|it was|but)\b/gi,
  },
  {
    id: 'rule-of-three',
    label: 'Rule-of-three parallel noun/verb chain',
    // "forged, tempered, and broken" / "philosophy, warfare, and art"
    re: /\b(\w{4,})(?:ed|ing|s)?,\s+\w{4,}(?:ed|ing|s)?,\s+and\s+\w{4,}(?:ed|ing|s)?\b/g,
  },
  {
    id: 'vague-evocative',
    label: 'Vague evocative noun (tapestry/symphony/dance/journey/...)',
    re: /\b(?:tapestry|symphony|dance|journey|landscape|realm|essence|legacy|saga|odyssey|wonders|mysteries|tradition)\s+of\b/gi,
  },
  {
    id: 'wikipedia-puffery',
    label: 'Wikipedia-tone puffery',
    re: /\b(?:pivotal\s+moment|lasting\s+mark|stands\s+as\s+(?:a\s+)?testament|reshap(?:ed|ing)\s+the|one\s+of\s+the\s+most\s+(?:important|influential|significant)|indelible\s+mark|enduring\s+legacy)\b/gi,
  },
];

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getAllTrackedFiles() {
  try {
    const out = execSync('git ls-files', { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function isUserFacing(path) {
  if (EXCLUDE_GLOBS.some((re) => re.test(path))) return false;
  return USER_FACING_GLOBS.some((re) => re.test(path));
}

// Heuristic: skip lines in .svelte files that look like code (not template text)
// to avoid false positives on JS comments, identifiers, and destructures.
const SVELTE_CODE_LINE = /(?:\bconst\b|\blet\b|\bvar\b|\bfunction\b|\bimport\b|\bexport\b|=>|\/\/|\/\*|\*\/|\s:\s|=\s*['"`{]|\$:|\$state|\$derived|\$effect|\bprops?\b\s*[=:])/;

function getCommitMessage() {
  // Check the staged commit message via .git/COMMIT_EDITMSG if it exists.
  const paths = ['.git/COMMIT_EDITMSG', '.git/MERGE_MSG'];
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, 'utf8');
      } catch {}
    }
  }
  return '';
}

/**
 * For deck JSON, only lint value strings from non-exempt keys.
 * For non-JSON files, lint the whole file contents.
 */
function extractLintableText(path, content) {
  if (path.startsWith('data/decks/') && path.endsWith('.json')) {
    try {
      const data = JSON.parse(content);
      const lines = [];
      walkDeckJson(data, lines, []);
      return lines;
    } catch {
      return [{ lineNum: 1, text: content.slice(0, 2000) }];
    }
  }
  // For .svelte, skip JS code lines to reduce false positives.
  if (path.endsWith('.svelte')) {
    return content.split('\n').map((text, i) => ({
      lineNum: i + 1,
      text: SVELTE_CODE_LINE.test(text) ? '' : text,
    }));
  }
  // For everything else, enumerate lines so we can report file:line.
  return content.split('\n').map((text, i) => ({ lineNum: i + 1, text }));
}

function walkDeckJson(node, out, keyPath) {
  // Deck JSON: only lint the top-level voice fields listed in
  // DECK_LINTABLE_TOP_LEVEL_KEYS. Per-fact prose (explanation, wowFactor,
  // statement, variants) legitimately contains factual lists like
  // "Germany, Italy, and Japan" that would drown the lint. Per-fact quality
  // is handled by the Phase 4 sampling protocol, not by static regex.
  if (!node || typeof node !== 'object') return;
  for (const key of DECK_LINTABLE_TOP_LEVEL_KEYS) {
    const v = node[key];
    if (typeof v === 'string' && v.length >= 20) {
      out.push({ lineNum: 0, text: v, keyPath: key });
    }
  }
  // Sub-deck case: some files have a top-level `subDecks` array of objects
  // with their own `name`/`description`. Scan one level deep.
  if (Array.isArray(node.subDecks)) {
    for (let i = 0; i < node.subDecks.length; i++) {
      const sd = node.subDecks[i];
      if (sd && typeof sd === 'object') {
        for (const key of DECK_LINTABLE_TOP_LEVEL_KEYS) {
          const v = sd[key];
          if (typeof v === 'string' && v.length >= 20) {
            out.push({ lineNum: 0, text: v, keyPath: `subDecks.${i}.${key}` });
          }
        }
      }
    }
  }
}

function scanFile(path) {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, 'utf8');
  const lines = extractLintableText(path, content);
  const findings = [];
  for (const { lineNum, text, keyPath } of lines) {
    for (const tell of TELLS) {
      tell.re.lastIndex = 0;
      const m = tell.re.exec(text);
      if (m) {
        findings.push({
          path,
          lineNum,
          keyPath: keyPath || '',
          tellId: tell.id,
          tellLabel: tell.label,
          snippet: m[0].slice(0, 120),
        });
      }
    }
  }
  return findings;
}

// --- main ---
const args = process.argv.slice(2);
const mode = args.includes('--all') ? 'all' : args.includes('--file') ? 'file' : 'staged';
let targetFiles = [];

if (mode === 'file') {
  const idx = args.indexOf('--file');
  targetFiles = [args[idx + 1]].filter(Boolean);
} else if (mode === 'all') {
  targetFiles = getAllTrackedFiles().filter(isUserFacing);
} else {
  targetFiles = getStagedFiles().filter(isUserFacing);
}

if (targetFiles.length === 0) {
  console.log('check-human-prose.mjs — no user-facing text files in scope. OK.');
  process.exit(0);
}

const allFindings = [];
for (const f of targetFiles) {
  allFindings.push(...scanFile(f));
}

const commitMsg = getCommitMessage();
const override = /\[humanizer-verified\]/.test(commitMsg);

console.log(
  `check-human-prose.mjs — scanned ${targetFiles.length} user-facing files, found ${allFindings.length} potential AI-tells.`,
);

if (allFindings.length === 0) {
  console.log('✓ No anti-tells found. Voice looks clean.');
  process.exit(0);
}

// Group by file for readable output
const byFile = new Map();
for (const f of allFindings) {
  if (!byFile.has(f.path)) byFile.set(f.path, []);
  byFile.get(f.path).push(f);
}

console.log('');
for (const [file, findings] of byFile) {
  console.log(`  ${file}  (${findings.length} tells)`);
  for (const f of findings.slice(0, 5)) {
    const loc = f.lineNum > 0 ? `L${f.lineNum}` : f.keyPath;
    console.log(`    [${f.tellId}] ${loc}: ${f.snippet}`);
  }
  if (findings.length > 5) console.log(`    … and ${findings.length - 5} more`);
}
console.log('');

if (override) {
  console.log(
    '⚠️  [humanizer-verified] found in commit message — lint is in report-only mode. Ensure you actually ran /humanizer with voice-sample.md before overriding.',
  );
  process.exit(0);
}

console.log(
  '❌ Human-prose lint FAILED. Run /humanizer with .claude/skills/humanizer/voice-sample.md and rewrite the flagged lines,',
);
console.log(
  '   OR if these are false positives AFTER a conscious humanizer pass, add [humanizer-verified] to the commit message.',
);
console.log('   See .claude/rules/human-prose.md for the full rule.');
process.exit(1);
