import type { DeckFact, AnswerTypePool, SynonymGroup } from '../data/curatedDeckTypes';
import type { ConfusionMatrix } from './confusionMatrix';
import type { InRunFactTracker } from './inRunFactTracker';

export interface DistractorSelectionResult {
  distractors: DeckFact[];
  /** Source of each distractor (parallel array with distractors) */
  sources: ('confusion' | 'reverse_confusion' | 'in_run_struggle' | 'similar_difficulty' | 'pool_fill')[];
}

/**
 * Get the number of distractors for a given card mastery level (§4.5).
 */
export function getDistractorCount(cardMasteryLevel: number): number {
  if (cardMasteryLevel <= 0) return 2;
  if (cardMasteryLevel <= 2) return 3;
  return 4;  // mastery 3-5
}

/**
 * Select distractors from the deck's answer type pool, weighted by confusion matrix.
 *
 * Priority order (§4.4):
 * 1. Synonym group exclusion (MANDATORY — checked first)
 * 2. Known confusions (from confusion matrix)
 * 3. In-run struggles (from in-run FSRS)
 * 4. Same pool, similar difficulty (±1)
 * 5. Same pool, any difficulty (fill remaining)
 *
 * Falls back to the fact's pre-generated distractors[] if pool is too small.
 */
export function selectDistractors(
  correctFact: DeckFact,
  answerPool: AnswerTypePool,
  allDeckFacts: DeckFact[],
  synonymGroups: SynonymGroup[],
  confusionMatrix: ConfusionMatrix,
  inRunTracker: InRunFactTracker,
  count: number,
  cardMasteryLevel: number,
): DistractorSelectionResult {
  // Step 0: Build synonym exclusion set (MANDATORY)
  const synonymExcludeIds = new Set<string>();
  synonymExcludeIds.add(correctFact.id);  // Always exclude the correct fact itself

  if (correctFact.synonymGroupId) {
    const group = synonymGroups.find(g => g.id === correctFact.synonymGroupId);
    if (group) {
      for (const id of group.factIds) {
        synonymExcludeIds.add(id);
      }
    }
  }

  // Build a lookup map for facts by ID
  const factById = new Map<string, DeckFact>();
  for (const f of allDeckFacts) {
    factById.set(f.id, f);
  }

  // Score all candidate facts in the answer pool
  interface ScoredCandidate {
    factId: string;
    score: number;
    source: DistractorSelectionResult['sources'][number];
  }

  const candidates: ScoredCandidate[] = [];

  for (const factId of answerPool.factIds) {
    if (synonymExcludeIds.has(factId)) continue;

    const candidateFact = factById.get(factId);
    if (!candidateFact) continue;

    let score = 1.0;
    let source: ScoredCandidate['source'] = 'pool_fill';

    // Known confusion — highest priority
    const confusions = confusionMatrix.getConfusionsFor(correctFact.id);
    const directConfusion = confusions.find(c => c.confusedFactId === factId);
    if (directConfusion) {
      score += 10.0 * directConfusion.count;
      source = 'confusion';
    }

    // Reverse confusion
    const reverseConfusions = confusionMatrix.getReverseConfusionsFor(correctFact.id);
    const reverseConfusion = reverseConfusions.find(c => c.targetFactId === factId);
    if (reverseConfusion) {
      score += 5.0 * reverseConfusion.count;
      if (source === 'pool_fill') source = 'reverse_confusion';
    }

    // In-run struggle
    const runState = inRunTracker.getState(factId);
    if (runState && runState.wrongCount > 0) {
      score += 3.0;
      if (source === 'pool_fill') source = 'in_run_struggle';
    }

    // Similar difficulty band (±1)
    const diffDelta = Math.abs(correctFact.difficulty - candidateFact.difficulty);
    if (diffDelta <= 1) {
      score += 2.0;
      if (source === 'pool_fill') source = 'similar_difficulty';
    }

    // At higher card mastery, strongly prefer confusable distractors
    if (cardMasteryLevel >= 3) {
      score *= 1.5;
    }

    candidates.push({ factId, score, source });
  }

  // Sort by score descending, then deduplicate by correctAnswer before slicing to count
  candidates.sort((a, b) => b.score - a.score);

  // Deduplicate: skip candidates whose correctAnswer matches one already selected
  // or matches the quiz's correct answer (prevent correct answer appearing as its own distractor)
  const selected: ScoredCandidate[] = [];
  const seenAnswers = new Set<string>();
  seenAnswers.add(correctFact.correctAnswer.toLowerCase()); // Never show correct answer as distractor

  for (const c of candidates) {
    if (selected.length >= count) break;
    const candidateFact = factById.get(c.factId);
    if (!candidateFact) continue;
    const answerKey = candidateFact.correctAnswer.toLowerCase();
    if (seenAnswers.has(answerKey)) continue;
    seenAnswers.add(answerKey);
    selected.push(c);
  }

  const distractors: DeckFact[] = [];
  const sources: DistractorSelectionResult['sources'] = [];

  for (const c of selected) {
    const fact = factById.get(c.factId);
    if (fact) {
      distractors.push(fact);
      sources.push(c.source);
    }
  }

  // Fallback: if we didn't get enough distractors from the pool,
  // use the fact's pre-generated distractors[] array
  if (distractors.length < count && correctFact.distractors.length > 0) {
    const existingAnswers = new Set([
      correctFact.correctAnswer.toLowerCase(),
      ...distractors.map(d => d.correctAnswer.toLowerCase()),
    ]);

    for (const fallback of correctFact.distractors) {
      if (distractors.length >= count) break;
      if (!existingAnswers.has(fallback.toLowerCase())) {
        // Create a synthetic DeckFact for the fallback distractor
        distractors.push({
          id: `_fallback_${fallback}`,
          correctAnswer: fallback,
          acceptableAlternatives: [],
          chainThemeId: 0,
          answerTypePoolId: correctFact.answerTypePoolId,
          difficulty: correctFact.difficulty,
          funScore: 1,
          quizQuestion: '',
          explanation: '',
          visualDescription: '',
          sourceName: '',
          distractors: [],
        });
        sources.push('pool_fill');
        existingAnswers.add(fallback.toLowerCase());
      }
    }
  }

  return { distractors, sources };
}
