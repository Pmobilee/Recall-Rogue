/**
 * Audit Integration Regression Test
 *
 * Loads the solar_system deck end-to-end through the real quiz engine and
 * asserts structural invariants for every rendered fact/mastery combination.
 * This test is a CI gate against re-introducing patterns discovered in the
 * Phase 1-4 deck quality audit (2026-04-10).
 *
 * Mastery levels tested: 0, 2, 4 (→ 2, 3, 4 distractors per the game spec).
 * Total rows: 76 facts × 3 mastery levels = 228 rows, ~4+ assertions each = 900+ assertions.
 *
 * @see docs/gotchas.md "2026-04-10 — Phase 5 audit integration gate"
 * @see scripts/verify-all-decks.mjs (structural verifier, 30 checks)
 * @see scripts/quiz-audit-engine.ts (runtime verifier, 35 checks)
 */

// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { selectQuestionTemplate } from '../questionTemplateSelector';
import { selectDistractors, getDistractorCount } from '../curatedDistractorSelector';
import { isNumericalAnswer, getNumericalDistractors, displayAnswer } from '../numericalDistractorService';
import { ConfusionMatrix } from '../confusionMatrix';
import type { CuratedDeck, DeckFact } from '../../data/curatedDeckTypes';
import type { Fact } from '../../data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '../../../');

function loadDeck(deckId: string): CuratedDeck {
  const raw = readFileSync(resolve(ROOT, `data/decks/${deckId}.json`), 'utf-8');
  const deck = JSON.parse(raw) as CuratedDeck;
  if (!deck.questionTemplates) (deck as unknown as Record<string, unknown>).questionTemplates = [];
  if (!deck.synonymGroups) (deck as unknown as Record<string, unknown>).synonymGroups = [];
  return deck;
}

/** Seeded djb2 hash — same as quiz-audit-engine.ts */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MASTERY_LEVELS = [0, 2, 4];

// Placeholder leak patterns (Phase 5 check #26 / #32)
const PLACEHOLDER_CAPITAL_THIS = /[A-Z][a-z]+\s+this\b/;
const PLACEHOLDER_ANATOMICAL = /anatomical structure\s+\w+/;

// ---------------------------------------------------------------------------
// Core test suite
// ---------------------------------------------------------------------------

describe('Audit Integration — solar_system deck', () => {
  const deck = loadDeck('solar_system');
  const confusionMatrix = new ConfusionMatrix();

  // Filter out image facts (they have different quiz paths)
  const auditableFacts = deck.facts.filter(
    (f) => f.quizMode !== 'image_question' && f.quizMode !== 'image_answers',
  );

  it('loads the solar_system deck with at least 30 facts', () => {
    expect(deck.facts.length).toBeGreaterThanOrEqual(30);
    expect(auditableFacts.length).toBeGreaterThan(0);
  });

  // One describe per mastery level so failures are easy to trace
  for (const mastery of MASTERY_LEVELS) {
    describe(`Mastery ${mastery}`, () => {
      const expectedDistractorCount = getDistractorCount(mastery);

      for (const fact of auditableFacts) {
        it(`fact "${fact.id}" renders correctly at mastery ${mastery}`, () => {
          const seed = djb2(fact.id + mastery);

          // --- Select template ---
          const templateResult = selectQuestionTemplate(fact, deck, mastery, [], seed);
          const { renderedQuestion, answerPoolId, correctAnswer } = templateResult;
          const correctDisplay = displayAnswer(correctAnswer);

          // 1. Question must be non-empty
          expect(renderedQuestion.trim().length, `[${fact.id}] renderedQuestion must not be empty`).toBeGreaterThan(0);

          // 2. Correct answer must be non-empty
          expect(correctDisplay.trim().length, `[${fact.id}] correctDisplay must not be empty`).toBeGreaterThan(0);

          // --- Select distractors ---
          const isNumerical = isNumericalAnswer(correctAnswer);
          let distractorDisplays: string[] = [];

          if (isNumerical) {
            const factAdapter = { id: fact.id, correctAnswer } as unknown as Fact;
            const numDistractors = getNumericalDistractors(factAdapter, expectedDistractorCount);
            distractorDisplays = numDistractors.map((d) => displayAnswer(d));
          } else {
            const pool = deck.answerTypePools.find((p) => p.id === answerPoolId);
            if (pool && pool.factIds.length >= 2) {
              const result = selectDistractors(
                fact,
                pool,
                deck.facts,
                deck.synonymGroups,
                confusionMatrix,
                null,
                expectedDistractorCount,
                mastery,
              );
              distractorDisplays = result.distractors.map((d: DeckFact) => displayAnswer(d.correctAnswer));
            }
          }

          // 3. Correct answer must NOT appear verbatim in distractors
          const correctLower = correctDisplay.toLowerCase().trim();
          const distractorLowers = distractorDisplays.map((d) => d.toLowerCase().trim());
          expect(
            distractorLowers.includes(correctLower),
            `[${fact.id}] Correct answer "${correctDisplay}" must not appear in distractors`,
          ).toBe(false);

          // 4. No duplicate distractors
          const dedupedDistractors = new Set(distractorLowers);
          expect(
            dedupedDistractors.size,
            `[${fact.id}] Distractors must not contain duplicates`,
          ).toBe(distractorLowers.length);

          // 5. No "placeholder_leak" patterns in rendered question
          expect(
            PLACEHOLDER_CAPITAL_THIS.test(renderedQuestion),
            `[${fact.id}] Question must not contain "capital-word this" leak: "${renderedQuestion.slice(0, 80)}"`,
          ).toBe(false);

          expect(
            PLACEHOLDER_ANATOMICAL.test(renderedQuestion),
            `[${fact.id}] Question must not contain "anatomical structure" template leak: "${renderedQuestion.slice(0, 80)}"`,
          ).toBe(false);

          // 6. For percentage questions: no distractor > 100
          // solar_system has some percentage facts (e.g. composition percentages)
          const qLower = renderedQuestion.toLowerCase();
          const isPercentQ =
            qLower.includes('percent') || qLower.includes('%') || correctDisplay.endsWith('%');
          if (isPercentQ && !isNumerical) {
            // Non-numerical percentage answers: check pre-generated distractors on the fact
            if (Array.isArray(fact.distractors)) {
              for (const d of fact.distractors) {
                const dNum = parseFloat(String(d).replace(/%$/, ''));
                if (!isNaN(dNum)) {
                  expect(
                    dNum,
                    `[${fact.id}] Percentage distractor "${d}" must not exceed 100`,
                  ).toBeLessThanOrEqual(100);
                }
              }
            }
          }
        });
      }
    });
  }
});
