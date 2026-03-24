/**
 * Curated Deck Playtest Script
 *
 * Simulates N charges against a curated deck using REAL game code — no mocks.
 * Exercises: InRunFactTracker, curatedFactSelector, questionTemplateSelector,
 * curatedDistractorSelector, numericalDistractorService.
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/playtest-curated-deck.ts [deck_id] [options]
 *
 * Options:
 *   --charges N        Number of charges to simulate (default: 30)
 *   --wrong-rate 0.3   Probability of answering wrong (default: 0.0)
 *   --seed 42          Run seed for deterministic replay (default: random)
 *   --verbose          Show full question/answer/distractors every charge
 *   --learner          Simulate realistic human learning (overrides --wrong-rate).
 *                      Error rate scales with fact difficulty and drops 50% per repetition.
 */

// Browser shim must load FIRST before any src/ imports
import '../tests/playtest/headless/browser-shim.js';

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { InRunFactTracker } from '../src/services/inRunFactTracker';
import { selectFactForCharge } from '../src/services/curatedFactSelector';
import { selectQuestionTemplate } from '../src/services/questionTemplateSelector';
import {
  selectDistractors,
  getDistractorCount,
} from '../src/services/curatedDistractorSelector';
import {
  isNumericalAnswer,
  getNumericalDistractors,
  displayAnswer,
} from '../src/services/numericalDistractorService';
import { ConfusionMatrix } from '../src/services/confusionMatrix';
import type { CuratedDeck, DeckFact } from '../src/data/curatedDeckTypes';
import type { Fact } from '../src/data/types';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  deckId: string;
  charges: number;
  wrongRate: number;
  seed: number;
  verbose: boolean;
  learnerMode: boolean;
} {
  const args = process.argv.slice(2);
  let deckId = 'solar_system';
  let charges = 30;
  let wrongRate = 0.0;
  let seed = Math.floor(Math.random() * 999999);
  let verbose = false;
  let learnerMode = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--charges' && args[i + 1]) {
      charges = parseInt(args[++i], 10);
    } else if (arg === '--wrong-rate' && args[i + 1]) {
      wrongRate = parseFloat(args[++i]);
    } else if (arg === '--seed' && args[i + 1]) {
      seed = parseInt(args[++i], 10);
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (arg === '--learner') {
      learnerMode = true;
    } else if (!arg.startsWith('--')) {
      deckId = arg;
    }
  }

  return { deckId, charges, wrongRate, seed, verbose, learnerMode };
}

// ---------------------------------------------------------------------------
// Deck loader
// ---------------------------------------------------------------------------

function loadDeck(deckId: string): CuratedDeck {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const deckPath = resolve(__dirname, '..', 'data', 'decks', `${deckId}.json`);
  try {
    const raw = readFileSync(deckPath, 'utf-8');
    return JSON.parse(raw) as CuratedDeck;
  } catch (err) {
    console.error(`ERROR: Could not load deck "${deckId}" from ${deckPath}`);
    console.error(
      `Available decks: check data/decks/ for .json files (e.g. solar_system, test_world_capitals)`
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Seeded PRNG for wrong-rate decisions (separate from game seed)
// ---------------------------------------------------------------------------

function makeSimPrng(seed: number): () => number {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Selection label helper
// ---------------------------------------------------------------------------

function selectionLabel(reason: string): string {
  switch (reason) {
    case 'struggling':
      return 'LEARN  ';
    case 'unseen':
      return 'NEW    ';
    case 'moderate':
      return 'REVIEW ';
    case 'known':
      return 'KNOWN  ';
    case 'random':
      return 'RANDOM ';
    default:
      return reason.padEnd(7);
  }
}

// ---------------------------------------------------------------------------
// Main simulation
// ---------------------------------------------------------------------------

interface ChargeResult {
  chargeNum: number;
  fact: DeckFact;
  selectionReason: string;
  renderedQuestion: string;
  correctDisplay: string;
  distractors: string[];
  isNumerical: boolean;
  isCorrect: boolean;
  issues: string[];
  // Learner mode extras (undefined when not in learner mode)
  learnerEffectiveErrorRate?: number;
  learnerTimesSeen?: number;
  learnerPickedDistractor?: string | null;
}

function runSimulation(
  deck: CuratedDeck,
  totalCharges: number,
  wrongRate: number,
  runSeed: number,
  verbose: boolean,
  learnerMode: boolean
): ChargeResult[] {
  const tracker = new InRunFactTracker();
  const confusionMatrix = new ConfusionMatrix();
  const simRng = makeSimPrng(runSeed);
  const results: ChargeResult[] = [];

  for (let chargeNum = 1; chargeNum <= totalCharges; chargeNum++) {
    // 1. Select fact (Anki queue system)
    const { fact, selectionReason } = selectFactForCharge(
      deck.facts,
      tracker,
      0, // cardMasteryLevel
      runSeed
    );

    // 2. Select question template
    const recentTemplates = tracker.getRecentTemplateIds();
    const templateResult = selectQuestionTemplate(
      fact,
      deck,
      0, // cardMasteryLevel
      recentTemplates,
      runSeed
    );
    tracker.recordTemplateUsed(templateResult.template.id);

    const correctDisplay = displayAnswer(templateResult.correctAnswer);

    // 3. Get distractors
    let distractorTexts: string[];
    let isNumerical = false;

    if (isNumericalAnswer(fact.correctAnswer)) {
      // Cast DeckFact to Fact-compatible shape (only id and correctAnswer needed)
      const factAdapter = {
        id: fact.id,
        correctAnswer: fact.correctAnswer,
      } as unknown as Fact;
      distractorTexts = getNumericalDistractors(factAdapter, 3);
      isNumerical = true;
    } else {
      const pool = deck.answerTypePools.find(
        (p) => p.id === templateResult.answerPoolId
      );
      if (pool) {
        const { distractors } = selectDistractors(
          fact,
          pool,
          deck.facts,
          deck.synonymGroups,
          confusionMatrix,
          tracker,
          getDistractorCount(0),
          0 // cardMasteryLevel
        );
        distractorTexts = distractors.map((d) => d.correctAnswer);
      } else {
        // No matching pool — use fact's pre-generated distractors
        distractorTexts = fact.distractors.slice(0, 3);
      }
    }

    // 4. Filter distractors: remove any that match the correct answer (same as CardCombatOverlay)
    const cleanDistractors = distractorTexts.filter(
      (d) => d.toLowerCase() !== correctDisplay.toLowerCase()
    );

    // 5. Determine correct/wrong
    let isCorrect: boolean;
    let selectedWrongAnswer: string | null = null;
    let learnerEffectiveErrorRate: number | undefined;
    let learnerTimesSeen: number | undefined;

    if (learnerMode) {
      // How many times has the player seen this fact before this charge?
      const state = tracker.getState(fact.id);
      const timesSeen = state ? (state.correctCount + state.wrongCount) : 0;

      // Base error rate from difficulty: d1=10%, d2=25%, d3=40%, d4=55%, d5=70%
      const baseErrorRate = 0.1 + ((fact.difficulty ?? 3) - 1) * 0.15;

      // Each repetition halves the error rate (learning curve)
      const effectiveErrorRate = baseErrorRate * Math.pow(0.5, timesSeen);

      isCorrect = simRng() > effectiveErrorRate;

      // If wrong, pick a random distractor as the "selected wrong answer"
      if (!isCorrect && cleanDistractors.length > 0) {
        selectedWrongAnswer = cleanDistractors[Math.floor(simRng() * cleanDistractors.length)];
      }

      learnerEffectiveErrorRate = effectiveErrorRate;
      learnerTimesSeen = timesSeen;
    } else {
      isCorrect = simRng() > wrongRate;
    }

    // 6. Issue detection
    const issues: string[] = [];

    // Unresolved placeholders in question
    if (/\{\w+\}/.test(templateResult.renderedQuestion)) {
      issues.push(
        `UNRESOLVED PLACEHOLDER in question: "${templateResult.renderedQuestion}"`
      );
    }

    // Braces in displayed answer
    if (correctDisplay.includes('{') || correctDisplay.includes('}')) {
      issues.push(`BRACES IN ANSWER: "${correctDisplay}"`);
    }

    // Correct answer appearing in distractors (after filtering)
    if (
      cleanDistractors.some(
        (d) => d.toLowerCase() === correctDisplay.toLowerCase()
      )
    ) {
      issues.push(`ANSWER IN DISTRACTORS: "${correctDisplay}"`);
    }

    // Duplicate distractors
    if (
      new Set(cleanDistractors.map((d) => d.toLowerCase())).size <
      cleanDistractors.length
    ) {
      issues.push(`DUPLICATE DISTRACTORS: ${JSON.stringify(cleanDistractors)}`);
    }

    // Back-to-back same fact
    const previousFactId = results.length > 0 ? results[results.length - 1].fact.id : null;
    if (previousFactId !== null && fact.id === previousFactId) {
      issues.push(`BACK-TO-BACK REPEAT: ${fact.id}`);
    }

    // Fewer than 2 distractors
    if (cleanDistractors.length < 2) {
      issues.push(
        `TOO FEW DISTRACTORS: only ${cleanDistractors.length} (need ≥2)`
      );
    }

    // Empty question
    if (!templateResult.renderedQuestion.trim()) {
      issues.push('EMPTY QUESTION');
    }

    // Empty correct answer
    if (!correctDisplay.trim()) {
      issues.push('EMPTY CORRECT ANSWER');
    }

    results.push({
      chargeNum,
      fact,
      selectionReason,
      renderedQuestion: templateResult.renderedQuestion,
      correctDisplay,
      distractors: cleanDistractors,
      isNumerical,
      isCorrect,
      issues,
      learnerEffectiveErrorRate,
      learnerTimesSeen,
      learnerPickedDistractor: selectedWrongAnswer,
    });

    // 7. Record result into tracker
    // In learner mode, track which distractor was picked for confusion matrix
    let confusedFactId: string | undefined;
    if (selectedWrongAnswer && !isCorrect) {
      const confusedFact = deck.facts.find(
        (f) => f.correctAnswer.toLowerCase() === selectedWrongAnswer!.toLowerCase()
      );
      confusedFactId = confusedFact?.id;
      if (confusedFactId) {
        confusionMatrix.recordConfusion(fact.id, confusedFactId);
      }
    }

    tracker.recordResult(
      fact.id,
      isCorrect,
      2000, // simulated 2s response time
      tracker.getCurrentEncounter(),
      confusedFactId
    );
    tracker.recordCharge(fact.id, isCorrect);

    // Print per-charge output in verbose mode or when there are issues
    if (verbose || issues.length > 0) {
      const chargeTag = `#${String(chargeNum).padStart(2, ' ')}`;
      const label = selectionLabel(selectionReason);
      const numericalTag = isNumerical ? ' (bracket-generated)' : '';
      const distractorStr = cleanDistractors.join(', ');

      console.log(
        `  ${chargeTag} [${label}] "${templateResult.renderedQuestion}"`
      );
      console.log(
        `       Answer: ${correctDisplay} | Distractors: ${distractorStr}${numericalTag}`
      );

      if (learnerMode && learnerEffectiveErrorRate !== undefined && learnerTimesSeen !== undefined) {
        const errPct = Math.round(learnerEffectiveErrorRate * 100);
        const seenLabel = learnerTimesSeen === 1 ? '1 time' : `${learnerTimesSeen} times`;
        const diffLabel = `difficulty ${fact.difficulty ?? '?'}`;
        if (isCorrect) {
          console.log(`       ✓ Correct [${diffLabel}, error rate ${errPct}%, seen ${seenLabel}]`);
        } else {
          const pickedStr = selectedWrongAnswer ? `, picked: ${selectedWrongAnswer}` : '';
          console.log(`       ✗ Wrong [${diffLabel}, error rate ${errPct}%, seen ${seenLabel}${pickedStr}]`);
        }
      } else {
        const result = isCorrect ? '✓ Correct' : '✗ Wrong';
        console.log(`       ${result}`);
      }

      for (const issue of issues) {
        console.log(`       !! ISSUE: ${issue}`);
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Summary report
// ---------------------------------------------------------------------------

function printSummary(
  deck: CuratedDeck,
  results: ChargeResult[],
  totalCharges: number,
  wrongRate: number,
  runSeed: number,
  learnerMode: boolean
): void {
  const uniqueFacts = new Set(results.map((r) => r.fact.id));
  const newIntros = results.filter((r) => r.selectionReason === 'unseen').length;
  const learningHits = results.filter(
    (r) => r.selectionReason === 'struggling'
  ).length;
  const reviewHits = results.filter(
    (r) => r.selectionReason === 'moderate'
  ).length;
  const backToBack = results.filter((r) =>
    r.issues.some((i) => i.startsWith('BACK-TO-BACK'))
  ).length;

  const allIssues: Array<{ chargeNum: number; issue: string }> = [];
  for (const r of results) {
    for (const issue of r.issues) {
      allIssues.push({ chargeNum: r.chargeNum, issue });
    }
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`${totalCharges} charges simulated`);
  console.log(`Deck: ${deck.name} (${deck.facts.length} facts total)`);
  if (learnerMode) {
    console.log(`Mode: Learner (realistic human learning curve) | Seed: ${runSeed}`);
  } else {
    const wrongPct = Math.round(wrongRate * 100);
    console.log(`Wrong rate: ${wrongPct}% | Seed: ${runSeed}`);
  }
  console.log(`Unique facts seen: ${uniqueFacts.size}`);
  console.log(`New card introductions: ${newIntros}`);
  console.log(`Learning queue hits: ${learningHits}`);
  console.log(`Review queue hits: ${reviewHits}`);
  console.log(`Back-to-back repeats: ${backToBack}`);

  // Learner stats block
  if (learnerMode) {
    const totalCorrect = results.filter((r) => r.isCorrect).length;
    const totalPct = Math.round((totalCorrect / results.length) * 100);

    // Easy = d1-2, Medium = d3, Hard = d4-5
    const easyResults = results.filter((r) => (r.fact.difficulty ?? 3) <= 2);
    const hardResults = results.filter((r) => (r.fact.difficulty ?? 3) >= 4);
    const easyAcc = easyResults.length > 0
      ? Math.round((easyResults.filter((r) => r.isCorrect).length / easyResults.length) * 100)
      : null;
    const hardAcc = hardResults.length > 0
      ? Math.round((hardResults.filter((r) => r.isCorrect).length / hardResults.length) * 100)
      : null;

    // Average error rate on first sight vs last sight
    const firstSightResults = results.filter((r) => r.learnerTimesSeen === 0);
    const repeatResults = results.filter((r) => (r.learnerTimesSeen ?? 0) > 0);
    const avgFirstErr = firstSightResults.length > 0
      ? Math.round(
          (firstSightResults.reduce((s, r) => s + (r.learnerEffectiveErrorRate ?? 0), 0) /
            firstSightResults.length) * 100
        )
      : null;
    const avgRepeatErr = repeatResults.length > 0
      ? Math.round(
          (repeatResults.reduce((s, r) => s + (r.learnerEffectiveErrorRate ?? 0), 0) /
            repeatResults.length) * 100
        )
      : null;

    console.log('');
    console.log('Learner stats:');
    console.log(`  Total correct: ${totalCorrect}/${results.length} (${totalPct}%)`);
    if (easyAcc !== null) console.log(`  Easy (d1-2) accuracy: ${easyAcc}%`);
    if (hardAcc !== null) console.log(`  Hard (d4-5) accuracy: ${hardAcc}%`);
    if (avgFirstErr !== null && avgRepeatErr !== null) {
      console.log(`  Improvement on repeats: ${avgFirstErr}% → ${avgRepeatErr}% avg error rate`);
    } else if (avgFirstErr !== null) {
      console.log(`  First-sight avg error rate: ${avgFirstErr}%`);
    }
  }

  console.log(`Issues found: ${allIssues.length}`);

  if (allIssues.length === 0) {
    console.log('ALL CLEAN');
  } else {
    console.log('');
    console.log('--- Issues ---');
    for (const { chargeNum, issue } of allIssues) {
      console.log(`  Charge #${chargeNum}: ${issue}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const { deckId, charges, wrongRate, seed, verbose, learnerMode } = parseArgs();
  const deck = loadDeck(deckId);

  console.log(`=== Curated Deck Playtest: ${deck.name} ===`);
  if (learnerMode) {
    console.log(`Charges: ${charges} | Mode: Learner | Seed: ${seed}`);
  } else {
    const wrongPct = Math.round(wrongRate * 100);
    console.log(`Charges: ${charges} | Wrong rate: ${wrongPct}% | Seed: ${seed}`);
  }
  if (verbose) {
    console.log('');
  }

  const results = runSimulation(deck, charges, wrongRate, seed, verbose, learnerMode);

  printSummary(deck, results, charges, wrongRate, seed, learnerMode);

  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  process.exit(totalIssues > 0 ? 1 : 0);
}

main();
