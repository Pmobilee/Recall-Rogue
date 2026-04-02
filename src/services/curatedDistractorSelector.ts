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
 *
 * @param cardMasteryLevel - The card's current mastery level (0–5).
 * @param meditatedThemeId - Optional: if set, and factThemeId matches, reduce count by 1 (min 2).
 * @param factThemeId - Optional: the chainThemeId of the fact being quizzed.
 */
export function getDistractorCount(
  cardMasteryLevel: number,
  meditatedThemeId?: number,
  factThemeId?: number,
): number {
  let count: number;
  if (cardMasteryLevel <= 0) count = 2;
  else if (cardMasteryLevel <= 2) count = 3;
  else count = 4;  // mastery 3-5

  // AR-273: Meditation Chamber bonus — reduce distractor count by 1 for the meditated theme.
  if (
    meditatedThemeId !== undefined &&
    factThemeId !== undefined &&
    meditatedThemeId === factThemeId
  ) {
    count = Math.max(2, count - 1);
  }

  return count;
}

/**
 * Build a minimal pseudo-DeckFact for a synthetic distractor string.
 * Synthetic members are pool values that aren't any fact's correctAnswer —
 * they pad small pools to avoid falling back to pre-generated distractors.
 */
function makeSyntheticFact(synAnswer: string, answerTypePoolId: string): DeckFact {
  return {
    id: `_synthetic_${synAnswer}`,
    correctAnswer: synAnswer,
    acceptableAlternatives: [],
    chainThemeId: 0,
    answerTypePoolId,
    difficulty: 3,
    funScore: 1,
    quizQuestion: '',
    explanation: '',
    visualDescription: '',
    sourceName: '',
    distractors: [],
  };
}

/**
 * Extract the measurement unit from an answer string.
 * Returns the unit suffix (e.g., "metres", "tonnes", "years") or null if no unit found.
 *
 * This is used by selectDistractors to prevent cross-unit contamination in broad
 * measurement pools — e.g., "52,800 tonnes" appearing as a distractor for "10 metres".
 */
function extractUnit(answer: string): string | null {
  // Normalize: strip brackets, trim
  const clean = answer.replace(/[{}]/g, '').trim();
  // Match: number (with optional commas/decimals) followed by unit word(s)
  // e.g., "10 metres" → "metres", "52,800 tonnes" → "tonnes", "120 years" → "years"
  const match = clean.match(/[\d,.]+\s+(.+)$/);
  if (match) {
    return match[1].toLowerCase().trim();
  }
  return null;
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
 * 6. Synthetic pool members (pool_fill, lower base score than real facts)
 *
 * Falls back to the fact's pre-generated distractors[] if pool is too small
 * even after counting synthetic members.
 *
 * @param inRunTracker - In-run fact tracker, or null when called from trivia mode (no active run).
 */
export function selectDistractors(
  correctFact: DeckFact,
  answerPool: AnswerTypePool,
  allDeckFacts: DeckFact[],
  synonymGroups: SynonymGroup[],
  confusionMatrix: ConfusionMatrix,
  inRunTracker: InRunFactTracker | null,
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

  // Add synthetic pool members to the lookup map as pseudo-facts.
  // This allows the scoring loop and selection loop to treat them uniformly
  // with real facts without special-casing their IDs everywhere.
  if (answerPool.syntheticDistractors) {
    for (const synAnswer of answerPool.syntheticDistractors) {
      const synId = `_synthetic_${synAnswer}`;
      if (!factById.has(synId)) {
        factById.set(synId, makeSyntheticFact(synAnswer, answerPool.id));
      }
    }
  }

  // Early exit: if pool has too few unique answers for sensible distractors,
  // use the fact's pre-generated distractors[] directly.
  // A pool needs at least (count + 1) unique correctAnswer values to provide
  // `count` distractors after excluding the correct answer.
  const uniquePoolAnswers = new Set<string>();
  for (const factId of answerPool.factIds) {
    if (synonymExcludeIds.has(factId)) continue;
    const f = factById.get(factId);
    if (f) uniquePoolAnswers.add(f.correctAnswer.toLowerCase());
  }
  uniquePoolAnswers.delete(correctFact.correctAnswer.toLowerCase());

  // Count synthetic members toward pool viability.
  // They are valid distractors even though they have no quiz questions of their own.
  const syntheticCount = answerPool.syntheticDistractors?.length ?? 0;

  // Use pre-generated distractors when pool has fewer than 5 unique answers
  // (including synthetics). Pools this small produce nonsensical distractors
  // (e.g., "Kuiper Belt" as distractor for "In which direction do planets orbit?").
  // 5 is the minimum for meaningful pool-based selection.
  if (uniquePoolAnswers.size + syntheticCount < 5 && correctFact.distractors.length >= count) {
    // Pool too small — fall back to pre-generated distractors
    const fallbackDistractors: DeckFact[] = [];
    const fallbackSources: DistractorSelectionResult['sources'] = [];
    const seen = new Set<string>([correctFact.correctAnswer.toLowerCase()]);

    for (const d of correctFact.distractors) {
      if (fallbackDistractors.length >= count) break;
      if (seen.has(d.toLowerCase())) continue;
      seen.add(d.toLowerCase());
      fallbackDistractors.push({
        id: `_fallback_${d}`,
        correctAnswer: d,
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
      fallbackSources.push('pool_fill');
    }

    return { distractors: fallbackDistractors, sources: fallbackSources };
  }

  // Score all candidate facts in the answer pool
  interface ScoredCandidate {
    factId: string;
    score: number;
    source: DistractorSelectionResult['sources'][number];
  }

  const candidates: ScoredCandidate[] = [];

  // Pre-extract the correct answer's unit once, outside the candidate loop.
  // Only non-null when the correct answer is a measurement like "10 metres".
  const correctUnit = extractUnit(correctFact.correctAnswer);

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

    // In-run struggle — only available when an active run tracker is present
    const runState = inRunTracker?.getState(factId);
    if (runState && runState.wrongCount > 0) {
      score += 3.0;
      if (source === 'pool_fill') source = 'in_run_struggle';
    }

    // Part-of-speech match: strongly prefer same POS for vocabulary distractors.
    // "to eat" should have verb distractors like "to drink", not noun distractors like "cat".
    if (correctFact.partOfSpeech && candidateFact.partOfSpeech) {
      if (candidateFact.partOfSpeech === correctFact.partOfSpeech) {
        score += 4.0;  // Strong boost for same POS
      } else {
        score *= 0.3;  // Heavy penalty for different POS
      }
    }

    // Unit matching: boost candidates that share the same measurement unit/format.
    // This prevents "52,800 tonnes" from appearing as a distractor for a "10 metres" answer
    // in broad measurement pools that mix heights, weights, counts, durations, etc.
    if (correctUnit) {
      const candidateUnit = extractUnit(candidateFact.correctAnswer);
      if (candidateUnit === correctUnit) {
        score += 5.0;  // Strong boost for same unit
      } else if (candidateUnit && candidateUnit !== correctUnit) {
        score *= 0.1;  // Very heavy penalty for different unit
      }
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

  // Score synthetic pool members as low-priority candidates (base score 0.5).
  // Lower than real pool members (1.0 base) so real facts are always preferred,
  // but they still beat the fallback path when the real pool is too small.
  if (answerPool.syntheticDistractors) {
    for (const synAnswer of answerPool.syntheticDistractors) {
      const synId = `_synthetic_${synAnswer}`;
      // Skip if this synthetic answer is identical to the correct answer
      if (synAnswer.toLowerCase() === correctFact.correctAnswer.toLowerCase()) continue;
      // Skip if the synthetic ID is in the synonym exclusion set (defensive)
      if (synonymExcludeIds.has(synId)) continue;

      // Apply unit matching to synthetic distractors as well.
      // A synthetic "100 tonnes" must not appear for a "10 metres" correct answer.
      let synScore = 0.5;
      if (correctUnit) {
        const synUnit = extractUnit(synAnswer);
        if (synUnit === correctUnit) {
          synScore += 5.0;  // Strong boost for same unit
        } else if (synUnit && synUnit !== correctUnit) {
          synScore *= 0.1;  // Very heavy penalty for different unit
        }
      }

      candidates.push({ factId: synId, score: synScore, source: 'pool_fill' });
    }
  }

  // Add jitter to break ties between equal-scored candidates.
  // Seeded by totalCharges so distractors vary between encounters
  // but are deterministic within a single charge.
  // Jitter range 0–0.5 ensures confusion data (+10.0) and in-run struggle (+3.0)
  // always outrank jittered pool-fill candidates (1.0 + 0.5 max).
  // Hash the fact ID for better per-fact variation (djb2)
  let idHash = 5381;
  for (let i = 0; i < correctFact.id.length; i++) {
    idHash = ((idHash << 5) + idHash) ^ correctFact.id.charCodeAt(i);
  }
  // Use 0 for totalCharges when no in-run tracker is available (trivia mode)
  const jitterSeed = ((inRunTracker?.getTotalCharges() ?? 0) * 31 + (idHash >>> 0)) | 0;
  let jitterState = (jitterSeed | 0) || 1;
  function jitter(): number {
    jitterState ^= jitterState << 13;
    jitterState ^= jitterState >> 17;
    jitterState ^= jitterState << 5;
    return ((jitterState >>> 0) / 4294967296) * 0.5; // 0 to 0.5
  }

  for (const c of candidates) {
    c.score += jitter();
  }

  // Sort by score descending, then deduplicate by correctAnswer before slicing to count
  candidates.sort((a, b) => b.score - a.score);

  // Deduplicate: skip candidates whose correctAnswer matches one already selected,
  // matches the quiz's correct answer, or is mentioned in the question text
  const selected: ScoredCandidate[] = [];
  const seenAnswers = new Set<string>();
  seenAnswers.add(correctFact.correctAnswer.toLowerCase()); // Never show correct answer as distractor

  // Exclude any entity mentioned by name in the question text
  // e.g., "Besides Saturn, which..." → Saturn must not appear as distractor
  const questionLower = (correctFact.quizQuestion ?? '').toLowerCase();

  for (const c of candidates) {
    if (selected.length >= count) break;
    const candidateFact = factById.get(c.factId);
    if (!candidateFact) continue;
    const answerKey = candidateFact.correctAnswer.toLowerCase();
    if (seenAnswers.has(answerKey)) continue;
    // Skip if this distractor's answer is mentioned in the question
    if (answerKey.length > 2 && questionLower.includes(answerKey)) continue;
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
