/**
 * Unit tests for proceduralSkillSelector.ts
 *
 * Covers: new skill selection, relearning priority, due-review priority,
 * subDeckId filtering, anti-repeat (lastSkillId), MAX_LEARNING cap,
 * and reason field matching priority.
 */

import { describe, it, expect, vi } from 'vitest';
import { selectSkillForPractice } from './proceduralSkillSelector';
import type { ProceduralDeck, PlayerSkillState, SkillNode } from '../../data/proceduralDeckTypes';

// ---------------------------------------------------------------------------
// Mock saveService (createSkillState imported by skillStateManager which is
// imported by proceduralSkillSelector)
// ---------------------------------------------------------------------------

vi.mock('../saveService', () => ({
  load: vi.fn(() => null),
  save: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSkill(id: string): SkillNode {
  const params = { rangeA: [1, 10] as [number, number], rangeB: [1, 10] as [number, number] };
  return {
    id,
    name: id,
    description: '',
    generatorId: 'arithmetic',
    tierParams: { '1': params, '2a': params, '2b': params, '3': params },
  };
}

function makeDeck(skillIds: string[], subDecks: { id: string; skillIds: string[] }[] = []): ProceduralDeck {
  return {
    id: 'test_deck',
    name: 'Test Deck',
    domain: 'mathematics',
    description: '',
    skills: skillIds.map(makeSkill),
    subDecks: subDecks.map((sd) => ({ id: sd.id, name: sd.id, skillIds: sd.skillIds })),
  };
}

function makeSkillState(
  skillId: string,
  deckId: string,
  overrides: Partial<PlayerSkillState> = {},
): PlayerSkillState {
  return {
    skillId,
    deckId,
    cardState: 'new',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: 0,
    lastReviewAt: 0,
    quality: 0,
    learningStep: 0,
    lapseCount: 0,
    isLeech: false,
    stability: 0,
    consecutiveCorrect: 0,
    passedMasteryTrial: false,
    retrievability: 0,
    difficulty: 5,
    totalAttempts: 0,
    totalCorrect: 0,
    averageResponseTimeMs: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Selects new skills when all are 'new'
// ---------------------------------------------------------------------------

describe('selectSkillForPractice — new skills', () => {
  it('selects from new skills when all states are new', () => {
    const deck = makeDeck(['skill_a', 'skill_b', 'skill_c']);
    const result = selectSkillForPractice(deck, [], undefined, undefined);
    expect(result.reason).toBe('new');
    expect(['skill_a', 'skill_b', 'skill_c']).toContain(result.skill.id);
  });

  it('introduces skills in deck definition order', () => {
    const deck = makeDeck(['skill_a', 'skill_b', 'skill_c']);
    // No states provided → all new → first skill in deck is selected
    const result = selectSkillForPractice(deck, [], undefined, undefined);
    expect(result.skill.id).toBe('skill_a');
  });

  it('reason is "new" when selecting a new skill', () => {
    const deck = makeDeck(['s1']);
    const result = selectSkillForPractice(deck, [], undefined, undefined);
    expect(result.reason).toBe('new');
  });
});

// ---------------------------------------------------------------------------
// 2. Prioritizes relearning over new
// ---------------------------------------------------------------------------

describe('selectSkillForPractice — relearning priority', () => {
  it('picks relearning skill over new skill', () => {
    const deck = makeDeck(['new_skill', 'relearn_skill']);
    const states: PlayerSkillState[] = [
      makeSkillState('relearn_skill', 'test_deck', { cardState: 'relearning' }),
    ];
    const result = selectSkillForPractice(deck, states, undefined, undefined);
    expect(result.skill.id).toBe('relearn_skill');
    expect(result.reason).toBe('relearning');
  });

  it('relearning beats due review too', () => {
    const deck = makeDeck(['review_skill', 'relearn_skill']);
    const now = Date.now();
    const states: PlayerSkillState[] = [
      makeSkillState('review_skill', 'test_deck', {
        cardState: 'review',
        nextReviewAt: now - 1000,
        due: now - 1000,
        retrievability: 0.5,
      }),
      makeSkillState('relearn_skill', 'test_deck', { cardState: 'relearning' }),
    ];
    const result = selectSkillForPractice(deck, states, undefined, undefined);
    expect(result.skill.id).toBe('relearn_skill');
    expect(result.reason).toBe('relearning');
  });
});

// ---------------------------------------------------------------------------
// 3. Prioritizes due review over new
// ---------------------------------------------------------------------------

describe('selectSkillForPractice — due review priority', () => {
  it('picks due review skill over new skill', () => {
    const deck = makeDeck(['new_skill', 'due_skill']);
    const now = Date.now();
    const states: PlayerSkillState[] = [
      makeSkillState('due_skill', 'test_deck', {
        cardState: 'review',
        nextReviewAt: now - 5000,
        due: now - 5000,
        retrievability: 0.7,
      }),
    ];
    const result = selectSkillForPractice(deck, states, undefined, undefined);
    expect(result.skill.id).toBe('due_skill');
    expect(result.reason).toBe('due');
  });

  it('picks the most-forgotten skill first (lowest retrievability)', () => {
    const deck = makeDeck(['skill_a', 'skill_b']);
    const now = Date.now();
    const states: PlayerSkillState[] = [
      makeSkillState('skill_a', 'test_deck', {
        cardState: 'review',
        nextReviewAt: now - 1000,
        due: now - 1000,
        retrievability: 0.9, // mostly remembered
      }),
      makeSkillState('skill_b', 'test_deck', {
        cardState: 'review',
        nextReviewAt: now - 1000,
        due: now - 1000,
        retrievability: 0.2, // mostly forgotten
      }),
    ];
    const result = selectSkillForPractice(deck, states, undefined, undefined);
    expect(result.skill.id).toBe('skill_b');
  });

  it('reason is "due" for due review selection', () => {
    const deck = makeDeck(['s1']);
    const now = Date.now();
    const states: PlayerSkillState[] = [
      makeSkillState('s1', 'test_deck', {
        cardState: 'review',
        nextReviewAt: now - 100,
        due: now - 100,
        retrievability: 0.5,
      }),
    ];
    const result = selectSkillForPractice(deck, states, undefined, undefined);
    expect(result.reason).toBe('due');
  });
});

// ---------------------------------------------------------------------------
// 4. subDeckId filter
// ---------------------------------------------------------------------------

describe('selectSkillForPractice — subDeckId filter', () => {
  it('only selects skills in the specified sub-deck', () => {
    const deck = makeDeck(['a', 'b', 'c'], [{ id: 'addition', skillIds: ['a', 'b'] }]);
    // All new — should pick from 'a', 'b' only
    const result = selectSkillForPractice(deck, [], 'addition', undefined);
    expect(['a', 'b']).toContain(result.skill.id);
    expect(result.skill.id).not.toBe('c');
  });

  it('picks first skill in sub-deck definition order', () => {
    const deck = makeDeck(['x', 'a', 'b'], [{ id: 'sub', skillIds: ['a', 'b'] }]);
    const result = selectSkillForPractice(deck, [], 'sub', undefined);
    // 'a' comes before 'b' in deck.skills (index 1 vs 2), so 'a' should be first
    expect(result.skill.id).toBe('a');
  });

  it('ignores skills outside the sub-deck even if they are due', () => {
    const deck = makeDeck(['outside', 'inside'], [{ id: 'sub', skillIds: ['inside'] }]);
    const now = Date.now();
    const states: PlayerSkillState[] = [
      makeSkillState('outside', 'test_deck', {
        cardState: 'review',
        nextReviewAt: now - 9999,
        due: now - 9999,
        retrievability: 0.1,
      }),
    ];
    // inside is still new; outside is due but NOT in sub-deck
    const result = selectSkillForPractice(deck, states, 'sub', undefined);
    expect(result.skill.id).toBe('inside');
    expect(result.reason).toBe('new');
  });
});

// ---------------------------------------------------------------------------
// 5. Anti-repeat: lastSkillId excluded
// ---------------------------------------------------------------------------

describe('selectSkillForPractice — anti-repeat', () => {
  it('does not select the lastSkillId when other options exist', () => {
    const deck = makeDeck(['a', 'b', 'c']);
    // All new — should never return 'a' when lastSkillId='a', as 'b' is available
    const result = selectSkillForPractice(deck, [], undefined, 'a');
    expect(result.skill.id).not.toBe('a');
  });

  it('selects lastSkillId if it is the only option', () => {
    const deck = makeDeck(['only']);
    const result = selectSkillForPractice(deck, [], undefined, 'only');
    // With only one skill, it must fall back to it
    expect(result.skill.id).toBe('only');
  });

  it('anti-repeat works with relearning skills', () => {
    const deck = makeDeck(['r1', 'r2']);
    const states: PlayerSkillState[] = [
      makeSkillState('r1', 'test_deck', { cardState: 'relearning' }),
      makeSkillState('r2', 'test_deck', { cardState: 'relearning' }),
    ];
    const result = selectSkillForPractice(deck, states, undefined, 'r1');
    expect(result.skill.id).toBe('r2');
    expect(result.reason).toBe('relearning');
  });
});

// ---------------------------------------------------------------------------
// 6. MAX_LEARNING cap
// ---------------------------------------------------------------------------

describe('selectSkillForPractice — MAX_LEARNING cap', () => {
  it('does not introduce a new skill when 8 skills are in learning state', () => {
    const skillIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'new_one'];
    const deck = makeDeck(skillIds);
    // First 8 are in learning state
    const states: PlayerSkillState[] = skillIds.slice(0, 8).map((id) =>
      makeSkillState(id, 'test_deck', { cardState: 'learning' }),
    );
    // 'new_one' has no state (defaults to 'new')
    // With 8 learning, new should NOT be introduced
    const result = selectSkillForPractice(deck, states, undefined, undefined);
    // Should NOT pick 'new_one' — instead picks from ahead learning
    expect(result.skill.id).not.toBe('new_one');
  });

  it('introduces new skill when only 7 are learning (below cap)', () => {
    const skillIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 'new_one'];
    const deck = makeDeck(skillIds);
    const states: PlayerSkillState[] = skillIds.slice(0, 7).map((id) =>
      makeSkillState(id, 'test_deck', { cardState: 'learning' }),
    );
    // 7 learning < 8 cap → should introduce new_one
    const result = selectSkillForPractice(deck, states, undefined, undefined);
    expect(result.skill.id).toBe('new_one');
    expect(result.reason).toBe('new');
  });
});

// ---------------------------------------------------------------------------
// 7. Reason field accuracy
// ---------------------------------------------------------------------------

describe('selectSkillForPractice — reason field', () => {
  it('reason is "relearning" when relearning skill selected', () => {
    const deck = makeDeck(['s1']);
    const states = [makeSkillState('s1', 'test_deck', { cardState: 'relearning' })];
    expect(selectSkillForPractice(deck, states).reason).toBe('relearning');
  });

  it('reason is "due" when due review skill selected', () => {
    const deck = makeDeck(['s1']);
    const now = Date.now();
    const states = [makeSkillState('s1', 'test_deck', {
      cardState: 'review',
      due: now - 1,
      nextReviewAt: now - 1,
      retrievability: 0.5,
    })];
    expect(selectSkillForPractice(deck, states).reason).toBe('due');
  });

  it('reason is "new" when new skill selected', () => {
    const deck = makeDeck(['s1']);
    expect(selectSkillForPractice(deck, []).reason).toBe('new');
  });
});
