/**
 * Real-Engine Quiz Audit Script
 *
 * Imports and exercises the REAL game engine quiz functions against all curated
 * deck JSON files. Detects 35 categories of quiz quality issues including
 * engine-enabled checks that the static quiz-audit.mjs cannot perform.
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/quiz-audit-engine.ts [options]
 *
 * Modes:
 *   (default)            Programmatic checks (27 automated quality checks)
 *   --render             Render quiz samples for LLM content review
 *
 * Programmatic options:
 *   --deck <id>          Single deck (default: all non-image decks)
 *   --sample <N>         Max facts per pool (default: all)
 *   --stratified <N>     Sample N facts stratified across (difficulty × chainThemeId × answerTypePoolId).
 *                        Replaces --sample when active. Canonical 50-fact protocol for vocab decks.
 *                        If both --stratified and --sample are given, --stratified wins.
 *   --mastery 0,2,4      Comma-separated mastery levels (default: 0,2,4)
 *   --verbose            Show every fact's quiz presentation
 *   --json               JSON output to stdout
 *   --include-vocab      Include vocab/language decks (default: knowledge only)
 *   --confusion-test     Seed synthetic confusions to verify confusion matrix path
 *
 * Render options:
 *   --render             Output rendered quizzes for LLM review
 *   --render-per-pool N  Facts per pool (default: 5)
 *   --deck <id>          Single deck
 *   --include-vocab      Include vocab/language decks
 */

// Browser shim must load FIRST before any src/ imports
import '../tests/playtest/headless/browser-shim.js';

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { selectQuestionTemplate } from '../src/services/questionTemplateSelector';
import { selectDistractors, getDistractorCount } from '../src/services/curatedDistractorSelector';
import { isNumericalAnswer, getNumericalDistractors, displayAnswer } from '../src/services/numericalDistractorService';
import { ConfusionMatrix } from '../src/services/confusionMatrix';
import type { CuratedDeck, DeckFact, AnswerTypePool } from '../src/data/curatedDeckTypes';
import type { Fact } from '../src/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

function extractUnit(answer: string): string | null {
  if (!answer) return null;
  const clean = answer.replace(/[{}]/g, '').trim();
  // Require a real numeric literal followed by a short unit token (1–6 chars: letters, %, °, µ, /).
  // Anchored to end of string with optional trailing whitespace.
  // "5 mg" → "mg", "10 mL" → "ml", "1998" → null, "Before, in front of" → null
  // Note: "99.86%" has no whitespace before "%" so returns null — acceptable, documented below.
  // Percentage answers use the NumericalDistractors path; unit_contamination is not relevant there.
  const match = clean.match(/(?:^|\s)\d[\d,.]*\s+([a-zA-Z%°µ/]{1,6})\s*$/);
  return match ? match[1].toLowerCase() : null;
}

/** Seeded pseudo-random number generator (LCG). Returns values in [0, 1). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Shuffle array in-place using a seeded RNG. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = makeRng(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Stratified sampler
// ---------------------------------------------------------------------------

type StratumKey = string; // 'diff=<d>|theme=<t>|pool=<p>'

/**
 * Sample `budget` facts from `facts`, stratified by (difficulty × chainThemeId × answerTypePoolId).
 *
 * Allocation strategy:
 *   1. Each non-empty stratum gets at least 1 fact (floor allocation).
 *   2. Remaining slots are distributed proportionally by stratum size.
 *   3. Fractional-remainder slack goes to strata with the largest fractional parts.
 *   4. Each stratum's allocation is clamped to its actual size (no over-sampling).
 *   5. Within each stratum, facts are drawn using a seeded shuffle for reproducibility.
 *
 * @param facts     Full list of DeckFact objects to sample from.
 * @param budget    Target number of facts to return (≤ facts.length).
 * @param seedKey   Deck ID or other stable string — makes sampling reproducible.
 */
function stratifiedSample(
  facts: DeckFact[],
  budget: number,
  seedKey: string,
): DeckFact[] {
  if (facts.length === 0 || budget <= 0) return [];
  if (budget >= facts.length) return [...facts];

  // Group by (difficulty, chainThemeId, answerTypePoolId)
  const strata = new Map<StratumKey, DeckFact[]>();
  for (const f of facts) {
    const d = f.difficulty ?? 0;
    const t = f.chainThemeId ?? 0;
    const p = f.answerTypePoolId ?? '_nopool';
    const key: StratumKey = `diff=${d}|theme=${t}|pool=${p}`;
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key)!.push(f);
  }

  const nonEmpty = [...strata.entries()].filter(([, arr]) => arr.length > 0);
  if (nonEmpty.length === 0) return [];

  // Floor allocation: 1 per stratum
  const allocated = new Map<StratumKey, number>();
  let allocatedTotal = 0;
  for (const [key] of nonEmpty) {
    allocated.set(key, 1);
    allocatedTotal++;
  }

  const remaining = budget - allocatedTotal;
  if (remaining > 0) {
    const totalFacts = nonEmpty.reduce((s, [, arr]) => s + arr.length, 0);
    const remainders: Array<{ key: StratumKey; frac: number }> = [];
    for (const [key, arr] of nonEmpty) {
      const exact = (remaining * arr.length) / totalFacts;
      const base = Math.floor(exact);
      allocated.set(key, allocated.get(key)! + base);
      remainders.push({ key, frac: exact - base });
    }
    // Distribute rounding slack to largest fractional remainders
    const slack = budget - [...allocated.values()].reduce((s, n) => s + n, 0);
    remainders.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < slack && i < remainders.length; i++) {
      allocated.set(remainders[i].key, allocated.get(remainders[i].key)! + 1);
    }
  }

  // Clamp per-stratum allocation to actual stratum size (cannot over-sample)
  for (const [key, arr] of nonEmpty) {
    if (allocated.get(key)! > arr.length) allocated.set(key, arr.length);
  }

  // Seeded shuffle + draw
  const out: DeckFact[] = [];
  for (const [key, arr] of nonEmpty) {
    const n = allocated.get(key) ?? 0;
    if (n === 0) continue;
    const shuffled = seededShuffle([...arr], djb2(seedKey + ':' + key));
    out.push(...shuffled.slice(0, n));
  }

  return out;
}

// ---------------------------------------------------------------------------
// Deck classification
// ---------------------------------------------------------------------------

const VOCAB_PREFIXES = ['chinese_hsk', 'japanese_', 'korean_', 'french_', 'german_', 'spanish_', 'dutch_', 'czech_'];
const IMAGE_EXACT = ['world_flags'];

function classifyDeck(id: string): 'knowledge' | 'vocab' | 'image' {
  if (IMAGE_EXACT.includes(id)) return 'image';
  if (VOCAB_PREFIXES.some(p => id.startsWith(p))) return 'vocab';
  return 'knowledge';
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
  deckId: string | null;
  sample: number | null;
  masteryLevels: number[];
  verbose: boolean;
  jsonOutput: boolean;
  includeVocab: boolean;
  confusionTest: boolean;
  renderMode: boolean;
  renderPerPool: number;
  minPoolFacts: number;
  /** When non-null, uses stratified sampling instead of per-pool --sample N. */
  stratified: number | null;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let deckId: string | null = null;
  let sample: number | null = null;
  let masteryLevels = [0, 2, 4];
  let verbose = false;
  let jsonOutput = false;
  let includeVocab = false;
  let confusionTest = false;
  let renderMode = false;
  let renderPerPool = 5;
  let minPoolFacts = 5;
  let stratified: number | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--deck' && args[i + 1]) {
      deckId = args[++i];
    } else if (arg === '--sample' && args[i + 1]) {
      sample = parseInt(args[++i], 10);
    } else if (arg === '--mastery' && args[i + 1]) {
      masteryLevels = args[++i].split(',').map(v => parseInt(v.trim(), 10));
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--include-vocab') {
      includeVocab = true;
    } else if (arg === '--confusion-test') {
      confusionTest = true;
    } else if (arg === '--render') {
      renderMode = true;
    } else if (arg === '--render-per-pool' && args[i + 1]) {
      renderPerPool = parseInt(args[++i], 10);
    } else if (arg === '--min-pool-facts' && args[i + 1]) {
      minPoolFacts = parseInt(args[++i], 10);
    } else if (arg === '--stratified' && args[i + 1]) {
      stratified = parseInt(args[++i], 10);
    }
  }

  if (stratified !== null && sample !== null) {
    process.stderr.write('[quiz-audit-engine] both --stratified and --sample provided; using --stratified\n');
    sample = null;
  }

  return { deckId, sample, masteryLevels, verbose, jsonOutput, includeVocab, confusionTest, renderMode, renderPerPool, minPoolFacts, stratified };
}

// ---------------------------------------------------------------------------
// Deck loader
// ---------------------------------------------------------------------------

function loadDeck(deckId: string): CuratedDeck {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const deckPath = resolve(__dirname, '..', 'data', 'decks', `${deckId}.json`);
  try {
    const raw = readFileSync(deckPath, 'utf-8');
    const deck = JSON.parse(raw) as CuratedDeck;
    // Normalize optional arrays that some older decks lack
    if (!deck.questionTemplates) deck.questionTemplates = [];
    if (!deck.synonymGroups) deck.synonymGroups = [];
    return deck;
  } catch (_err) {
    console.error(`ERROR: Could not load deck "${deckId}" from ${deckPath}`);
    process.exit(1);
  }
}

function getAllDeckIds(): string[] {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const decksDir = resolve(__dirname, '..', 'data', 'decks');
  return readdirSync(decksDir)
    .filter(f => f.endsWith('.json') && f !== 'manifest.json')
    .map(f => f.replace('.json', ''));
}

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

interface Issue {
  severity: 'FAIL' | 'WARN';
  type: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Per-fact audit result
// ---------------------------------------------------------------------------

interface FactAuditResult {
  factId: string;
  masteryLevel: number;
  poolId: string;
  renderedQuestion: string;
  correctAnswer: string;
  distractors: Array<{ answer: string; source: string; factId: string }>;
  isNumerical: boolean;
  templateId: string;
  requestedCount: number;
  issues: Issue[];
}

// ---------------------------------------------------------------------------
// Core quality checks
// ---------------------------------------------------------------------------

function runChecks(
  fact: DeckFact,
  deck: CuratedDeck,
  masteryLevel: number,
  renderedQuestion: string,
  correctAnswer: string,
  correctDisplay: string,
  distractorFacts: DeckFact[],
  distractorSources: string[],
  templateId: string,
  requestedCount: number,
  isNumerical: boolean,
  confusionTestMode: boolean,
  confusedFactId?: string,
  templateQuestionFormat: string = '',
): Issue[] {
  const issues: Issue[] = [];

  // Check 1: em_dash_answer
  if (correctDisplay.includes('—')) {
    issues.push({ severity: 'FAIL', type: 'em_dash_answer', detail: `Answer contains em-dash: "${correctDisplay}"` });
  }

  // Check 2: answer_too_long
  const strippedAnswer = displayAnswer(correctAnswer);
  if (strippedAnswer.length > 100) {
    issues.push({ severity: 'FAIL', type: 'answer_too_long', detail: `Answer length ${strippedAnswer.length} > 100: "${strippedAnswer.slice(0, 60)}..."` });
  } else if (strippedAnswer.length > 60) {
    issues.push({ severity: 'WARN', type: 'answer_too_long', detail: `Answer length ${strippedAnswer.length} > 60: "${strippedAnswer.slice(0, 60)}..."` });
  }

  // Check 3: too_few_distractors (FAIL only — check 22 is WARN for shortfall)
  if (distractorFacts.length < 2) {
    issues.push({ severity: 'FAIL', type: 'too_few_distractors', detail: `Only ${distractorFacts.length} distractors (need ≥2)` });
  }

  // Check 4: length_mismatch (skip numerical, skip vocab decks)
  // Vocab decks have inherent length variance (kanji vs kana vs loanwords)
  // and the check is not meaningful for them. Confusion-matrix scoring
  // handles distractor selection in the real game.
  const deckClass = classifyDeck(deck.id);
  if (!isNumerical && deckClass !== 'vocab' && distractorFacts.length > 0) {
    const distractorDisplays = distractorFacts.map(d => displayAnswer(d.correctAnswer));
    const avgDistractorLen = distractorDisplays.reduce((s, d) => s + d.length, 0) / distractorDisplays.length;
    if (avgDistractorLen > 0) {
      const ratio = correctDisplay.length / avgDistractorLen;
      // Note: length_mismatch is WARN-only (not FAIL) because the real game engine uses
      // confusion-matrix scoring that naturally selects pedagogically relevant distractors
      // regardless of length. A "T8" answer with "Subscapularis" distractor is intentional
      // when the player has confused them. The audit's simulated selection (seeded shuffle)
      // doesn't reflect real-game distractor quality. See 2026-04-06 analysis.
      if (ratio > 3 || ratio < (1 / 3)) {
        issues.push({ severity: 'WARN', type: 'length_mismatch', detail: `Correct length ${correctDisplay.length} vs avg distractor ${avgDistractorLen.toFixed(1)} — ratio ${ratio.toFixed(2)}×` });
      } else if (ratio > 2 || ratio < 0.5) {
        issues.push({ severity: 'WARN', type: 'length_mismatch', detail: `Correct length ${correctDisplay.length} vs avg distractor ${avgDistractorLen.toFixed(1)} — ratio ${ratio.toFixed(2)}×` });
      }
    }
  }

  // Check 5: answer_in_distractors
  const correctLower = correctDisplay.toLowerCase();
  for (const d of distractorFacts) {
    if (displayAnswer(d.correctAnswer).toLowerCase() === correctLower) {
      issues.push({ severity: 'FAIL', type: 'answer_in_distractors', detail: `Correct answer "${correctDisplay}" appears as distractor` });
      break;
    }
  }

  // Check 6: duplicate_distractors
  const seen = new Set<string>();
  let hasDupe = false;
  for (const d of distractorFacts) {
    const k = displayAnswer(d.correctAnswer).toLowerCase();
    if (seen.has(k)) { hasDupe = true; break; }
    seen.add(k);
  }
  if (hasDupe) {
    issues.push({ severity: 'FAIL', type: 'duplicate_distractors', detail: `Duplicate distractor text in set: ${JSON.stringify(distractorFacts.map(d => d.correctAnswer))}` });
  }

  // Check 7: question_too_long
  if (renderedQuestion.length > 400) {
    issues.push({ severity: 'FAIL', type: 'question_too_long', detail: `Question length ${renderedQuestion.length} > 400` });
  } else if (renderedQuestion.length > 300) {
    issues.push({ severity: 'WARN', type: 'question_too_long', detail: `Question length ${renderedQuestion.length} > 300` });
  }

  // Check 8: missing_explanation
  if (!fact.explanation || !fact.explanation.trim()) {
    issues.push({ severity: 'FAIL', type: 'missing_explanation', detail: `Fact ${fact.id} has no explanation` });
  }

  // Check 9: trivially_eliminatable
  if (distractorFacts.length > 0) {
    const allOptions = [correctDisplay, ...distractorFacts.map(d => displayAnswer(d.correctAnswer))];
    const avgLen = allOptions.reduce((s, o) => s + o.length, 0) / allOptions.length;
    if (avgLen >= 5) {
      for (const opt of allOptions) {
        const ratio = opt.length / avgLen;
        if (ratio > 4 || ratio < 0.2) {
          issues.push({ severity: 'WARN', type: 'trivially_eliminatable', detail: `Option "${opt.slice(0, 40)}" (len ${opt.length}) is outlier vs avg ${avgLen.toFixed(1)}` });
          break;
        }
      }
    }
  }

  // Check 10: empty_placeholder
  if (/  /.test(renderedQuestion)) {
    issues.push({ severity: 'WARN', type: 'empty_placeholder', detail: `Double spaces in rendered question (empty template slot): "${renderedQuestion.slice(0, 80)}"` });
  }

  // --- Engine-enabled checks ---

  // Check 11: synonym_violation
  if (fact.synonymGroupId) {
    const group = deck.synonymGroups.find(g => g.id === fact.synonymGroupId);
    if (group) {
      for (let i = 0; i < distractorFacts.length; i++) {
        const d = distractorFacts[i];
        if (d.synonymGroupId && d.synonymGroupId === fact.synonymGroupId && !d.id.startsWith('_')) {
          issues.push({ severity: 'FAIL', type: 'synonym_violation', detail: `Distractor "${d.correctAnswer}" shares synonym group "${fact.synonymGroupId}" with correct fact` });
        }
      }
    }
  }

  // Check 12: unit_contamination (only for non-numerical pool-based)
  if (!isNumerical && distractorFacts.length > 0) {
    const correctUnit = extractUnit(correctDisplay);
    if (correctUnit) {
      for (const d of distractorFacts) {
        if (d.id.startsWith('_fallback_') || d.id.startsWith('_synthetic_')) continue;
        const dUnit = extractUnit(displayAnswer(d.correctAnswer));
        if (dUnit && dUnit !== correctUnit) {
          issues.push({ severity: 'WARN', type: 'unit_contamination', detail: `Distractor "${d.correctAnswer}" has unit "${dUnit}" but correct is "${correctUnit}"` });
        }
      }
    }
  }

  // Check 13: pos_mismatch (vocab decks)
  if (fact.partOfSpeech) {
    for (const d of distractorFacts) {
      if (d.partOfSpeech && d.partOfSpeech !== fact.partOfSpeech) {
        issues.push({ severity: 'WARN', type: 'pos_mismatch', detail: `Distractor "${d.correctAnswer}" POS "${d.partOfSpeech}" != correct "${fact.partOfSpeech}"` });
        break; // one warning per fact is enough
      }
    }
  }

  // Check 14: template_rendering_fallback
  // A genuine fallback occurs when renderTemplate returns fact.quizQuestion because a
  // placeholder resolved to empty or was unresolved. However, if the template renders
  // correctly to a string that happens to equal fact.quizQuestion (e.g. kanji facts whose
  // quizQuestion was authored to match the template format exactly), this is NOT a fallback.
  // Distinguish by checking whether all placeholders in the template format resolved
  // to non-empty values — if they did, the identical render is intentional.
  if (templateId !== '_fallback' && renderedQuestion === fact.quizQuestion) {
    const placeholderKeys = [...(templateQuestionFormat.match(/\{(\w+)\}/g) ?? [])].map(p => p.slice(1, -1));
    const genuineFallback = placeholderKeys.length === 0 || placeholderKeys.some(key => {
      const val = (fact as Record<string, unknown>)[key];
      return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
    });
    if (genuineFallback) {
      issues.push({ severity: 'WARN', type: 'template_rendering_fallback', detail: `Template "${templateId}" fell back to fact.quizQuestion — likely empty placeholder` });
    }
  }

  // Check 15: unresolved_placeholder
  if (/\{[a-zA-Z]\w*\}/.test(renderedQuestion)) {
    issues.push({ severity: 'FAIL', type: 'unresolved_placeholder', detail: `Rendered question contains unresolved placeholder: "${renderedQuestion}"` });
  }

  // Check 16: reverse_answer_wrong
  if (templateId === 'reverse' && fact.targetLanguageWord && correctAnswer !== fact.targetLanguageWord) {
    issues.push({ severity: 'FAIL', type: 'reverse_answer_wrong', detail: `Template "reverse" but correctAnswer "${correctAnswer}" != targetLanguageWord "${fact.targetLanguageWord}"` });
  }

  // Check 17: reading_answer_wrong
  if (templateId === 'reading' && fact.reading && correctAnswer !== fact.reading) {
    issues.push({ severity: 'FAIL', type: 'reading_answer_wrong', detail: `Template "reading" but correctAnswer "${correctAnswer}" != reading "${fact.reading}"` });
  }

  // Check 18: question_text_leak
  const questionLower = renderedQuestion.toLowerCase();
  for (const d of distractorFacts) {
    const dDisplay = displayAnswer(d.correctAnswer);
    if (dDisplay.length > 2 && questionLower.includes(dDisplay.toLowerCase())) {
      issues.push({ severity: 'WARN', type: 'question_text_leak', detail: `Distractor "${dDisplay}" appears in the question text` });
      break;
    }
  }

  // Check 19: all_pool_fill
  const pool = deck.answerTypePools.find(p => p.id === fact.answerTypePoolId);
  const poolSize = pool ? (pool.factIds.length + (pool.syntheticDistractors?.length ?? 0)) : 0;
  if (!isNumerical && poolSize > 10 && distractorSources.length > 0 && distractorSources.every(s => s === 'pool_fill')) {
    issues.push({ severity: 'WARN', type: 'all_pool_fill', detail: `All ${distractorSources.length} distractors are pool_fill — no confusion/difficulty signals` });
  }

  // Check 20: fallback_distractors_used
  if (distractorFacts.some(d => d.id.startsWith('_fallback_'))) {
    issues.push({ severity: 'WARN', type: 'fallback_distractors_used', detail: `Some distractors came from pre-generated fallback list (pool too small)` });
  }

  // Check 21: empty_correct_answer
  if (!correctDisplay || !correctDisplay.trim()) {
    issues.push({ severity: 'FAIL', type: 'empty_correct_answer', detail: `Displayed correct answer is empty after template rendering` });
  }

  // Check 22: distractor_count_shortfall
  if (distractorFacts.length < requestedCount && distractorFacts.length >= 2) {
    issues.push({ severity: 'WARN', type: 'distractor_count_shortfall', detail: `Got ${distractorFacts.length} distractors, requested ${requestedCount}` });
  }

  // Check 23: confusion_not_responsive (only in --confusion-test mode)
  if (confusionTestMode && confusedFactId) {
    const hasConfused = distractorFacts.some(d => d.id === confusedFactId);
    if (!hasConfused) {
      // Check if the confused fact's answer is mentioned in the question text —
      // the engine correctly excludes it in that case (not a bug).
      const confusedFact = deck.facts.find(f => f.id === confusedFactId);
      const confusedAnswer = confusedFact ? displayAnswer(confusedFact.correctAnswer).toLowerCase() : '';
      const isExcludedByQuestion = confusedAnswer.length > 2 && renderedQuestion.toLowerCase().includes(confusedAnswer);
      if (!isExcludedByQuestion) {
        issues.push({ severity: 'FAIL', type: 'confusion_not_responsive', detail: `Seeded confusion for "${confusedFactId}" but it didn't appear in distractors` });
      }
    }
  }

  // Check 24: mastery_count_wrong
  const expectedCount = getDistractorCount(masteryLevel);
  if (!isNumerical && distractorFacts.length !== expectedCount && distractorFacts.length >= 2) {
    // Only flag if we got a "wrong" count that's also sufficient (≥2) — pool may legitimately be too small
    // Actually: only flag if we got MORE than expected (that would be a logic bug)
    if (distractorFacts.length > expectedCount) {
      issues.push({ severity: 'FAIL', type: 'mastery_count_wrong', detail: `Got ${distractorFacts.length} distractors but mastery ${masteryLevel} expects ${expectedCount}` });
    }
  }

  // Check 25: question_type_mismatch
  // Detect when question keyword implies a specific answer type but options don't match.
  // e.g. "Who invented..." → all options should look like person names.
  if (!isNumerical && distractorFacts.length > 0) {
    const qLower = renderedQuestion.toLowerCase();
    type FormatTest = (s: string) => boolean;
    let impliedType: [string, FormatTest] | null = null;

    if (/\bwho\b|\bwhich person\b|\bwhich ruler\b|\bwhich leader\b|\bwhich author\b/.test(qLower)) {
      // Expect person-name-like: starts with capital, no bare numeric strings
      impliedType = ['person name', (s: string) => /^[A-Z]/.test(s.trim()) && !/^\d+$/.test(s.trim())];
    } else if (/\bwhat year\b|\bwhich year\b|\bin what year\b|\bwhen was\b|\bwhen did\b|\bwhen were\b/.test(qLower)) {
      // Expect date/year token
      impliedType = ['year/date', (s: string) => /\d/.test(s)];
    } else if (/\bhow many\b|\bhow much\b|\bhow long\b|\bhow far\b|\bhow tall\b|\bhow deep\b/.test(qLower)) {
      // Expect a numeric quantity
      impliedType = ['quantity', (s: string) => /\d/.test(s)];
    } else if (/\bwhere\b|\bwhich city\b|\bwhich country\b|\bwhich continent\b|\bwhich region\b|\bwhich state\b|\bwhich planet\b/.test(qLower)) {
      // Expect place-like: starts with capital
      impliedType = ['place name', (s: string) => /^[A-Z]/.test(s.trim())];
    }

    if (impliedType !== null) {
      const [typeLabel, matchesFn] = impliedType;
      const allOptions = [correctDisplay, ...distractorFacts.map(d => displayAnswer(d.correctAnswer))];
      const mismatched = allOptions.filter(opt => !matchesFn(opt));
      if (mismatched.length >= 2) {
        issues.push({
          severity: 'WARN',
          type: 'question_type_mismatch',
          detail: `Question implies ${typeLabel} answers but ${mismatched.length} options don't match: ${mismatched.map(s => '"' + s.slice(0, 30) + '"').join(', ')}`,
        });
      }
    }
  }

  /**
   * Detects whether a string looks like a math/physics formula.
   * True if it contains an equals sign AND at least one mathematical marker:
   * Greek letters, subscripts (_), superscripts (², ³, etc.), math operators,
   * or bracket/fraction symbols. Formulas naturally vary in format features
   * (capitalization, word count, symbols) so the format-inconsistency check
   * is not meaningful for them.
   */
  const looksLikeFormula = (s: string): boolean => {
    if (!s.includes('=')) return false;
    // Detect Unicode math markers (subscripts, superscripts, Greek, operators, fractions)
    if (/[_\u00B2\u00B3\u2070-\u209F\u0370-\u03FF\u2200-\u22FF\u2190-\u21FF\u2150-\u218F\u00BD\u2153\u00BC\u2154\u2155\u221A\u2202\u2207\u2211\u222B]/.test(s)) return true;
    // ASCII formula patterns:
    //   * operator:           "L = I*omega", "P = Fv*cos"
    //   ^ exponent:           "g = 10 m/s^2"
    //   _subscript:           "a_c = ...", "F_s = ..."
    //   N/letter fraction:    "Period T = 1/f", "frequency f = 1/T"
    //   implicit product:     "P = Fv", "p = mv", "F = ma" (1-2 char variable names, no spaces)
    //   Note: constrained to 1-2 char var names to avoid matching prose like "angle = impact angle"
    if (/[=].*[*^]/.test(s)) return true;
    if (/[a-zA-Z][_][a-zA-Z]/.test(s)) return true;
    if (/=\s*\d+\/[a-zA-Z]/.test(s)) return true;                           // = 1/f, = 1/T
    if (/=\s*[0-9]*[a-zA-Z]{1,2}[a-zA-Z]{1,2}(?:\b|\s|\()/.test(s)) return true; // = mv, = Fv, = ma
    return false;
  };

  // Check 26: distractor_format_inconsistency
  // Flag when a distractor has ≥2 format features different from the correct answer.
  // Catches cases like: correct="15 days" (has units, has digit, multi-word) but distractor="7" (numeric only).
  // Math/physics formulas are excluded: equations like "U_s = ½kx²" and "v = v₀ + at" differ in
  // format features naturally but are both valid answers from the same semantic pool.
  //
  // Capitalization is treated as a SINGLE categorical axis (Phase-3 fix, 2026-04-10).
  // Previously `startsCapital` and `isAllLower` were two independent booleans that both flipped
  // when comparing a capitalized answer (e.g. "Bones") to an all-lowercase answer (e.g. "ufotable"),
  // causing a cosmetic 2-feature diff that tripped the threshold. Replacing them with one
  // `capitalizationStyle` field ('capitalized' | 'lowercase' | 'mixed' | 'numeric') collapses
  // that double-count into a single axis, eliminating ~65% false-positive noise (1200+ warns
  // across 49 decks) while keeping real cross-category pool contamination warns intact.
  if (!isNumerical && distractorFacts.length > 0) {
    type CapStyle = 'capitalized' | 'lowercase' | 'mixed' | 'numeric';
    const getCapStyle = (s: string): CapStyle => {
      if (/^\d/.test(s)) return 'numeric';
      if (/^[A-Z]/.test(s)) return 'capitalized';
      if (s === s.toLowerCase() && /[a-z]/.test(s)) return 'lowercase';
      return 'mixed';
    };
    type FormatFeatures = { hasUnits: boolean; isNumericOnly: boolean; capitalizationStyle: CapStyle; isMultiWord: boolean };
    const getFormatFeatures = (s: string): FormatFeatures => {
      const stripped = displayAnswer(s);
      return {
        hasUnits: /[a-zA-Z]+$/.test(stripped.replace(/[.,]/g, '')) && /\d/.test(stripped),
        isNumericOnly: /^[\d,.\s]+$/.test(stripped.trim()),
        capitalizationStyle: getCapStyle(stripped.trim()),
        isMultiWord: stripped.trim().split(/\s+/).length > 1,
      };
    };
    const correctFeatures = getFormatFeatures(correctDisplay);
    for (const d of distractorFacts) {
      if (d.id.startsWith('_numerical_') || d.id.startsWith('_fallback_') || d.id.startsWith('_synthetic_')) continue;
      const dDisplay = displayAnswer(d.correctAnswer);
      const correctIsFormula = looksLikeFormula(correctDisplay);
      if (correctIsFormula && looksLikeFormula(dDisplay)) continue; // skip format check for formulas
      const dFeatures = getFormatFeatures(dDisplay);
      // Count each feature as ONE axis regardless of type (boolean or string enum).
      // The threshold stays at ≥2 — only the counting is fixed.
      let diffCount = 0;
      const keys = Object.keys(correctFeatures) as Array<keyof FormatFeatures>;
      for (const key of keys) {
        if ((correctFeatures[key] as unknown) !== (dFeatures[key] as unknown)) diffCount++;
      }
      if (diffCount >= 2) {
        issues.push({
          severity: 'WARN',
          type: 'distractor_format_inconsistency',
          detail: `Distractor "${dDisplay.slice(0, 40)}" has ${diffCount} format features different from correct "${correctDisplay.slice(0, 40)}"`,
        });
        break; // one warning per fact is enough
      }
    }
  }

  // Check 27: near_duplicate_options
  // Detect suspiciously similar options in the same quiz presentation.
  // Catches near-duplicates (Levenshtein > 0.8), substring containment, and trailing-digit variants.
  if (distractorFacts.length > 0) {
    const allOptions = [correctDisplay, ...distractorFacts.map(d => displayAnswer(d.correctAnswer))];

    /** Normalized Levenshtein similarity in [0, 1]. */
    const levenshteinSimilarity = (a: string, b: string): number => {
      const al = a.toLowerCase().replace(/\s+/g, ' ').trim();
      const bl = b.toLowerCase().replace(/\s+/g, ' ').trim();
      if (al === bl) return 1;
      const maxLen = Math.max(al.length, bl.length);
      if (maxLen === 0) return 1;
      // DP Levenshtein
      const row: number[] = Array.from({ length: bl.length + 1 }, (_, i) => i);
      for (let ii = 1; ii <= al.length; ii++) {
        let prev = ii;
        for (let jj = 1; jj <= bl.length; jj++) {
          const cost = al[ii - 1] === bl[jj - 1] ? 0 : 1;
          const curr = Math.min(prev + 1, row[jj] + 1, row[jj - 1] + cost);
          row[jj - 1] = prev;
          prev = curr;
        }
        row[bl.length] = prev;
      }
      return 1 - row[bl.length] / maxLen;
    };

    let nearDupFound = false;
    for (let ii = 0; ii < allOptions.length - 1 && !nearDupFound; ii++) {
      for (let jj = ii + 1; jj < allOptions.length && !nearDupFound; jj++) {
        const a = allOptions[ii];
        const b = allOptions[jj];
        const sim = levenshteinSimilarity(a, b);
        if (sim > 0.8) {
          issues.push({
            severity: 'WARN',
            type: 'near_duplicate_options',
            detail: `Options "${a.slice(0, 40)}" and "${b.slice(0, 40)}" are ${(sim * 100).toFixed(0)}% similar`,
          });
          nearDupFound = true;
        } else {
          // Substring containment (meaningful length > 5)
          const minLen = Math.min(a.length, b.length);
          if (minLen > 5) {
            const aLower = a.toLowerCase();
            const bLower = b.toLowerCase();
            if (aLower.includes(bLower) || bLower.includes(aLower)) {
              issues.push({
                severity: 'WARN',
                type: 'near_duplicate_options',
                detail: `Option "${b.slice(0, 40)}" is a substring of "${a.slice(0, 40)}"`,
              });
              nearDupFound = true;
            }
          }
          // Trailing-digit variant: options differ only by trailing number (e.g. "Voyager 1" vs "Voyager 2")
          if (!nearDupFound) {
            const aBase = a.replace(/\s*\d+$/, '').trim().toLowerCase();
            const bBase = b.replace(/\s*\d+$/, '').trim().toLowerCase();
            if (aBase.length > 3 && aBase === bBase && a !== b) {
              issues.push({
                severity: 'WARN',
                type: 'near_duplicate_options',
                detail: `Options "${a}" and "${b}" differ only by trailing number`,
              });
              nearDupFound = true;
            }
          }
        }
      }
    }
  }

  // Check 28: reverse_distractor_language_mismatch (Phase 5 — runtime mirror of #27)
  // At render time, verify distractors use the same script/language as the correct answer.
  // Heuristic: if correctDisplay is all-ASCII but some distractor contains CJK/kana/hangul → mismatch.
  // And vice-versa: if correctDisplay has CJK/kana and distractor is all-ASCII → mismatch.
  if (distractorFacts.length > 0) {
    const hasCJK = (s: string): boolean =>
      /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/.test(s);
    const correctHasCJK = hasCJK(correctDisplay);
    for (const d of distractorFacts) {
      if (d.id.startsWith('_fallback_') || d.id.startsWith('_synthetic_') || d.id.startsWith('_numerical_')) continue;
      const dDisplay = displayAnswer(d.correctAnswer);
      const dHasCJK = hasCJK(dDisplay);
      if (correctHasCJK !== dHasCJK) {
        issues.push({
          severity: 'WARN',
          type: 'reverse_distractor_language_mismatch',
          detail: `Distractor "${dDisplay.slice(0, 30)}" script type (CJK=${dHasCJK}) differs from correct "${correctDisplay.slice(0, 30)}" (CJK=${correctHasCJK})`,
        });
        break;
      }
    }
  }

  // Check 29: definition_match_runtime_leak (Phase 5 — runtime mirror of #25)
  // Though the engine prevents this at runtime, add a regression assertion.
  // If templateId contains 'definition' or 'explain' and the rendered question contains
  // the correct answer text verbatim, flag it.
  if (templateId.toLowerCase().includes('definition') || templateId.toLowerCase().includes('explain')) {
    const ansLower = correctDisplay.toLowerCase().trim();
    const qLower = renderedQuestion.toLowerCase();
    if (ansLower.length >= 3 && qLower.includes(ansLower)) {
      issues.push({
        severity: 'WARN',
        type: 'definition_match_runtime_leak',
        detail: `Definition template "${templateId}" rendered question contains correct answer "${correctDisplay.slice(0, 40)}" — answer leaked into question`,
      });
    }
  }

  // Check 30: reading_on_phonetic_runtime (Phase 5 — runtime mirror of #28)
  // If the reading template was selected and the correct answer equals the targetLanguageWord,
  // the quiz is trivial (the player just sees the word and is asked what it reads as — same thing).
  if (templateId === 'reading' && fact.targetLanguageWord && fact.reading) {
    const norm = (s: string): string => s.trim().replace(/\s+/g, '');
    if (norm(fact.reading) === norm(fact.targetLanguageWord)) {
      issues.push({
        severity: 'WARN',
        type: 'reading_on_phonetic_runtime',
        detail: `Reading template applied but reading "${fact.reading.slice(0, 20)}" === targetLanguageWord — trivial question`,
      });
    }
  }

  // Check 31: numeric_distractor_out_of_domain (Phase 5 — runtime mirror of #29)
  // For percentage questions (question has "percent" or answer ends in "%"),
  // flag numerical distractors > 100.
  if (isNumerical) {
    const qLower31 = renderedQuestion.toLowerCase();
    const isPercentQ = qLower31.includes('percent') || qLower31.includes('%') || correctDisplay.endsWith('%');
    if (isPercentQ) {
      for (const d of distractorFacts) {
        const dNum = parseFloat(displayAnswer(d.correctAnswer).replace(/%$/, ''));
        if (!isNaN(dNum) && dNum > 100) {
          issues.push({
            severity: 'WARN',
            type: 'numeric_distractor_out_of_domain',
            detail: `Percentage question has distractor ${dNum} > 100%`,
          });
          break;
        }
      }
    }
  }

  // Check 32: placeholder_leak_runtime (Phase 5 — runtime mirror of #26)
  // Flag any rendered question containing the classic placeholder leak patterns.
  {
    const capitalWordThisRe = /[A-Z][a-z]+\s+this/;
    if (capitalWordThisRe.test(renderedQuestion)) {
      issues.push({
        severity: 'WARN',
        type: 'placeholder_leak_runtime',
        detail: `Rendered question contains "capital-word this" placeholder leak: "${renderedQuestion.slice(0, 80)}"`,
      });
    }
    if (/anatomical structure\s+\w+/.test(renderedQuestion)) {
      issues.push({
        severity: 'WARN',
        type: 'placeholder_leak_runtime',
        detail: `Rendered question contains "anatomical structure" template leak: "${renderedQuestion.slice(0, 80)}"`,
      });
    }
  }

  // Check 35: chinese_sense_mismatch_runtime (Phase 5 — runtime mirror of #30)
  // For HSK decks, validate that correctAnswer matches a sense in the explanation.
  if (deck.id && deck.id.startsWith('chinese_hsk') && fact.explanation && fact.correctAnswer) {
    const senses35 = fact.correctAnswer.split(/[;,/]/).map((s: string) => s.trim()).filter((s: string) => s.length >= 3);
    if (senses35.length > 0) {
      const expl35 = fact.explanation.toLowerCase();
      const anyMatch = senses35.some((sense: string) => expl35.includes(sense.toLowerCase()));
      if (!anyMatch) {
        issues.push({
          severity: 'WARN',
          type: 'chinese_sense_mismatch_runtime',
          detail: `HSK fact "${fact.id}" correctAnswer senses [${senses35.slice(0, 3).join(', ')}] not found in explanation`,
        });
      }
    }
  }


  return issues;
}

// ---------------------------------------------------------------------------
// Confusion matrix test mode helpers
// ---------------------------------------------------------------------------

interface ConfusionPair {
  factA: DeckFact;
  factB: DeckFact;
  poolId: string;
}

function findConfusionTestPairs(deck: CuratedDeck, maxPairs: number = 5): ConfusionPair[] {
  const pairs: ConfusionPair[] = [];

  for (const pool of deck.answerTypePools) {
    if (pool.factIds.length < 2) continue;
    const poolFacts = pool.factIds
      .map(id => deck.facts.find(f => f.id === id))
      .filter(Boolean) as DeckFact[];

    // Only pair facts with DIFFERENT correctAnswer values so the confused fact
    // can actually appear as a distractor (same-answer pairs are always excluded
    // by the distractor deduplication logic in selectDistractors).
    for (let i = 0; i < poolFacts.length - 1 && pairs.length < maxPairs; i++) {
      const factA = poolFacts[i];
      // Find first subsequent fact with a different correctAnswer
      for (let j = i + 1; j < poolFacts.length; j++) {
        const factB = poolFacts[j];
        if (factB.correctAnswer.toLowerCase() !== factA.correctAnswer.toLowerCase()) {
          pairs.push({ factA, factB, poolId: pool.id });
          break;
        }
      }
    }

    if (pairs.length >= maxPairs) break;
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Audit a single fact at a given mastery level
// ---------------------------------------------------------------------------

function auditFactWithEngine(
  fact: DeckFact,
  deck: CuratedDeck,
  masteryLevel: number,
  confusionMatrix: ConfusionMatrix,
  opts: { confusionTestMode: boolean; confusedFactId?: string },
): FactAuditResult {
  const seed = djb2(fact.id + masteryLevel);

  // 1. Select question template
  const templateResult = selectQuestionTemplate(fact, deck, masteryLevel, [], seed);
  const { renderedQuestion, template, answerPoolId, correctAnswer } = templateResult;
  const correctDisplay = displayAnswer(correctAnswer);

  // 2. Get distractor count for mastery level
  const requestedCount = getDistractorCount(masteryLevel);

  // 3. Get distractors
  let distractorFacts: DeckFact[] = [];
  let distractorSources: string[] = [];
  let isNumerical = false;

  if (isNumericalAnswer(fact.correctAnswer)) {
    isNumerical = true;
    const factAdapter = { id: fact.id, correctAnswer: fact.correctAnswer } as unknown as Fact;
    const numericalDistractors = getNumericalDistractors(factAdapter, requestedCount);
    // Wrap string distractors as minimal DeckFact objects for uniform processing
    distractorFacts = numericalDistractors.map(d => ({
      id: `_numerical_${d}`,
      correctAnswer: d,
      acceptableAlternatives: [],
      chainThemeId: 0,
      answerTypePoolId: fact.answerTypePoolId,
      difficulty: fact.difficulty,
      funScore: 1,
      quizQuestion: '',
      explanation: '',
      visualDescription: '',
      sourceName: '',
      distractors: [],
    }));
    distractorSources = numericalDistractors.map(() => 'numerical');
  } else {
    const pool = deck.answerTypePools.find(p => p.id === answerPoolId);
    if (pool) {
      const result = selectDistractors(
        fact,
        pool,
        deck.facts,
        deck.synonymGroups,
        confusionMatrix,
        null, // no in-run tracker for audit
        requestedCount,
        masteryLevel,
        templateResult.distractorAnswerField,
      );
      distractorFacts = result.distractors;
      distractorSources = result.sources;
    }
  }

  // 4. Run quality checks
  const issues = runChecks(
    fact,
    deck,
    masteryLevel,
    renderedQuestion,
    correctAnswer,
    correctDisplay,
    distractorFacts,
    distractorSources,
    template.id,
    requestedCount,
    isNumerical,
    opts.confusionTestMode,
    opts.confusedFactId,
    template.questionFormat,
  );

  return {
    factId: fact.id,
    masteryLevel,
    poolId: answerPoolId,
    renderedQuestion,
    correctAnswer: correctDisplay,
    distractors: distractorFacts.map((d, i) => ({
      answer: displayAnswer(d.correctAnswer),
      source: distractorSources[i] ?? 'unknown',
      factId: d.id,
    })),
    isNumerical,
    templateId: template.id,
    requestedCount,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Per-deck audit
// ---------------------------------------------------------------------------

interface DeckAuditResult {
  deckId: string;
  deckName: string;
  deckClass: 'knowledge' | 'vocab' | 'image';
  totalFacts: number;
  totalChecks: number;
  failCount: number;
  warnCount: number;
  issuesByType: Record<string, { fail: number; warn: number }>;
  factResults: FactAuditResult[];
  confusionTestResults?: {
    pairsChecked: number;
    failures: number;
    details: string[];
  };
}

function auditDeck(
  deck: CuratedDeck,
  masteryLevels: number[],
  samplePerPool: number | null,
  opts: { verbose: boolean; confusionTestMode: boolean; minPoolFacts: number },
  stratifiedBudget: number | null = null,
): DeckAuditResult {
  const deckClass = classifyDeck(deck.id);
  const factResults: FactAuditResult[] = [];
  const issuesByType: Record<string, { fail: number; warn: number }> = {};

  // Deck-level check: min_pool_facts
  // Run once per pool before per-fact loop. Catches hollow pools early.
  // Bracket-numbers pools (numerical distractors) are exempt.
  if (deckClass !== 'vocab') {
    for (const pool of deck.answerTypePools) {
      const isBracketPool = pool.factIds.length === 0 && (pool.syntheticDistractors?.length ?? 0) > 0;
      if (isBracketPool) continue;
      // Pools flagged homogeneityExempt are algorithmic/synthetic by design (e.g. bracket_numbers).
      // They don't need a 5-fact floor — numeric distractors are synthesized, not drawn from facts.
      if ((pool as unknown as { homogeneityExempt?: boolean }).homogeneityExempt === true) continue;
      const realFactCount = pool.factIds.length;
      if (realFactCount < opts.minPoolFacts) {
        const key = 'min_pool_facts';
        if (!issuesByType[key]) issuesByType[key] = { fail: 0, warn: 0 };
        issuesByType[key].warn++;
        // Synthesize a FactAuditResult with no mastery/question context for the pool-level issue
        factResults.push({
          factId: `_pool_${pool.id}`,
          masteryLevel: -1,
          poolId: pool.id,
          renderedQuestion: `(pool-level check)`,
          correctAnswer: '',
          distractors: [],
          isNumerical: false,
          templateId: '_pool_check',
          requestedCount: 0,
          issues: [{
            severity: 'WARN',
            type: 'min_pool_facts',
            detail: `Pool "${pool.id}" has only ${realFactCount} real factIds (min: ${opts.minPoolFacts})`,
          }],
        });
      }
    }
  }

  // Deck-level Phase 5 checks:

  // Phase 5 — empty_chain_themes_runtime (check 34 moved to deck level)
  // Knowledge decks must define chainThemes OR have populated subDecks. Fires once per deck.
  // Guard: chainDistribution.ts Priority-1 uses deck.subDecks as TopicGroups — decks
  // with subDecks work correctly at runtime even without chainThemes. Only fire the
  // warning when BOTH chainThemes AND subDecks are absent.
  if (deckClass !== 'vocab' && deckClass !== 'image') {
    const themes = (deck as unknown as { chainThemes?: unknown[] }).chainThemes;
    const subDeckCount = (deck as unknown as { subDecks?: unknown[] }).subDecks?.length ?? 0;
    if ((!Array.isArray(themes) || themes.length === 0) && subDeckCount === 0) {
      const key = 'empty_chain_themes_runtime';
      if (!issuesByType[key]) issuesByType[key] = { fail: 0, warn: 0 };
      issuesByType[key].warn++;
      factResults.push({
        factId: '_deck_chain_themes',
        masteryLevel: -1,
        poolId: '_deck',
        renderedQuestion: '(deck-level check)',
        correctAnswer: '',
        distractors: [],
        isNumerical: false,
        templateId: '_deck_check',
        requestedCount: 0,
        issues: [{
          severity: 'WARN',
          type: 'empty_chain_themes_runtime',
          detail: `Knowledge deck "${deck.id}" has neither chainThemes nor subDecks — Study Temple mode will fall through to a default grouping.`,
        }],
      });
    }
  }

  // Phase 5 — mega_pool_runtime_warning (check 33 moved to deck level)
  // Pools with >100 factIds in knowledge decks should be split. Fires once per pool.
  if (deckClass !== 'vocab') {
    for (const pool of deck.answerTypePools) {
      if (pool.factIds.length > 100) {
        const key = 'mega_pool_runtime_warning';
        if (!issuesByType[key]) issuesByType[key] = { fail: 0, warn: 0 };
        issuesByType[key].warn++;
        factResults.push({
          factId: `_mega_pool_${pool.id}`,
          masteryLevel: -1,
          poolId: pool.id,
          renderedQuestion: '(deck-level check)',
          correctAnswer: '',
          distractors: [],
          isNumerical: false,
          templateId: '_deck_check',
          requestedCount: 0,
          issues: [{
            severity: 'WARN',
            type: 'mega_pool_runtime_warning',
            detail: `Pool "${pool.id}" has ${pool.factIds.length} factIds (>100) — consider splitting by sub-topic`,
          }],
        });
      }
    }
  }


  // Determine facts to audit (stratified OR per-pool sample OR full deck)
  let factsToAudit: DeckFact[];
  if (stratifiedBudget !== null) {
    // Stratified mode: sample N facts across (difficulty × chainThemeId × answerTypePoolId)
    // Skip image facts before sampling — they have separate quiz paths
    const eligibleFacts = deck.facts.filter(
      f => f.quizMode !== 'image_question' && f.quizMode !== 'image_answers',
    );
    factsToAudit = stratifiedSample(eligibleFacts, stratifiedBudget, deck.id);
  } else if (samplePerPool !== null) {
    const perPool = new Map<string, DeckFact[]>();
    for (const fact of deck.facts) {
      const list = perPool.get(fact.answerTypePoolId) ?? [];
      list.push(fact);
      perPool.set(fact.answerTypePoolId, list);
    }
    factsToAudit = [];
    for (const [, list] of perPool) {
      factsToAudit.push(...list.slice(0, samplePerPool));
    }
  } else {
    factsToAudit = deck.facts;
  }

  // Fresh confusion matrix per deck
  const confusionMatrix = new ConfusionMatrix();

  // Confusion test mode: seed some confusions first
  let confusionPairs: ConfusionPair[] = [];
  const confusedFactMap = new Map<string, string>(); // factA.id -> factB.id

  if (opts.confusionTestMode) {
    confusionPairs = findConfusionTestPairs(deck);
    for (const pair of confusionPairs) {
      // Record 3 confusions so it's above threshold
      confusionMatrix.recordConfusion(pair.factA.id, pair.factB.id);
      confusionMatrix.recordConfusion(pair.factA.id, pair.factB.id);
      confusionMatrix.recordConfusion(pair.factA.id, pair.factB.id);
      confusedFactMap.set(pair.factA.id, pair.factB.id);
    }
  }

  for (const fact of factsToAudit) {
    // Skip image facts — they have separate quiz paths
    if (fact.quizMode === 'image_question' || fact.quizMode === 'image_answers') continue;

    for (const masteryLevel of masteryLevels) {
      const confusedFactId = confusedFactMap.get(fact.id);
      const result = auditFactWithEngine(fact, deck, masteryLevel, confusionMatrix, {
        confusionTestMode: opts.confusionTestMode,
        confusedFactId,
      });
      factResults.push(result);

      for (const issue of result.issues) {
        if (!issuesByType[issue.type]) issuesByType[issue.type] = { fail: 0, warn: 0 };
        if (issue.severity === 'FAIL') issuesByType[issue.type].fail++;
        else issuesByType[issue.type].warn++;
      }
    }
  }

  const failCount = factResults.reduce((s, r) => s + r.issues.filter(i => i.severity === 'FAIL').length, 0);
  const warnCount = factResults.reduce((s, r) => s + r.issues.filter(i => i.severity === 'WARN').length, 0);

  // Confusion test summary
  let confusionTestResults: DeckAuditResult['confusionTestResults'];
  if (opts.confusionTestMode) {
    const confusionIssues = factResults
      .flatMap(r => r.issues.filter(i => i.type === 'confusion_not_responsive'))
      .map(i => i.detail);
    confusionTestResults = {
      pairsChecked: confusionPairs.length,
      failures: confusionIssues.length,
      details: confusionIssues,
    };
  }

  return {
    deckId: deck.id,
    deckName: deck.name,
    deckClass,
    totalFacts: deck.facts.length,
    totalChecks: factResults.length,
    failCount,
    warnCount,
    issuesByType,
    factResults,
    confusionTestResults,
  };
}

// ---------------------------------------------------------------------------
// ANSI output helpers
// ---------------------------------------------------------------------------

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function rpad(s: string, n: number): string {
  const str = String(s);
  return ' '.repeat(Math.max(0, n - str.length)) + str;
}

function printVerboseResult(result: FactAuditResult): void {
  const failIssues = result.issues.filter(i => i.severity === 'FAIL');
  const warnIssues = result.issues.filter(i => i.severity === 'WARN');

  if (failIssues.length === 0 && warnIssues.length === 0) return;

  console.log(`\n  ${DIM}[M=${result.masteryLevel}, pool: ${result.poolId}]${RESET} Q: "${result.renderedQuestion.slice(0, 80)}${result.renderedQuestion.length > 80 ? '...' : ''}"`);
  console.log(`    ${GREEN}✓ ${result.correctAnswer}${RESET}`);
  for (const d of result.distractors) {
    console.log(`    ${DIM}✗ ${d.answer} ${DIM}(${d.source})${RESET}`);
  }
  for (const issue of failIssues) {
    console.log(`    ${RED}FAIL: ${issue.type}${RESET} — ${issue.detail}`);
  }
  for (const issue of warnIssues) {
    console.log(`    ${YELLOW}WARN: ${issue.type}${RESET} — ${issue.detail}`);
  }
}

function printAllVerboseResults(result: FactAuditResult): void {
  console.log(`\n  ${DIM}[M=${result.masteryLevel}, pool: ${result.poolId}]${RESET} Q: "${result.renderedQuestion.slice(0, 80)}${result.renderedQuestion.length > 80 ? '...' : ''}"`);
  console.log(`    ${GREEN}✓ ${result.correctAnswer}${RESET}`);
  for (const d of result.distractors) {
    console.log(`    ${DIM}✗ ${d.answer} ${DIM}(${d.source})${RESET}`);
  }
  if (result.issues.length === 0) {
    console.log(`    ${DIM}(no issues)${RESET}`);
  }
  for (const issue of result.issues) {
    const color = issue.severity === 'FAIL' ? RED : YELLOW;
    console.log(`    ${color}${issue.severity}: ${issue.type}${RESET} — ${issue.detail}`);
  }
}

function printDeckLine(result: DeckAuditResult): void {
  const icon = result.failCount > 0 ? `${RED}✗${RESET}` : result.warnCount > 0 ? `${YELLOW}~${RESET}` : `${GREEN}✓${RESET}`;
  const levelsPerFact = result.totalFacts > 0 ? Math.round(result.totalChecks / result.totalFacts) : 0;  console.log(`${icon} ${BOLD}${result.deckName}${RESET} (${result.deckId}) — ${result.totalFacts} facts × ${levelsPerFact} levels = ${result.totalChecks} checks | ${result.failCount > 0 ? `${RED}${result.failCount} fails${RESET}` : '0 fails'} ${result.warnCount > 0 ? `${YELLOW}${result.warnCount} warns${RESET}` : '0 warns'}`);
}

function printReport(
  deckResults: DeckAuditResult[],
  masteryLevels: number[],
  opts: CliOptions,
): void {
  console.log(`\n${BOLD}Real-Engine Quiz Audit (mastery levels: ${masteryLevels.join(', ')})${RESET}`);
  const modeLabel = opts.stratified !== null ? `stratified ${opts.stratified} facts` : opts.sample !== null ? `sample ${opts.sample}/pool` : 'full';
  console.log(`Auditing ${deckResults.length} decks (mode: ${modeLabel})\n`);

  for (const result of deckResults) {
    printDeckLine(result);

    if (opts.verbose) {
      for (const fr of result.factResults) {
        printAllVerboseResults(fr);
      }
    } else {
      // Show only results with issues
      for (const fr of result.factResults) {
        if (fr.issues.length > 0) {
          printVerboseResult(fr);
        }
      }
    }

    if (opts.confusionTest && result.confusionTestResults) {
      const ct = result.confusionTestResults;
      const icon = ct.failures > 0 ? `${RED}✗${RESET}` : `${GREEN}✓${RESET}`;
      console.log(`  ${icon} Confusion test: ${ct.pairsChecked} pairs | ${ct.failures} failures`);
      for (const d of ct.details) {
        console.log(`    ${RED}FAIL${RESET}: ${d}`);
      }
    }
  }

  // Summary table
  const totalFails = deckResults.reduce((s, r) => s + r.failCount, 0);
  const totalWarns = deckResults.reduce((s, r) => s + r.warnCount, 0);
  const totalChecks = deckResults.reduce((s, r) => s + r.totalChecks, 0);

  console.log(`\n${BOLD}${'═'.repeat(68)}${RESET}`);
  console.log(`${BOLD}${pad('Deck', 35)} ${rpad('Facts', 6)} ${rpad('Checks', 7)} ${rpad('Fails', 6)} ${rpad('Warns', 5)}${RESET}`);
  console.log(`${'─'.repeat(68)}`);
  for (const r of deckResults) {
    const failStr = r.failCount > 0 ? `${RED}${rpad(String(r.failCount), 6)}${RESET}` : rpad('0', 6);
    const warnStr = r.warnCount > 0 ? `${YELLOW}${rpad(String(r.warnCount), 5)}${RESET}` : rpad('0', 5);
    console.log(`${pad(r.deckName, 35)} ${rpad(String(r.totalFacts), 6)} ${rpad(String(r.totalChecks), 7)} ${failStr} ${warnStr}`);
  }
  console.log(`${'─'.repeat(68)}`);
  const totalFailStr = totalFails > 0 ? `${RED}${rpad(String(totalFails), 6)}${RESET}` : rpad('0', 6);
  const totalWarnStr = totalWarns > 0 ? `${YELLOW}${rpad(String(totalWarns), 5)}${RESET}` : rpad('0', 5);
  console.log(`${pad('TOTAL', 35)} ${rpad('', 6)} ${rpad(String(totalChecks), 7)} ${totalFailStr} ${totalWarnStr}`);

  // Check type breakdown
  const allIssuesByType: Record<string, { fail: number; warn: number }> = {};
  for (const r of deckResults) {
    for (const [type, counts] of Object.entries(r.issuesByType)) {
      if (!allIssuesByType[type]) allIssuesByType[type] = { fail: 0, warn: 0 };
      allIssuesByType[type].fail += counts.fail;
      allIssuesByType[type].warn += counts.warn;
    }
  }

  if (Object.keys(allIssuesByType).length > 0) {
    console.log(`\n${BOLD}Check Type Breakdown:${RESET}`);
    for (const [type, counts] of Object.entries(allIssuesByType).sort((a, b) => (b[1].fail + b[1].warn) - (a[1].fail + a[1].warn))) {
      const parts: string[] = [];
      if (counts.fail > 0) parts.push(`${RED}${counts.fail} FAIL${RESET}`);
      if (counts.warn > 0) parts.push(`${YELLOW}${counts.warn} WARN${RESET}`);
      console.log(`  ${CYAN}${type}${RESET}: ${parts.join(', ')}`);
    }
  }

  console.log('');
  if (totalFails === 0 && totalWarns === 0) {
    console.log(`${GREEN}${BOLD}ALL CLEAN — 0 failures, 0 warnings${RESET}`);
  } else if (totalFails === 0) {
    console.log(`${YELLOW}${BOLD}0 failures, ${totalWarns} warnings${RESET}`);
  } else {
    console.log(`${RED}${BOLD}${totalFails} failures, ${totalWarns} warnings${RESET}`);
  }
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

interface JsonOutput {
  timestamp: string;
  mode: string;
  masteryLevels: number[];
  deckCount: number;
  totalChecks: number;
  totalFails: number;
  totalWarns: number;
  decks: DeckAuditResult[];
}

function buildJsonOutput(
  deckResults: DeckAuditResult[],
  masteryLevels: number[],
  opts: CliOptions,
): JsonOutput {
  return {
    timestamp: new Date().toISOString(),
    mode: opts.stratified !== null ? `stratified:${opts.stratified}` : opts.sample !== null ? `sample:${opts.sample}` : 'full',
    masteryLevels,
    deckCount: deckResults.length,
    totalChecks: deckResults.reduce((s, r) => s + r.totalChecks, 0),
    totalFails: deckResults.reduce((s, r) => s + r.failCount, 0),
    totalWarns: deckResults.reduce((s, r) => s + r.warnCount, 0),
    decks: deckResults,
  };
}

// ---------------------------------------------------------------------------
// Render mode — human-readable quiz output for LLM content review
// ---------------------------------------------------------------------------

/** Extended deck type that includes the optional subDecks array present in JSON. */
interface DeckWithSubDecks extends CuratedDeck {
  subDecks?: Array<{ id: string; name: string; factIds: string[] }>;
}

/**
 * Look up the subDeck name for a fact by matching its ID against subDeck.factIds.
 * Returns the subDeck name, or null if no subDecks defined or no match found.
 */
function getSubDeckLabel(fact: DeckFact, deck: DeckWithSubDecks): string | null {
  if (!deck.subDecks || deck.subDecks.length === 0) return null;
  for (const sd of deck.subDecks) {
    if (sd.factIds && sd.factIds.includes(fact.id)) return sd.name;
  }
  return null;
}

/**
 * Render a single fact as a quiz question with shuffled answer options.
 * Uses a seeded RNG based on the fact ID so output is reproducible.
 * Options are labelled A–D (or A–E for mastery-4 five-option quizzes).
 */
function renderFactAsQuiz(
  fact: DeckFact,
  deck: CuratedDeck,
  masteryLevel: number,
  questionIndex: number,
): string {
  const confusionMatrix = new ConfusionMatrix(); // empty — no history in render mode
  const seed = djb2(fact.id + '_render' + masteryLevel);

  const templateResult = selectQuestionTemplate(fact, deck, masteryLevel, [], seed);
  const { renderedQuestion, answerPoolId, correctAnswer } = templateResult;
  const correctDisplay = displayAnswer(correctAnswer);
  const requestedCount = getDistractorCount(masteryLevel);

  const isNumerical = isNumericalAnswer(fact.correctAnswer);
  let distractorDisplays: string[] = [];
  let distractorSources: string[] = [];

  if (isNumerical) {
    const factAdapter = { id: fact.id, correctAnswer: fact.correctAnswer } as unknown as Fact;
    const numericalDistractors = getNumericalDistractors(factAdapter, requestedCount);
    distractorDisplays = numericalDistractors.map(d => displayAnswer(d));
    distractorSources = numericalDistractors.map(() => 'numerical');
  } else {
    const pool = deck.answerTypePools.find(p => p.id === answerPoolId);
    if (pool) {
      const result = selectDistractors(
        fact,
        pool,
        deck.facts,
        deck.synonymGroups,
        confusionMatrix,
        null,
        requestedCount,
        masteryLevel,
        templateResult.distractorAnswerField,
      );
      distractorDisplays = result.distractors.map(d => displayAnswer(d.correctAnswer));
      distractorSources = result.sources;
    }
  }

  // Build shuffled options array: [{ text, isCorrect }]
  const options: Array<{ text: string; isCorrect: boolean; source: string }> = [
    { text: correctDisplay, isCorrect: true, source: 'correct' },
    ...distractorDisplays.map((d, i) => ({ text: d, isCorrect: false, source: distractorSources[i] ?? 'unknown' })),
  ];

  // Shuffle using a seeded RNG based on factId — correct answer position varies
  const shuffleSeed = djb2(fact.id + '_shuffle');
  seededShuffle(options, shuffleSeed);

  const labels = ['A', 'B', 'C', 'D', 'E'];
  const lines: string[] = [];

  // Question line
  const tags: string[] = [];
  if (isNumerical) tags.push('[NUMERICAL]');
  const hasFallback = distractorSources.some(s => s === 'fallback' || s.startsWith('fallback'));
  if (hasFallback) tags.push('[FALLBACK DISTRACTORS]');
  const tagSuffix = tags.length > 0 ? `  ${tags.join(' ')}` : '';
  lines.push(`[Q${questionIndex}] ${renderedQuestion}${tagSuffix}`);

  // Option lines
  for (let i = 0; i < options.length; i++) {
    const label = labels[i] ?? String(i + 1);
    const opt = options[i];
    const mark = opt.isCorrect ? '  ✓' : '';
    lines.push(`  ${label}) ${opt.text}${mark}`);
  }

  // Metadata line
  const sourceSummary = distractorSources.join(', ');
  lines.push(`  [Mastery: ${masteryLevel} | Difficulty: ${fact.difficulty} | Sources: ${sourceSummary}]`);

  return lines.join('\n');
}

/**
 * Render mode entry point. Samples N facts per pool for each deck and outputs
 * human-readable quiz text suitable for LLM content review.
 */
function renderMode(opts: CliOptions): void {
  // Determine which decks to render
  let deckIds: string[];
  if (opts.deckId) {
    deckIds = [opts.deckId];
  } else {
    deckIds = getAllDeckIds().filter(id => {
      if (id.startsWith('_')) return false;
      const cls = classifyDeck(id);
      if (cls === 'image') return false;
      if (cls === 'vocab' && !opts.includeVocab) return false;
      return true;
    });
  }

  const MASTERY_OPTIONS = [0, 2, 4];

  for (const deckId of deckIds) {
    let deck: DeckWithSubDecks;
    try {
      deck = loadDeck(deckId) as DeckWithSubDecks;
    } catch (_e) {
      console.error(`Skipping ${deckId} — load failed`);
      continue;
    }

    console.log(`\n=== DECK: ${deck.name} (${deck.id}) ===`);

    // Group facts by pool
    const factsByPool = new Map<string, DeckFact[]>();
    for (const fact of deck.facts) {
      if (fact.quizMode === 'image_question' || fact.quizMode === 'image_answers') continue;
      const list = factsByPool.get(fact.answerTypePoolId) ?? [];
      list.push(fact);
      factsByPool.set(fact.answerTypePoolId, list);
    }

    for (const pool of deck.answerTypePools) {
      const poolFacts = factsByPool.get(pool.id);
      if (!poolFacts || poolFacts.length === 0) continue;

      // Determine subdeck label from first fact in pool (most facts in a pool share a subdeck)
      const subDeckLabel = getSubDeckLabel(poolFacts[0], deck);
      const subDeckSuffix = subDeckLabel ? ` | SubDeck: ${subDeckLabel}` : '';

      console.log(`--- Pool: ${pool.id} (${poolFacts.length} members)${subDeckSuffix} ---`);

      // Sample facts using a seeded RNG (different seed from programmatic mode)
      const sampleSeed = djb2(pool.id + '_render');
      const shuffled = seededShuffle([...poolFacts], sampleSeed);
      const sampled = shuffled.slice(0, opts.renderPerPool);

      let questionIndex = 1;
      for (const fact of sampled) {
        // Pick one random mastery level per fact using a seeded RNG
        const masteryRng = makeRng(djb2(fact.id + '_mastery_pick'));
        const masteryLevel = MASTERY_OPTIONS[Math.floor(masteryRng() * MASTERY_OPTIONS.length)];

        const rendered = renderFactAsQuiz(fact, deck, masteryLevel, questionIndex);
        console.log('');
        console.log(rendered);
        questionIndex++;
      }

      console.log('');
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const opts = parseArgs();

  // Dispatch to render mode when --render flag is present
  if (opts.renderMode) {
    renderMode(opts);
    return;
  }

  // Determine which decks to audit
  let deckIds: string[];
  if (opts.deckId) {
    deckIds = [opts.deckId];
  } else {
    deckIds = getAllDeckIds().filter(id => {
      if (id.startsWith('_')) return false; // skip _wip etc
      const cls = classifyDeck(id);
      if (cls === 'image') return false;
      if (cls === 'vocab' && !opts.includeVocab) return false;
      return true;
    });
  }

  const deckResults: DeckAuditResult[] = [];

  for (const deckId of deckIds) {
    let deck: CuratedDeck;
    try {
      deck = loadDeck(deckId);
    } catch (_e) {
      console.error(`Skipping ${deckId} — load failed`);
      continue;
    }

    const cls = classifyDeck(deckId);
    if (cls === 'image') continue;

    const result = auditDeck(deck, opts.masteryLevels, opts.sample, {
      verbose: opts.verbose,
      confusionTestMode: opts.confusionTest,
      minPoolFacts: opts.minPoolFacts,
    }, opts.stratified);
    deckResults.push(result);
  }

  if (opts.jsonOutput) {
    const output = buildJsonOutput(deckResults, opts.masteryLevels, opts);
    console.log(JSON.stringify(output, null, 2));
  } else {
    printReport(deckResults, opts.masteryLevels, opts);
  }

  const totalFails = deckResults.reduce((s, r) => s + r.failCount, 0);
  process.exit(totalFails > 0 ? 1 : 0);
}

main();
