/**
 * Regression tests for known factual errors in curated decks.
 *
 * These tests load the curated deck JSON files directly and assert specific
 * correctAnswer values for facts where LLM hallucinations caused historical
 * errors that had to be manually corrected.
 *
 * Adding a test here after every factual fix prevents regressions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '../../../');

function loadDeck(deckId: string): { facts: Array<Record<string, unknown>> } {
  const raw = readFileSync(resolve(ROOT, `data/decks/${deckId}.json`), 'utf-8');
  return JSON.parse(raw) as { facts: Array<Record<string, unknown>> };
}

function getFactById(deck: { facts: Array<Record<string, unknown>> }, id: string) {
  return deck.facts.find((f) => f['id'] === id);
}

// ---------------------------------------------------------------------------
// Fix A — Reagan / USSR dissolution (2026-04-10)
// Ronald Reagan left office January 20, 1989.
// The USSR dissolved December 25, 1991 — under George H.W. Bush.
// ---------------------------------------------------------------------------

describe('Fix A — Reagan / USSR dissolution regression', () => {
  it('us_presidents: pres_reagan_end_cold_war must NOT claim Reagan presided over 1991 USSR dissolution', () => {
    const deck = loadDeck('us_presidents');
    const fact = getFactById(deck, 'pres_reagan_end_cold_war');
    expect(fact, 'pres_reagan_end_cold_war must exist').toBeDefined();

    const q = (fact!['quizQuestion'] as string).toLowerCase();
    // Must not say "1991" in the question (that year implies USSR dissolution = under Bush)
    expect(q, 'question must not reference 1991 dissolution').not.toContain('dissolved in 1991');
    expect(q, 'question must not say dissolved in 1991').not.toMatch(/soviet union dissolved in 1991/i);

    // Reagan is still correct — for his Cold War strategy (SDI, evil empire rhetoric)
    expect(fact!['correctAnswer']).toBe('Ronald Reagan');
  });

  it('us_presidents: no fact with "1991" + "USSR/Soviet Union dissolution" may have Reagan as correctAnswer', () => {
    const deck = loadDeck('us_presidents');
    const violations = deck.facts.filter((f) => {
      const q = ((f['quizQuestion'] as string) || '').toLowerCase();
      const ans = ((f['correctAnswer'] as string) || '').toLowerCase();
      const mentions1991Dissolution =
        q.includes('1991') &&
        (q.includes('soviet union dissolv') ||
          q.includes('ussr dissolv') ||
          q.includes('soviet union officially dissolv'));
      const isReagan = ans === 'ronald reagan' || ans === 'reagan';
      return mentions1991Dissolution && isReagan;
    });
    expect(
      violations.map((f) => ({ id: f['id'], q: f['quizQuestion'] })),
      'No fact should claim Reagan presided over the 1991 USSR dissolution'
    ).toHaveLength(0);
  });

  it('us_presidents: pres_ghwbush_soviet correctly attributes 1991 USSR dissolution to George H.W. Bush', () => {
    const deck = loadDeck('us_presidents');
    const fact = getFactById(deck, 'pres_ghwbush_soviet');
    expect(fact, 'pres_ghwbush_soviet must exist').toBeDefined();
    expect((fact!['correctAnswer'] as string).toLowerCase()).toContain('bush');
  });
});

// ---------------------------------------------------------------------------
// Fix B — Spanish C1 row-alignment errors (2026-04-10)
// Three facts had wrong correctAnswer due to data pipeline row misalignment.
// ---------------------------------------------------------------------------

describe('Fix B — Spanish C1 translation regression', () => {
  it('es-cefr-3990: donde must translate to "where", not "because"', () => {
    const deck = loadDeck('spanish_c1');
    const fact = getFactById(deck, 'es-cefr-3990');
    expect(fact, 'es-cefr-3990 must exist').toBeDefined();
    const ans = (fact!['correctAnswer'] as string).toLowerCase();
    expect(ans, 'donde means "where" not "because"').toContain('where');
    expect(ans, 'donde must not say "because"').not.toBe('because');
  });

  it('es-cefr-4014: habitual must not translate to "beans"', () => {
    const deck = loadDeck('spanish_c1');
    const fact = getFactById(deck, 'es-cefr-4014');
    expect(fact, 'es-cefr-4014 must exist').toBeDefined();
    const ans = (fact!['correctAnswer'] as string).toLowerCase();
    expect(ans, '"habitual" must not translate to "beans"').not.toBe('beans');
    // habitual is a cognate — should contain "habitual" or "customary" or "usual"
    const correctValues = ['habitual', 'customary', 'usual'];
    const isCorrect = correctValues.some((v) => ans.includes(v));
    expect(isCorrect, `"habitual" answer should be one of: ${correctValues.join(', ')}`).toBe(true);
  });

  it('es-cefr-4002: sino (conjunction) must translate to its conjunction meaning, not the noun "destiny"', () => {
    const deck = loadDeck('spanish_c1');
    const fact = getFactById(deck, 'es-cefr-4002');
    expect(fact, 'es-cefr-4002 must exist').toBeDefined();
    const ans = (fact!['correctAnswer'] as string).toLowerCase();
    // The conjunction sense is "but rather" / "but instead"
    // The noun sense "destiny, fate, lot" was wrong for a conjunction-tagged fact
    expect(ans, '"sino" conjunction must not translate to "destiny, fate, lot"').not.toBe(
      'destiny, fate, lot'
    );
  });
});
