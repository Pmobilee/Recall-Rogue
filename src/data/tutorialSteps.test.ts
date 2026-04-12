/**
 * Unit tests for tutorialSteps.ts
 *
 * Tests the step predicate functions (showWhen, doneWhen, getMessage)
 * for both COMBAT_TUTORIAL_STEPS and STUDY_TUTORIAL_STEPS.
 *
 * This is pure-logic testing — no Svelte store dependencies.
 * The tutorialService.ts integration tests are separate.
 */

import { describe, it, expect } from 'vitest'
import {
  COMBAT_TUTORIAL_STEPS,
  STUDY_TUTORIAL_STEPS,
} from './tutorialSteps'
import type { TutorialContext } from './tutorialSteps'

// ─── Context factories ─────────────────────────────────────────────────────────

/** Base combat context — turn 1, player_action, hand stage, no cards played. */
function makeCombatCtx(overrides: Partial<TutorialContext> = {}): TutorialContext {
  return {
    enemyName: 'Page Flutter',
    enemyCategory: 'common',
    playerHp: 100,
    playerMaxHp: 100,
    playerBlock: 0,
    apCurrent: 3,
    apMax: 3,
    handSize: 5,
    turnNumber: 1,
    encounterTurnNumber: 1,
    phase: 'player_action',
    cardsPlayedThisTurn: 0,
    cardsCorrectThisTurn: 0,
    chainLength: 0,
    isSurgeTurn: false,
    selectedCardType: null,
    selectedCardApCost: null,
    cardPlayStage: 'hand',
    quizVisible: false,
    hasPlayedQuickPlay: false,
    hasPlayedCharge: false,
    hasAnsweredWrong: false,
    hasSeenCombatTutorial: false,
    hasSeenStudyTutorial: false,
    mode: 'combat',
    enemyIntentType: 'attack',
    enemyIntentValue: 8,
    studyQuestionsAnswered: 0,
    studySessionComplete: false,
    ...overrides,
  }
}

/** Base study context. */
function makeStudyCtx(overrides: Partial<TutorialContext> = {}): TutorialContext {
  return {
    enemyName: null,
    enemyCategory: null,
    playerHp: 100,
    playerMaxHp: 100,
    playerBlock: 0,
    apCurrent: 0,
    apMax: 0,
    handSize: 0,
    turnNumber: 0,
    encounterTurnNumber: 0,
    phase: null,
    cardsPlayedThisTurn: 0,
    cardsCorrectThisTurn: 0,
    chainLength: 0,
    isSurgeTurn: false,
    selectedCardType: null,
    selectedCardApCost: null,
    cardPlayStage: null,
    quizVisible: false,
    hasPlayedQuickPlay: false,
    hasPlayedCharge: false,
    hasAnsweredWrong: false,
    hasSeenCombatTutorial: false,
    hasSeenStudyTutorial: false,
    mode: 'study',
    enemyIntentType: null,
    enemyIntentValue: null,
    studyQuestionsAnswered: 0,
    studySessionComplete: false,
    ...overrides,
  }
}

// ─── Helper: find step by ID ──────────────────────────────────────────────────

function combatStep(id: string) {
  const s = COMBAT_TUTORIAL_STEPS.find((s) => s.id === id)
  if (!s) throw new Error(`No combat step with id '${id}'`)
  return s
}

function studyStep(id: string) {
  const s = STUDY_TUTORIAL_STEPS.find((s) => s.id === id)
  if (!s) throw new Error(`No study step with id '${id}'`)
  return s
}

// ─── COMBAT_TUTORIAL_STEPS ────────────────────────────────────────────────────

describe('COMBAT_TUTORIAL_STEPS — structure', () => {
  it('all steps have unique IDs', () => {
    const ids = COMBAT_TUTORIAL_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all steps have mode: combat', () => {
    expect(COMBAT_TUTORIAL_STEPS.every((s) => s.mode === 'combat')).toBe(true)
  })

  it('all steps define minDisplayMs > 0', () => {
    expect(COMBAT_TUTORIAL_STEPS.every((s) => s.minDisplayMs > 0)).toBe(true)
  })

  it('has at least 10 combat steps', () => {
    expect(COMBAT_TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(10)
  })
})

describe('enemy_intro step', () => {
  const step = combatStep('enemy_intro')

  it('shows on turn 1, player_action, no cards played', () => {
    expect(step.showWhen(makeCombatCtx())).toBe(true)
  })

  it('does NOT show after cards played', () => {
    expect(step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 1 }))).toBe(false)
  })

  it('does NOT show on turn 2+', () => {
    expect(step.showWhen(makeCombatCtx({ encounterTurnNumber: 2 }))).toBe(false)
  })

  it('does NOT show during enemy turn', () => {
    expect(step.showWhen(makeCombatCtx({ phase: 'enemy_turn' }))).toBe(false)
  })

  it('getMessage includes enemy name', () => {
    const msg = step.getMessage(makeCombatCtx({ enemyName: 'Page Flutter' }))
    expect(msg).toContain('Page Flutter')
  })

  it('getMessage returns null when no enemy name', () => {
    expect(step.getMessage(makeCombatCtx({ enemyName: null }))).toBeNull()
  })

  it('doneWhen fires when cards played', () => {
    expect(step.doneWhen(makeCombatCtx({ cardsPlayedThisTurn: 1 }))).toBe(true)
  })

  it('doneWhen fires on turn 2+', () => {
    expect(step.doneWhen(makeCombatCtx({ encounterTurnNumber: 2 }))).toBe(true)
  })

  it('doneWhen false when no cards played, turn 1', () => {
    expect(step.doneWhen(makeCombatCtx())).toBe(false)
  })

  it('autoDismiss is true', () => {
    expect(step.autoDismiss).toBe(true)
  })

  it('spotlight is false (enemy is in Phaser canvas, not DOM)', () => {
    expect(step.spotlight).toBe(false)
  })

  it('anchor targets enemy-sprite with position below', () => {
    expect(step.anchor.target).toBe('enemy-sprite')
    expect(step.anchor.position).toBe('below')
  })
})

describe('hand_intro step', () => {
  const step = combatStep('hand_intro')

  it('shows on turn 1, player_action, hand stage, no cards played', () => {
    expect(step.showWhen(makeCombatCtx())).toBe(true)
  })

  it('does NOT show if card is selected', () => {
    expect(step.showWhen(makeCombatCtx({ cardPlayStage: 'selected' }))).toBe(false)
  })

  it('does NOT show on turn 2+', () => {
    expect(step.showWhen(makeCombatCtx({ encounterTurnNumber: 2 }))).toBe(false)
  })

  it('getMessage includes AP count', () => {
    const msg = step.getMessage(makeCombatCtx({ apMax: 3 }))
    expect(msg).toContain('3 AP')
  })

  it('doneWhen fires when card selected', () => {
    expect(step.doneWhen(makeCombatCtx({ cardPlayStage: 'selected' }))).toBe(true)
  })

  it('doneWhen fires when card played', () => {
    expect(step.doneWhen(makeCombatCtx({ cardsPlayedThisTurn: 1 }))).toBe(true)
  })

  it('spotlight is true (highlights the card hand)', () => {
    expect(step.spotlight).toBe(true)
  })

  it('anchor targets card-hand with position above', () => {
    expect(step.anchor.target).toBe('card-hand')
    expect(step.anchor.position).toBe('above')
  })
})

describe('tap_card step', () => {
  const step = combatStep('tap_card')

  it('shows on turn 1, player_action, hand stage, no cards played', () => {
    expect(step.showWhen(makeCombatCtx())).toBe(true)
  })

  it('shows on turn 2 (encounterTurnNumber ≤ 2)', () => {
    expect(step.showWhen(makeCombatCtx({ encounterTurnNumber: 2 }))).toBe(true)
  })

  it('does NOT show on turn 3+', () => {
    expect(step.showWhen(makeCombatCtx({ encounterTurnNumber: 3 }))).toBe(false)
  })

  it('does NOT show when card already selected', () => {
    expect(step.showWhen(makeCombatCtx({ cardPlayStage: 'selected' }))).toBe(false)
  })

  it('does NOT show when cards have been played', () => {
    expect(step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 1 }))).toBe(false)
  })
})

describe('card_selected step', () => {
  const step = combatStep('card_selected')

  it('shows when card is selected and no cards played yet on turn 1-2', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ cardPlayStage: 'selected', encounterTurnNumber: 1 })
      )
    ).toBe(true)
  })

  it('does NOT show before card is selected', () => {
    expect(step.showWhen(makeCombatCtx({ cardPlayStage: 'hand' }))).toBe(false)
  })

  it('getMessage mentions card type and cost', () => {
    const msg = step.getMessage(
      makeCombatCtx({ selectedCardType: 'attack', selectedCardApCost: 1 })
    )
    expect(msg).toContain('attack')
    expect(msg).toContain('1 AP')
  })

  it('getMessage uses fallbacks when type/cost are null', () => {
    const msg = step.getMessage(
      makeCombatCtx({ selectedCardType: null, selectedCardApCost: null })
    )
    expect(msg).not.toBeNull()
  })
})

describe('charge_intro step', () => {
  const step = combatStep('charge_explain')

  it('shows when quiz is visible and player has not charged yet', () => {
    expect(step.showWhen(makeCombatCtx({ quizVisible: true, hasPlayedCharge: false }))).toBe(true)
  })

  it('does NOT show when player has already charged', () => {
    expect(step.showWhen(makeCombatCtx({ quizVisible: true, hasPlayedCharge: true }))).toBe(false)
  })

  it('does NOT show when quiz is hidden', () => {
    expect(step.showWhen(makeCombatCtx({ quizVisible: false, hasPlayedCharge: false }))).toBe(false)
  })
})

describe('wrong_answer step', () => {
  const step = combatStep('quiz_wrong_ok')

  it('shows after player answered wrong during player_action phase', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ hasAnsweredWrong: true, phase: 'player_action' })
      )
    ).toBe(true)
  })

  it('does NOT show if player has not answered wrong', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ hasAnsweredWrong: false, phase: 'player_action' })
      )
    ).toBe(false)
  })
})

describe('surge_intro step', () => {
  const step = combatStep('surge_intro')

  it('shows during surge turn, player_action, no cards played', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ isSurgeTurn: true, phase: 'player_action', cardsPlayedThisTurn: 0 })
      )
    ).toBe(true)
  })

  it('does NOT show when not a surge turn', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ isSurgeTurn: false, phase: 'player_action', cardsPlayedThisTurn: 0 })
      )
    ).toBe(false)
  })

  it('doneWhen fires when card played', () => {
    expect(
      step.doneWhen(
        makeCombatCtx({ isSurgeTurn: true, cardsPlayedThisTurn: 1 })
      )
    ).toBe(true)
  })

  it('doneWhen fires when surge ends', () => {
    expect(
      step.doneWhen(
        makeCombatCtx({ isSurgeTurn: false })
      )
    ).toBe(true)
  })

  it('anchor position is center (no DOM target to spotlight)', () => {
    expect(step.anchor.position).toBe('center')
  })
})

// ─── STUDY_TUTORIAL_STEPS ─────────────────────────────────────────────────────

describe('STUDY_TUTORIAL_STEPS — structure', () => {
  it('all steps have unique IDs', () => {
    const ids = STUDY_TUTORIAL_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all steps have mode: study', () => {
    expect(STUDY_TUTORIAL_STEPS.every((s) => s.mode === 'study')).toBe(true)
  })

  it('has at least 4 study steps', () => {
    expect(STUDY_TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(4)
  })
})

describe('study_intro step', () => {
  const step = studyStep('study_intro')

  it('shows when zero questions answered', () => {
    expect(step.showWhen(makeStudyCtx({ studyQuestionsAnswered: 0 }))).toBe(true)
  })

  it('does NOT show after first question answered', () => {
    expect(step.showWhen(makeStudyCtx({ studyQuestionsAnswered: 1 }))).toBe(false)
  })

  it('doneWhen fires when first question answered', () => {
    expect(step.doneWhen(makeStudyCtx({ studyQuestionsAnswered: 1 }))).toBe(true)
  })

  it('getMessage returns a non-null string', () => {
    expect(step.getMessage(makeStudyCtx())).not.toBeNull()
  })
})

describe('study_answer step', () => {
  const step = studyStep('study_answer')

  it('shows after exactly 1 question answered', () => {
    expect(step.showWhen(makeStudyCtx({ studyQuestionsAnswered: 1 }))).toBe(true)
  })

  it('does NOT show at 0 questions', () => {
    expect(step.showWhen(makeStudyCtx({ studyQuestionsAnswered: 0 }))).toBe(false)
  })

  it('does NOT show at 2+ questions', () => {
    expect(step.showWhen(makeStudyCtx({ studyQuestionsAnswered: 2 }))).toBe(false)
  })
})

describe('study_fsrs step', () => {
  const step = studyStep('study_fsrs')

  it('shows after 3+ questions, session not complete', () => {
    expect(
      step.showWhen(makeStudyCtx({ studyQuestionsAnswered: 3, studySessionComplete: false }))
    ).toBe(true)
  })

  it('does NOT show when session is complete', () => {
    expect(
      step.showWhen(makeStudyCtx({ studyQuestionsAnswered: 5, studySessionComplete: true }))
    ).toBe(false)
  })

  it('does NOT show before 3 questions', () => {
    expect(
      step.showWhen(makeStudyCtx({ studyQuestionsAnswered: 2, studySessionComplete: false }))
    ).toBe(false)
  })
})
