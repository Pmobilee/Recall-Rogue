/**
 * Real-Engine Quiz Audit Script
 *
 * Imports and exercises the REAL game engine quiz functions against all curated
 * deck JSON files. Detects 24 categories of quiz quality issues including
 * engine-enabled checks that the static quiz-audit.mjs cannot perform.
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/quiz-audit-engine.ts [options]
 *
 * Options:
 *   --deck <id>          Single deck (default: all non-image decks)
 *   --sample <N>         Max facts per pool (default: all)
 *   --mastery 0,2,4      Comma-separated mastery levels (default: 0,2,4)
 *   --verbose            Show every fact's quiz presentation
 *   --json               JSON output to stdout
 *   --include-vocab      Include vocab/language decks (default: knowledge only)
 *   --confusion-test     Seed synthetic confusions to verify confusion matrix path
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
  const clean = answer.replace(/[{}]/g, '').trim();
  const match = clean.match(/[\d,.]+\s+(.+)$/);
  return match ? match[1].toLowerCase().trim() : null;
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
    }
  }

  return { deckId, sample, masteryLevels, verbose, jsonOutput, includeVocab, confusionTest };
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

  // Check 4: length_mismatch (skip numerical)
  if (!isNumerical && distractorFacts.length > 0) {
    const distractorDisplays = distractorFacts.map(d => displayAnswer(d.correctAnswer));
    const avgDistractorLen = distractorDisplays.reduce((s, d) => s + d.length, 0) / distractorDisplays.length;
    if (avgDistractorLen > 0) {
      const ratio = correctDisplay.length / avgDistractorLen;
      if (ratio > 3 || ratio < (1 / 3)) {
        issues.push({ severity: 'FAIL', type: 'length_mismatch', detail: `Correct length ${correctDisplay.length} vs avg distractor ${avgDistractorLen.toFixed(1)} — ratio ${ratio.toFixed(2)}×` });
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
  if (templateId !== '_fallback' && renderedQuestion === fact.quizQuestion) {
    // A real template was selected but rendered question matches raw quizQuestion — fallback occurred
    issues.push({ severity: 'WARN', type: 'template_rendering_fallback', detail: `Template "${templateId}" fell back to fact.quizQuestion — likely empty placeholder` });
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
  opts: { verbose: boolean; confusionTestMode: boolean },
): DeckAuditResult {
  const deckClass = classifyDeck(deck.id);
  const factResults: FactAuditResult[] = [];
  const issuesByType: Record<string, { fail: number; warn: number }> = {};

  // Determine facts to audit (optionally sampled per pool)
  let factsToAudit: DeckFact[];
  if (samplePerPool !== null) {
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
  const name = pad(result.deckName, 35);
  const checks = `${result.totalFacts} facts × ${result.factResults.length / result.totalFacts || 0}... = ${result.totalChecks} checks`;
  const failStr = result.failCount > 0 ? `${RED}${result.failCount} fails${RESET}` : `0 fails`;
  const warnStr = result.warnCount > 0 ? `${YELLOW}${result.warnCount} warns${RESET}` : `0 warns`;
  const levelsPerFact = result.totalFacts > 0 ? Math.round(result.totalChecks / result.totalFacts) : 0;  console.log(`${icon} ${BOLD}${result.deckName}${RESET} (${result.deckId}) — ${result.totalFacts} facts × ${levelsPerFact} levels = ${result.totalChecks} checks | ${failStr} ${warnStr}`);
}

function printReport(
  deckResults: DeckAuditResult[],
  masteryLevels: number[],
  opts: CliOptions,
): void {
  console.log(`\n${BOLD}Real-Engine Quiz Audit (mastery levels: ${masteryLevels.join(', ')})${RESET}`);
  console.log(`Auditing ${deckResults.length} decks (mode: ${opts.sample !== null ? `sample ${opts.sample}/pool` : 'full'})\n`);

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
    mode: opts.sample !== null ? `sample:${opts.sample}` : 'full',
    masteryLevels,
    deckCount: deckResults.length,
    totalChecks: deckResults.reduce((s, r) => s + r.totalChecks, 0),
    totalFails: deckResults.reduce((s, r) => s + r.failCount, 0),
    totalWarns: deckResults.reduce((s, r) => s + r.warnCount, 0),
    decks: deckResults,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const opts = parseArgs();

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
    });
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
