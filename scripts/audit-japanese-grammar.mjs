#!/usr/bin/env node
/**
 * audit-japanese-grammar.mjs
 *
 * Static in-game quiz audit for the 5 Japanese grammar decks (N5–N1).
 *
 * Reproduces what a player sees on screen for every fact:
 *   - Renders the question via the same template logic the live game uses
 *     (ported from src/services/questionTemplateSelector.ts)
 *   - Picks the same 3 distractors quizService.getQuizChoices() would pick
 *     (ported from src/services/quizService.ts + src/data/balance.ts)
 *   - Applies displayAnswer() brace-stripping
 *     (ported from src/services/numericalDistractorService.ts)
 *
 * Selection is fully deterministic via a seeded PRNG (seed = char-code hash
 * of fact.id), so two consecutive runs produce byte-identical reports that
 * can be diffed across content edits.
 *
 * Runs 12 quality flags (see FLAG_DESCRIPTIONS below) and emits:
 *   - data/audits/japanese-grammar/<deckId>-rendered.md   (per-fact table)
 *   - data/audits/japanese-grammar/<deckId>-summary.json  (machine-readable)
 *   - Console summary table across all 5 decks.
 *
 * Grammar decks are exempt from scripts/quiz-audit.mjs (line 42 hard-excludes
 * japanese_*), so this is the only audit that touches them. It is the
 * mechanical pre-filter — semantic plausibility still requires LLM review.
 *
 * Usage:
 *   node scripts/audit-japanese-grammar.mjs
 *   npm run audit:japanese-grammar
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DECKS_DIR = join(REPO_ROOT, 'data', 'decks');
const OUT_DIR = join(REPO_ROOT, 'data', 'audits', 'japanese-grammar');

const DECK_FILES = [
  'japanese_n5_grammar.json',
  'japanese_n4_grammar.json',
  'japanese_n3_grammar.json',
  'japanese_n2_grammar.json',
  'japanese_n1_grammar.json',
];

// Mirror of BALANCE.QUIZ_DISTRACTORS_SHOWN (src/data/balance.ts:6)
const QUIZ_DISTRACTORS_SHOWN = 3;

// LENGTH_TELL threshold: correct answer length deviates >Nx from mean distractor length
const LENGTH_TELL_RATIO = 3;

const FLAG_DESCRIPTIONS = {
  NO_DISTRACTORS:               'fact.distractors has fewer than 3 entries',
  DUPE_DISTRACTOR:              'a selected distractor equals the correct answer',
  DUPE_WITHIN_DISTRACTORS:      'two selected distractors are identical',
  Q_EQUALS_A:                   'question text equals correct answer',
  SELF_ANSWERING:               'correct answer appears verbatim in question stem (excluding {___})',
  NO_BLANK:                     'fact.quizQuestion missing the {___} fill-in placeholder',
  LENGTH_TELL:                  `correct answer length deviates >${LENGTH_TELL_RATIO}× from mean distractor length`,
  SHORT_EXPLANATION:            'fact.explanation is missing or shorter than 20 chars',
  POOL_MISMATCH:                'fact.answerTypePoolId not found in deck.answerTypePools',
  ORPHAN_POOL_MEMBER:           'pool exists but fact.id not in pool.factIds',
  EMPTY_DISTRACTOR:             'fact.distractors contains an empty/whitespace entry',
  CORRECT_IN_DISTRACTORS_SOURCE:'fact.distractors source array contains the correct answer',
};

// ---------------------------------------------------------------------------
// Ported helpers (kept byte-faithful to live game source)
// ---------------------------------------------------------------------------

/** Ported from src/services/numericalDistractorService.ts:64-66 */
function displayAnswer(answer) {
  return answer.replace(/\{(\d[\d,]*\.?\d*)\}/, '$1');
}

/** Ported from src/services/questionTemplateSelector.ts:139-205 */
const LANGUAGE_NAMES = {
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', es: 'Spanish', fr: 'French',
  de: 'German', nl: 'Dutch', cs: 'Czech', it: 'Italian', pt: 'Portuguese',
  ru: 'Russian', ar: 'Arabic',
};

function renderTemplate(template, fact) {
  let result = template.questionFormat;
  const replacements = {
    targetLanguageWord: fact.targetLanguageWord ?? '',
    correctAnswer: fact.correctAnswer,
    language: fact.language ? (LANGUAGE_NAMES[fact.language] ?? fact.language) : '',
    explanation: fact.explanation,
    quizQuestion: fact.quizQuestion,
    reading: fact.reading ?? '',
  };

  let hasEmptyReplacement = false;
  result = result.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in replacements) {
      const value = replacements[key];
      if (value.trim() === '') hasEmptyReplacement = true;
      return value;
    }
    const val = fact[key];
    if (typeof val === 'string') {
      if (val.trim() === '') hasEmptyReplacement = true;
      return val;
    }
    return match;
  });

  if (/\{\w+\}/.test(result) || hasEmptyReplacement) {
    return fact.quizQuestion;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — same algorithm as scripts/quiz-audit.mjs
// ---------------------------------------------------------------------------

function hashString(s) {
  // Simple deterministic hash; matches char-code-sum convention used by the
  // existing quiz-audit.mjs reference for stable seeds.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, seed) {
  const rng = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Quiz simulation — mirrors quizService.getQuizChoices() for grammar facts
// ---------------------------------------------------------------------------

function simulateQuiz(fact, template) {
  const renderedQuestion = renderTemplate(template, fact);
  const correctDisplay = displayAnswer(fact.correctAnswer);

  const seedDistractors = hashString(fact.id + '::distractors');
  const seedFinal = hashString(fact.id + '::final');

  const shuffledSource = seededShuffle(fact.distractors ?? [], seedDistractors);
  const selectedDistractors = shuffledSource.slice(0, QUIZ_DISTRACTORS_SHOWN);
  const finalChoices = seededShuffle([...selectedDistractors, correctDisplay], seedFinal);

  return { renderedQuestion, correctDisplay, selectedDistractors, finalChoices };
}

// ---------------------------------------------------------------------------
// Quality flags
// ---------------------------------------------------------------------------

const norm = (s) => (s ?? '').toLowerCase().trim();

function flagFact(fact, sim, deck, poolIndex) {
  const flags = [];
  const correct = sim.correctDisplay;
  const distractors = sim.selectedDistractors;
  const sourceDistractors = fact.distractors ?? [];

  if (sourceDistractors.length < QUIZ_DISTRACTORS_SHOWN) flags.push('NO_DISTRACTORS');

  const correctNorm = norm(correct);
  if (distractors.some(d => norm(d) === correctNorm)) flags.push('DUPE_DISTRACTOR');

  const dSet = new Set();
  let dupeWithin = false;
  for (const d of distractors) {
    const n = norm(d);
    if (dSet.has(n)) { dupeWithin = true; break; }
    dSet.add(n);
  }
  if (dupeWithin) flags.push('DUPE_WITHIN_DISTRACTORS');

  if (norm(fact.quizQuestion) === correctNorm) flags.push('Q_EQUALS_A');

  const stemWithoutBlank = fact.quizQuestion.replace(/\{___\}/g, '');
  if (correct.length > 0 && stemWithoutBlank.includes(correct)) flags.push('SELF_ANSWERING');

  if (!fact.quizQuestion.includes('{___}')) flags.push('NO_BLANK');

  if (distractors.length > 0) {
    const meanLen = distractors.reduce((s, d) => s + d.length, 0) / distractors.length;
    if (meanLen > 0) {
      const ratio = correct.length >= meanLen
        ? correct.length / meanLen
        : meanLen / Math.max(correct.length, 1);
      if (ratio > LENGTH_TELL_RATIO) flags.push('LENGTH_TELL');
    }
  }

  if (!fact.explanation || fact.explanation.length < 20) flags.push('SHORT_EXPLANATION');

  const pool = poolIndex.byId.get(fact.answerTypePoolId);
  if (!pool) {
    flags.push('POOL_MISMATCH');
  } else if (!pool.factIds || !pool.factIds.includes(fact.id)) {
    flags.push('ORPHAN_POOL_MEMBER');
  }

  if (sourceDistractors.some(d => typeof d !== 'string' || d.trim() === '')) {
    flags.push('EMPTY_DISTRACTOR');
  }

  if (sourceDistractors.some(d => typeof d === 'string' && norm(d) === correctNorm)) {
    flags.push('CORRECT_IN_DISTRACTORS_SOURCE');
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function escapeCell(s) {
  return String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');
}

function renderDeckMarkdown(deck, results) {
  const lines = [];
  lines.push(`# ${deck.id} — Static In-Game Quiz Audit`);
  lines.push('');
  lines.push(`- Total facts: **${results.length}**`);
  const flaggedCount = results.filter(r => r.flags.length > 0).length;
  lines.push(`- Flagged: **${flaggedCount}** (${((flaggedCount / results.length) * 100).toFixed(1)}%)`);
  lines.push('');
  lines.push('Each row shows the rendered question, correct answer, and the 3 distractors a player would see.');
  lines.push('Selection is deterministic (seeded PRNG keyed on fact.id).');
  lines.push('');

  // Group by pool
  const byPool = new Map();
  for (const r of results) {
    const pid = r.fact.answerTypePoolId || '(no pool)';
    if (!byPool.has(pid)) byPool.set(pid, []);
    byPool.get(pid).push(r);
  }
  const poolIds = [...byPool.keys()].sort();

  for (const pid of poolIds) {
    const rows = byPool.get(pid);
    lines.push(`## Pool: \`${pid}\` (${rows.length} facts)`);
    lines.push('');
    lines.push('| Fact ID | Question | Correct | D1 | D2 | D3 | Flags |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const r of rows) {
      const [d1, d2, d3] = [
        r.sim.selectedDistractors[0] ?? '',
        r.sim.selectedDistractors[1] ?? '',
        r.sim.selectedDistractors[2] ?? '',
      ];
      lines.push([
        '',
        escapeCell(r.fact.id),
        escapeCell(r.sim.renderedQuestion),
        escapeCell(r.sim.correctDisplay),
        escapeCell(d1),
        escapeCell(d2),
        escapeCell(d3),
        escapeCell(r.flags.join(', ')),
        '',
      ].join('|'));
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function auditDeck(filename) {
  const path = join(DECKS_DIR, filename);
  const deck = JSON.parse(await readFile(path, 'utf8'));

  const template = (deck.questionTemplates ?? [])[0] ?? {
    id: 'fallback',
    questionFormat: '{quizQuestion}',
  };

  const poolIndex = {
    byId: new Map((deck.answerTypePools ?? []).map(p => [p.id, p])),
  };

  const facts = [...(deck.facts ?? [])].sort((a, b) => a.id.localeCompare(b.id));

  const results = facts.map(fact => {
    const sim = simulateQuiz(fact, template);
    const flags = flagFact(fact, sim, deck, poolIndex);
    return { fact, sim, flags };
  });

  const flagCounts = {};
  for (const k of Object.keys(FLAG_DESCRIPTIONS)) flagCounts[k] = 0;
  const failingFacts = [];
  for (const r of results) {
    if (r.flags.length === 0) continue;
    failingFacts.push({ factId: r.fact.id, flags: r.flags });
    for (const f of r.flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
  }

  const summary = {
    deckId: deck.id,
    sourceFile: filename,
    totalFacts: results.length,
    flaggedFacts: failingFacts.length,
    passRate: results.length === 0
      ? 1
      : Number(((results.length - failingFacts.length) / results.length).toFixed(4)),
    flagCounts,
    flagDescriptions: FLAG_DESCRIPTIONS,
    failingFacts: failingFacts.sort((a, b) => a.factId.localeCompare(b.factId)),
  };

  const md = renderDeckMarkdown(deck, results);

  await writeFile(join(OUT_DIR, `${deck.id}-rendered.md`), md, 'utf8');
  await writeFile(
    join(OUT_DIR, `${deck.id}-summary.json`),
    JSON.stringify(summary, null, 2) + '\n',
    'utf8'
  );

  return summary;
}

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }

function printConsoleSummary(summaries) {
  const cols = [
    ['Deck', 22],
    ['Facts', 7],
    ['Flagged', 8],
    ['Pass %', 8],
    ['Top Flags', 50],
  ];
  console.log('');
  console.log('Japanese Grammar Decks — Static In-Game Quiz Audit');
  console.log('='.repeat(cols.reduce((s, [, w]) => s + w + 1, 0)));
  console.log(cols.map(([h, w]) => pad(h, w)).join(' '));
  console.log(cols.map(([, w]) => '-'.repeat(w)).join(' '));
  for (const s of summaries) {
    const top3 = Object.entries(s.flagCounts)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, c]) => `${k}:${c}`)
      .join(' ');
    console.log([
      pad(s.deckId, 22),
      pad(s.totalFacts, 7),
      pad(s.flaggedFacts, 8),
      pad((s.passRate * 100).toFixed(1) + '%', 8),
      pad(top3 || '(clean)', 50),
    ].join(' '));
  }
  console.log('');
  const total = summaries.reduce((s, x) => s + x.totalFacts, 0);
  const flagged = summaries.reduce((s, x) => s + x.flaggedFacts, 0);
  console.log(`Total: ${total} facts, ${flagged} flagged (${((flagged / total) * 100).toFixed(1)}%)`);
  console.log(`Reports: data/audits/japanese-grammar/`);
  console.log('');
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const summaries = [];
  for (const f of DECK_FILES) {
    summaries.push(await auditDeck(f));
  }
  printConsoleSummary(summaries);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
