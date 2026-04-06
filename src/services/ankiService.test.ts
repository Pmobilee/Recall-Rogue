/**
 * Unit tests for ankiService.ts — Anki .apkg import/export pipeline.
 *
 * Covers:
 *   - stripHtml: HTML tag removal, entity decoding, and [sound:...] stripping
 *   - generateGuid: format and uniqueness
 *   - createApkg → parseApkg round-trip: deck name, notes, fields, scheduling
 *   - ankiToPersonalDeck: fact ID prefixing, field mapping, typing mode, pool
 *   - FSRS mapping round-trip: review state fields survive export/import/convert
 *   - State mapping correctness (new/learning/review/relearning)
 *   - HTML stripping during import
 *   - Cloze deletion parsing: single cloze, multi-cloze, with hints
 *   - Media extraction: media map populated from .apkg archive
 *
 * sql.js requires real WASM; run in Node environment to avoid happy-dom interference.
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import type { DeckFact } from '../data/curatedDeckTypes';
import type { ReviewState } from '../data/types';

// ---------------------------------------------------------------------------
// Shim sql.js locateFile to point at the real WASM in node_modules
// ---------------------------------------------------------------------------

// ankiService uses getSqlJs() which calls initFn({ locateFile: () => '/sql-wasm.wasm' }).
// In Node (test env) that path isn't served — we must intercept the import and
// provide a locateFile that resolves to the real fs path.
const REAL_WASM_PATH = resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');

// We patch the module after import via a spy on the module-level getSqlJs behaviour
// by re-exporting through a factory mock that rewires locateFile.
// Simpler approach: patch global sql.js import via vi.mock so locateFile is correct.
vi.mock('sql.js', async () => {
  const actual = await vi.importActual<{ default: (...args: unknown[]) => unknown }>('sql.js');
  const originalDefault = actual.default;
  // Wrap the default export so any callers' locateFile option is overridden.
  const patched = (opts?: { locateFile?: (file: string) => string }) => {
    return (originalDefault as (opts: { locateFile: (f: string) => string }) => unknown)({
      ...(opts ?? {}),
      locateFile: (_file: string) => REAL_WASM_PATH,
    });
  };
  return { default: patched };
});

// Now import the service (after mock is registered).
import {
  stripHtml,
  generateGuid,
  createApkg,
  parseApkg,
  ankiToPersonalDeck,
  parseClozeNote,
  extractImgFilenames,
} from './ankiService';

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleFacts: DeckFact[] = [
  {
    id: 'test_1',
    correctAnswer: 'Paris',
    acceptableAlternatives: [],
    chainThemeId: 0,
    answerTypePoolId: 'cities',
    difficulty: 3,
    funScore: 7,
    quizQuestion: 'What is the capital of France?',
    explanation: 'Paris is the capital of France.',
    visualDescription: '',
    sourceName: 'Test',
    distractors: ['London', 'Berlin', 'Rome'],
  },
  {
    id: 'test_2',
    correctAnswer: 'Tokyo',
    acceptableAlternatives: ['Tōkyō'],
    chainThemeId: 1,
    answerTypePoolId: 'cities',
    difficulty: 2,
    funScore: 8,
    quizQuestion: 'What is the capital of Japan?',
    explanation: 'Tokyo is the capital of Japan.',
    visualDescription: '',
    sourceName: 'Test',
    distractors: ['Osaka', 'Kyoto', 'Seoul'],
  },
];

// ---------------------------------------------------------------------------
// 1. stripHtml
// ---------------------------------------------------------------------------

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<b>bold</b>')).toBe('bold');
  });

  it('removes nested tags', () => {
    expect(stripHtml('<div><p>hello <span>world</span></p></div>')).toBe('hello world');
  });

  it('decodes &amp;', () => {
    expect(stripHtml('a &amp; b')).toBe('a & b');
  });

  it('decodes &lt; and &gt;', () => {
    expect(stripHtml('&lt;tag&gt;')).toBe('<tag>');
  });

  it('decodes &quot;', () => {
    expect(stripHtml('&quot;quoted&quot;')).toBe('"quoted"');
  });

  it('decodes &#39;', () => {
    expect(stripHtml('it&#39;s')).toBe("it's");
  });

  it('decodes &nbsp; as space', () => {
    expect(stripHtml('a&nbsp;b')).toBe('a b');
  });

  it('decodes numeric decimal entities', () => {
    // &#65; = 'A'
    expect(stripHtml('&#65;')).toBe('A');
  });

  it('decodes numeric hex entities', () => {
    // &#x41; = 'A'
    expect(stripHtml('&#x41;')).toBe('A');
  });

  it('handles <br> tags with surrounding text', () => {
    expect(stripHtml('line1<br>line2')).toBe('line1line2');
  });

  it('trims leading and trailing whitespace', () => {
    expect(stripHtml('  hello  ')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('passes through plain text unchanged', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });

  // [sound:...] stripping
  it('strips [sound:filename.mp3] Anki audio syntax', () => {
    expect(stripHtml('Hello [sound:audio.mp3] world')).toBe('Hello  world');
  });

  it('strips [sound:...] with path in filename', () => {
    expect(stripHtml('[sound:pronunciation/word.ogg]')).toBe('');
  });

  it('strips multiple [sound:...] tags', () => {
    expect(stripHtml('[sound:a.mp3] text [sound:b.mp3]')).toBe('text');
  });

  it('strips <img> tags', () => {
    expect(stripHtml('before <img src="image.jpg"> after')).toBe('before  after');
  });
});

// ---------------------------------------------------------------------------
// 2. generateGuid
// ---------------------------------------------------------------------------

describe('generateGuid', () => {
  it('produces an 8-character string', () => {
    const guid = generateGuid();
    expect(guid).toHaveLength(8);
  });

  it('only contains base62 characters', () => {
    const guid = generateGuid();
    expect(guid).toMatch(/^[0-9A-Za-z]{8}$/);
  });

  it('generates unique values across multiple calls', () => {
    const guids = new Set(Array.from({ length: 200 }, () => generateGuid()));
    // With 62^8 possible values, 200 calls should produce 200 unique values.
    expect(guids.size).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 3. createApkg → parseApkg round-trip
// ---------------------------------------------------------------------------

describe('createApkg → parseApkg round-trip', () => {
  let apkgBytes: Uint8Array;

  beforeAll(async () => {
    apkgBytes = await createApkg({ deckName: 'Test Deck', facts: sampleFacts });
  });

  it('produces a non-empty Uint8Array', () => {
    expect(apkgBytes).toBeInstanceOf(Uint8Array);
    expect(apkgBytes.length).toBeGreaterThan(0);
  });

  it('round-trip: deck name matches', async () => {
    const imported = await parseApkg(apkgBytes);
    expect(imported.deckName).toBe('Test Deck');
  });

  it('round-trip: notes count matches facts count', async () => {
    const imported = await parseApkg(apkgBytes);
    expect(imported.notes).toHaveLength(sampleFacts.length);
  });

  it('round-trip: first note front field matches original quizQuestion', async () => {
    const imported = await parseApkg(apkgBytes);
    expect(imported.notes[0].fields[0]).toBe(sampleFacts[0].quizQuestion);
  });

  it('round-trip: first note back field matches original correctAnswer', async () => {
    const imported = await parseApkg(apkgBytes);
    expect(imported.notes[0].fields[1]).toBe(sampleFacts[0].correctAnswer);
  });

  it('round-trip: second note fields match second fact', async () => {
    const imported = await parseApkg(apkgBytes);
    expect(imported.notes[1].fields[0]).toBe(sampleFacts[1].quizQuestion);
    expect(imported.notes[1].fields[1]).toBe(sampleFacts[1].correctAnswer);
  });

  it('round-trip: cards count matches facts count', async () => {
    const imported = await parseApkg(apkgBytes);
    expect(imported.cards).toHaveLength(sampleFacts.length);
  });

  it('round-trip: totalCards matches facts count', async () => {
    const imported = await parseApkg(apkgBytes);
    expect(imported.totalCards).toBe(sampleFacts.length);
  });

  it('round-trip: hasSchedulingData is false when no review states provided', async () => {
    const imported = await parseApkg(apkgBytes);
    expect(imported.hasSchedulingData).toBe(false);
  });

  it('round-trip: each note has a guid', async () => {
    const imported = await parseApkg(apkgBytes);
    for (const note of imported.notes) {
      expect(note.guid).toBeDefined();
      expect(typeof note.guid).toBe('string');
      expect((note.guid ?? '').length).toBeGreaterThan(0);
    }
  });

  it('round-trip: media map is empty when no media in archive', async () => {
    const imported = await parseApkg(apkgBytes);
    expect(imported.media).toBeInstanceOf(Map);
    expect(imported.media.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. ankiToPersonalDeck
// ---------------------------------------------------------------------------

describe('ankiToPersonalDeck', () => {
  let apkgBytes: Uint8Array;

  beforeAll(async () => {
    apkgBytes = await createApkg({ deckName: 'Capital Cities', facts: sampleFacts });
  });

  it('fact IDs are prefixed with anki_', async () => {
    const importData = await parseApkg(apkgBytes);
    const { deck } = ankiToPersonalDeck(importData, {
      deckId: 'my_deck',
      deckName: 'My Deck',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    for (const fact of deck.facts) {
      expect(fact.id).toMatch(/^anki_/);
    }
  });

  it('facts have correct quizQuestion from front field', async () => {
    const importData = await parseApkg(apkgBytes);
    const { deck } = ankiToPersonalDeck(importData, {
      deckId: 'my_deck',
      deckName: 'My Deck',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    expect(deck.facts[0].quizQuestion).toBe(sampleFacts[0].quizQuestion);
    expect(deck.facts[1].quizQuestion).toBe(sampleFacts[1].quizQuestion);
  });

  it('facts have correct correctAnswer from back field', async () => {
    const importData = await parseApkg(apkgBytes);
    const { deck } = ankiToPersonalDeck(importData, {
      deckId: 'my_deck',
      deckName: 'My Deck',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    expect(deck.facts[0].correctAnswer).toBe(sampleFacts[0].correctAnswer);
    expect(deck.facts[1].correctAnswer).toBe(sampleFacts[1].correctAnswer);
  });

  it('quizResponseMode is typing by default', async () => {
    const importData = await parseApkg(apkgBytes);
    const { deck } = ankiToPersonalDeck(importData, {
      deckId: 'my_deck',
      deckName: 'My Deck',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    for (const fact of deck.facts) {
      expect(fact.quizResponseMode).toBe('typing');
    }
  });

  it('creates an answer pool with all fact IDs', async () => {
    const importData = await parseApkg(apkgBytes);
    const { deck } = ankiToPersonalDeck(importData, {
      deckId: 'my_deck',
      deckName: 'My Deck',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    expect(deck.answerTypePools).toHaveLength(1);
    const pool = deck.answerTypePools[0];
    expect(pool.id).toBe('anki_default');
    expect(pool.factIds).toHaveLength(deck.facts.length);
    for (const fact of deck.facts) {
      expect(pool.factIds).toContain(fact.id);
    }
  });

  it('deck ID and name match options', async () => {
    const importData = await parseApkg(apkgBytes);
    const { deck } = ankiToPersonalDeck(importData, {
      deckId: 'custom_id',
      deckName: 'Custom Name',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    expect(deck.id).toBe('custom_id');
    expect(deck.name).toBe('Custom Name');
  });

  it('deck description references original Anki deck name', async () => {
    const importData = await parseApkg(apkgBytes);
    const { deck } = ankiToPersonalDeck(importData, {
      deckId: 'my_deck',
      deckName: 'My Deck',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    expect(deck.description).toContain('Capital Cities');
  });

  it('returns empty reviewStates when importScheduling is false', async () => {
    const importData = await parseApkg(apkgBytes);
    const { reviewStates } = ankiToPersonalDeck(importData, {
      deckId: 'my_deck',
      deckName: 'My Deck',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    expect(reviewStates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. FSRS mapping round-trip — review state fields survive export/import/convert
// ---------------------------------------------------------------------------

describe('FSRS mapping round-trip', () => {
  const reviewCardState: ReviewState = {
    factId: 'test_1',
    cardState: 'review',
    state: 'review',
    easeFactor: 2.3,
    interval: 14,
    stability: 14,
    difficulty: 4,
    reps: 8,
    lapses: 1,
    lapseCount: 1,
    repetitions: 8,
    due: Date.now() + 86_400_000,
    nextReviewAt: Date.now() + 86_400_000,
    lastReviewAt: Date.now() - 14 * 86_400_000,
    lastReview: Date.now() - 14 * 86_400_000,
    quality: 4,
    learningStep: 0,
    isLeech: false,
    consecutiveCorrect: 5,
    passedMasteryTrial: true,
    retrievability: 0.9,
    masteredAt: 0,
    graduatedRelicId: null,
    lastVariantIndex: -1,
    totalAttempts: 10,
    totalCorrect: 9,
    averageResponseTimeMs: 3200,
    tierHistory: [],
  };

  const learningCardState: ReviewState = {
    factId: 'test_2',
    cardState: 'learning',
    state: 'learning',
    easeFactor: 2.5,
    interval: 0,
    stability: 0.1,
    difficulty: 5,
    reps: 2,
    lapses: 0,
    lapseCount: 0,
    repetitions: 2,
    due: Date.now() + 600_000,
    nextReviewAt: Date.now() + 600_000,
    lastReviewAt: Date.now(),
    lastReview: Date.now(),
    quality: 3,
    learningStep: 1,
    isLeech: false,
    consecutiveCorrect: 1,
    passedMasteryTrial: false,
    retrievability: 0,
    masteredAt: 0,
    graduatedRelicId: null,
    lastVariantIndex: -1,
    totalAttempts: 2,
    totalCorrect: 2,
    averageResponseTimeMs: 4000,
    tierHistory: [],
  };

  let apkgBytes: Uint8Array;

  beforeAll(async () => {
    apkgBytes = await createApkg({
      deckName: 'Scheduled Deck',
      facts: sampleFacts,
      reviewStates: [reviewCardState, learningCardState],
    });
  });

  it('hasSchedulingData is true when review cards have reps > 0', async () => {
    const imported = await parseApkg(apkgBytes);
    expect(imported.hasSchedulingData).toBe(true);
  });

  it('review card reps survive round-trip', async () => {
    const imported = await parseApkg(apkgBytes);
    const { reviewStates } = ankiToPersonalDeck(imported, {
      deckId: 'test',
      deckName: 'Test',
      importScheduling: true,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    // Find the review-state card (first fact = review type)
    const reviewRS = reviewStates.find(rs => rs.reps === 8 || rs.repetitions === 8);
    expect(reviewRS).toBeDefined();
    expect(reviewRS!.reps ?? reviewRS!.repetitions).toBe(8);
  });

  it('review card lapses survive round-trip', async () => {
    const imported = await parseApkg(apkgBytes);
    const { reviewStates } = ankiToPersonalDeck(imported, {
      deckId: 'test',
      deckName: 'Test',
      importScheduling: true,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    const reviewRS = reviewStates.find(rs => (rs.reps ?? rs.repetitions) === 8);
    expect(reviewRS).toBeDefined();
    expect(reviewRS!.lapses ?? reviewRS!.lapseCount).toBe(1);
  });

  it('review card interval survives round-trip', async () => {
    const imported = await parseApkg(apkgBytes);
    const { reviewStates } = ankiToPersonalDeck(imported, {
      deckId: 'test',
      deckName: 'Test',
      importScheduling: true,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    const reviewRS = reviewStates.find(rs => (rs.reps ?? rs.repetitions) === 8);
    expect(reviewRS).toBeDefined();
    expect(reviewRS!.interval).toBe(14);
  });

  it('ease factor survives round-trip (within rounding tolerance)', async () => {
    const imported = await parseApkg(apkgBytes);
    const { reviewStates } = ankiToPersonalDeck(imported, {
      deckId: 'test',
      deckName: 'Test',
      importScheduling: true,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    const reviewRS = reviewStates.find(rs => (rs.reps ?? rs.repetitions) === 8);
    expect(reviewRS).toBeDefined();
    // Anki stores ease in permille → factor = Math.round(2.3 * 1000) = 2300 → /1000 = 2.3
    expect(reviewRS!.easeFactor).toBeCloseTo(2.3, 1);
  });

  it('cardState is review for review-type card', async () => {
    const imported = await parseApkg(apkgBytes);
    const { reviewStates } = ankiToPersonalDeck(imported, {
      deckId: 'test',
      deckName: 'Test',
      importScheduling: true,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    const reviewRS = reviewStates.find(rs => (rs.reps ?? rs.repetitions) === 8);
    expect(reviewRS).toBeDefined();
    expect(reviewRS!.cardState).toBe('review');
  });

  it('cardState is learning for learning-type card', async () => {
    const imported = await parseApkg(apkgBytes);
    const { reviewStates } = ankiToPersonalDeck(imported, {
      deckId: 'test',
      deckName: 'Test',
      importScheduling: true,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    const learningRS = reviewStates.find(rs => (rs.reps ?? rs.repetitions) === 2);
    expect(learningRS).toBeDefined();
    expect(learningRS!.cardState).toBe('learning');
  });

  it('reviewStates has one entry per note when importScheduling is true', async () => {
    const imported = await parseApkg(apkgBytes);
    const { reviewStates, deck } = ankiToPersonalDeck(imported, {
      deckId: 'test',
      deckName: 'Test',
      importScheduling: true,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    expect(reviewStates).toHaveLength(deck.facts.length);
  });
});

// ---------------------------------------------------------------------------
// 6. State mapping correctness (all 4 Anki card types)
// ---------------------------------------------------------------------------

describe('Anki state mapping', () => {
  const makeReviewState = (factId: string, cardState: 'new' | 'learning' | 'review' | 'relearning', reps = 1): ReviewState => ({
    factId,
    cardState,
    state: cardState,
    easeFactor: 2.5,
    interval: cardState === 'review' ? 7 : 0,
    stability: 0.1,
    difficulty: 5,
    reps,
    lapses: 0,
    lapseCount: 0,
    repetitions: reps,
    due: Date.now(),
    nextReviewAt: Date.now(),
    lastReviewAt: Date.now(),
    lastReview: Date.now(),
    quality: 3,
    learningStep: 0,
    isLeech: false,
    consecutiveCorrect: 0,
    passedMasteryTrial: false,
    retrievability: 0,
    masteredAt: 0,
    graduatedRelicId: null,
    lastVariantIndex: -1,
    totalAttempts: reps,
    totalCorrect: reps,
    averageResponseTimeMs: 0,
    tierHistory: [],
  });

  it.each([
    ['new', 0, 0],
    ['learning', 1, 1],
    ['review', 2, 3],
    ['relearning', 3, 1],
  ] as const)(
    'cardState %s survives round-trip',
    async (state, _ankiType, reps) => {
      const facts = [sampleFacts[0]];
      const rs = makeReviewState('test_1', state as 'new' | 'learning' | 'review' | 'relearning', reps);
      const apkg = await createApkg({ deckName: 'State Test', facts, reviewStates: [rs] });
      const imported = await parseApkg(apkg);
      const { reviewStates } = ankiToPersonalDeck(imported, {
        deckId: 'x',
        deckName: 'X',
        importScheduling: true,
        frontFieldIndex: 0,
        backFieldIndex: 1,
      });
      expect(reviewStates[0].cardState).toBe(state);
    },
  );
});

// ---------------------------------------------------------------------------
// 7. HTML stripping during import
// ---------------------------------------------------------------------------

describe('HTML stripping during import', () => {
  it('strips <b> tags from imported note fields', async () => {
    const htmlFacts = [
      {
        ...sampleFacts[0],
        quizQuestion: '<b>What is the capital of France?</b>',
        correctAnswer: '<i>Paris</i>',
      },
    ];
    const apkg = await createApkg({ deckName: 'HTML Deck', facts: htmlFacts });
    const imported = await parseApkg(apkg);
    // Notes store raw HTML — the stripping happens in ankiToPersonalDeck.
    const { deck } = ankiToPersonalDeck(imported, {
      deckId: 'html_test',
      deckName: 'HTML Test',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    expect(deck.facts[0].quizQuestion).toBe('What is the capital of France?');
    expect(deck.facts[0].correctAnswer).toBe('Paris');
  });

  it('decodes &amp; in imported note fields', async () => {
    const htmlFacts = [
      {
        ...sampleFacts[0],
        quizQuestion: 'What is 1 &amp; 2?',
        correctAnswer: '1 &amp; 2',
      },
    ];
    const apkg = await createApkg({ deckName: 'Entity Deck', facts: htmlFacts });
    const imported = await parseApkg(apkg);
    const { deck } = ankiToPersonalDeck(imported, {
      deckId: 'ent_test',
      deckName: 'Entity Test',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    expect(deck.facts[0].quizQuestion).toBe('What is 1 & 2?');
    expect(deck.facts[0].correctAnswer).toBe('1 & 2');
  });

  it('handles <br> in note fields', async () => {
    const htmlFacts = [
      {
        ...sampleFacts[0],
        quizQuestion: 'Line1<br>Line2',
        correctAnswer: 'Paris',
      },
    ];
    const apkg = await createApkg({ deckName: 'BR Deck', facts: htmlFacts });
    const imported = await parseApkg(apkg);
    const { deck } = ankiToPersonalDeck(imported, {
      deckId: 'br_test',
      deckName: 'BR Test',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    expect(deck.facts[0].quizQuestion).toBe('Line1Line2');
  });

  it('skips notes with empty front field after stripping', async () => {
    // A note where the front is only HTML tags — should be skipped.
    const htmlFacts = [
      {
        ...sampleFacts[0],
        quizQuestion: '<span></span>',
        correctAnswer: 'Paris',
      },
      sampleFacts[1],
    ];
    const apkg = await createApkg({ deckName: 'Empty Front Deck', facts: htmlFacts });
    const imported = await parseApkg(apkg);
    const { deck } = ankiToPersonalDeck(imported, {
      deckId: 'ef_test',
      deckName: 'EF Test',
      importScheduling: false,
      frontFieldIndex: 0,
      backFieldIndex: 1,
    });
    // Only the second fact survives (first has empty front after stripping).
    expect(deck.facts).toHaveLength(1);
    expect(deck.facts[0].correctAnswer).toBe(sampleFacts[1].correctAnswer);
  });
});

// ---------------------------------------------------------------------------
// 8. Cloze deletion parsing (parseClozeNote)
// ---------------------------------------------------------------------------

describe('parseClozeNote', () => {
  it('single cloze: produces one fact', () => {
    const result = parseClozeNote('testguid', ['{{c1::Paris}} is the capital of France.'], 0, 0);
    expect(result).toHaveLength(1);
    expect(result[0].clozeIndex).toBe(1);
    expect(result[0].answer).toBe('Paris');
    expect(result[0].question).toBe('[___] is the capital of France.');
  });

  it('single cloze with hint: uses hint as placeholder', () => {
    const result = parseClozeNote('testguid', ['{{c1::Paris::city}} is the capital.'], 0, 0);
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('[city] is the capital.');
    expect(result[0].answer).toBe('Paris');
  });

  it('multi-cloze: produces one fact per unique index', () => {
    const result = parseClozeNote(
      'testguid',
      ['{{c1::Paris}} is the capital of {{c2::France}}.'],
      0,
      0,
    );
    expect(result).toHaveLength(2);

    const c1 = result.find(r => r.clozeIndex === 1);
    const c2 = result.find(r => r.clozeIndex === 2);

    expect(c1).toBeDefined();
    expect(c1!.question).toBe('[___] is the capital of France.');
    expect(c1!.answer).toBe('Paris');

    expect(c2).toBeDefined();
    expect(c2!.question).toBe('Paris is the capital of [___].');
    expect(c2!.answer).toBe('France');
  });

  it('multi-cloze: other cloze answers are revealed in the question', () => {
    const result = parseClozeNote(
      'testguid',
      ['{{c1::A}} and {{c2::B}} and {{c3::C}}.'],
      0,
      0,
    );
    expect(result).toHaveLength(3);

    const c1 = result.find(r => r.clozeIndex === 1);
    // c1 question should reveal B and C
    expect(c1!.question).toBe('[___] and B and C.');

    const c2 = result.find(r => r.clozeIndex === 2);
    // c2 question should reveal A and C
    expect(c2!.question).toBe('A and [___] and C.');
  });

  it('fact IDs use noteGuid and cloze index', () => {
    const result = parseClozeNote('myguid123', ['{{c1::answer}}'], 0, 0);
    expect(result[0].factId).toBe('anki_myguid123_c1');
  });

  it('returns empty array when no cloze markers found', () => {
    const result = parseClozeNote('testguid', ['plain text question', 'plain answer'], 0, 0);
    expect(result).toHaveLength(0);
  });

  it('skips cloze entries where answer is empty after stripping', () => {
    // HTML-only answer should be stripped to empty and skipped.
    const result = parseClozeNote('testguid', ['{{c1::<span></span>}} text'], 0, 0);
    expect(result).toHaveLength(0);
  });

  it('chainThemeId rotates across 6 slots based on factIndex and clozeIndex', () => {
    // factIndex=0, clozeIndex=1 → (0+1) % 6 = 1
    const result = parseClozeNote('guid', ['{{c1::A}}'], 0, 0);
    expect(result[0].chainThemeId).toBe(1);
  });

  it('uses frontFieldIndex to pick source field', () => {
    // Field 1 contains the cloze text; frontFieldIndex=1
    const result = parseClozeNote('testguid', ['ignore this', '{{c1::answer}} question'], 1, 0);
    expect(result).toHaveLength(1);
    expect(result[0].answer).toBe('answer');
  });
});

// ---------------------------------------------------------------------------
// 9. extractImgFilenames
// ---------------------------------------------------------------------------

describe('extractImgFilenames', () => {
  it('extracts src from a simple <img> tag', () => {
    expect(extractImgFilenames('<img src="image.jpg">')).toEqual(['image.jpg']);
  });

  it('extracts multiple images', () => {
    const html = '<img src="a.png"> text <img src="b.gif">';
    expect(extractImgFilenames(html)).toEqual(['a.png', 'b.gif']);
  });

  it('handles single-quoted src', () => {
    expect(extractImgFilenames("<img src='test.webp'>")).toEqual(['test.webp']);
  });

  it('returns empty array when no img tags', () => {
    expect(extractImgFilenames('plain text')).toEqual([]);
  });

  it('ignores img tags without src', () => {
    expect(extractImgFilenames('<img alt="no src">')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10. Media extraction from .apkg
// ---------------------------------------------------------------------------

describe('Media extraction from .apkg', () => {
  /**
   * Build a minimal .apkg ZIP that includes fake media files.
   * We use fflate directly to construct the ZIP without going through createApkg,
   * because createApkg creates a real SQLite DB (which we still need for the collection).
   * Strategy: create a real .apkg with createApkg, then manually add media to its ZIP.
   */
  let apkgWithMedia: Uint8Array;
  const fakeImageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
  const fakeAudioBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00]); // MP3 magic bytes

  beforeAll(async () => {
    // Build base apkg (no media).
    const base = await createApkg({ deckName: 'Media Test', facts: sampleFacts });

    // Unzip, add media files, re-zip.
    const { unzipSync } = await import('fflate');
    const unzipped = unzipSync(base);

    // Create media manifest: integer keys → original filenames.
    const mediaManifest = JSON.stringify({ '0': 'image.jpg', '1': 'audio.mp3' });
    unzipped['media'] = strToU8(mediaManifest);
    unzipped['0'] = fakeImageBytes;
    unzipped['1'] = fakeAudioBytes;

    apkgWithMedia = new Uint8Array(zipSync(unzipped));
  });

  it('media map has correct size after extraction', async () => {
    const imported = await parseApkg(apkgWithMedia);
    expect(imported.media.size).toBe(2);
  });

  it('media map keys are original filenames', async () => {
    const imported = await parseApkg(apkgWithMedia);
    expect(imported.media.has('image.jpg')).toBe(true);
    expect(imported.media.has('audio.mp3')).toBe(true);
  });

  it('media file bytes are correctly extracted', async () => {
    const imported = await parseApkg(apkgWithMedia);
    const imgBytes = imported.media.get('image.jpg');
    expect(imgBytes).toBeInstanceOf(Uint8Array);
    // Check PNG magic bytes survived.
    expect(imgBytes![0]).toBe(0x89);
    expect(imgBytes![1]).toBe(0x50);
  });

  it('media map is empty when archive has no media files', async () => {
    const base = await createApkg({ deckName: 'No Media', facts: sampleFacts });
    const imported = await parseApkg(base);
    expect(imported.media.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 11. createApkg with media export
// ---------------------------------------------------------------------------

describe('createApkg with media export', () => {
  it('bundles media into the archive and round-trips correctly', async () => {
    const fakeImg = new Uint8Array([1, 2, 3, 4]);
    const mediaMap = new Map<string, Uint8Array>([['diagram.png', fakeImg]]);

    const apkgBytes = await createApkg({
      deckName: 'Media Export',
      facts: sampleFacts,
      media: mediaMap,
    });

    const imported = await parseApkg(apkgBytes);
    expect(imported.media.has('diagram.png')).toBe(true);
    const recovered = imported.media.get('diagram.png');
    expect(recovered).toBeInstanceOf(Uint8Array);
    expect(Array.from(recovered!)).toEqual([1, 2, 3, 4]);
  });

  it('produces empty media manifest when no media provided', async () => {
    const apkgBytes = await createApkg({ deckName: 'No Media', facts: sampleFacts });
    const imported = await parseApkg(apkgBytes);
    expect(imported.media.size).toBe(0);
  });
});
