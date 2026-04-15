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
    // Optional extended fields with safe defaults
    enemyPassives: [],
    relicCount: 0,
    fogLevel: null,
    fogState: null,
    drawPileCount: 10,
    discardPileCount: 0,
    musicCategory: null,
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
    // Optional extended fields with safe defaults
    enemyPassives: [],
    relicCount: 0,
    fogLevel: null,
    fogState: null,
    drawPileCount: 10,
    discardPileCount: 0,
    musicCategory: null,
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

  it('all steps define minDisplayMs >= 0 (proactive steps use 0)', () => {
    expect(COMBAT_TUTORIAL_STEPS.every((s) => s.minDisplayMs >= 0)).toBe(true)
  })

  it('has at least 25 combat steps', () => {
    expect(COMBAT_TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(25)
  })

  it('card_selected_qp comes before post_quick_play in step order', () => {
    const qpIdx = COMBAT_TUTORIAL_STEPS.findIndex((s) => s.id === 'card_selected_qp')
    const postQpIdx = COMBAT_TUTORIAL_STEPS.findIndex((s) => s.id === 'post_quick_play')
    expect(qpIdx).toBeGreaterThanOrEqual(0)
    expect(postQpIdx).toBeGreaterThanOrEqual(0)
    expect(qpIdx).toBeLessThan(postQpIdx)
  })

  it('hand_intro comes before ap_intro in step order', () => {
    const handIdx = COMBAT_TUTORIAL_STEPS.findIndex((s) => s.id === 'hand_intro')
    const apIdx = COMBAT_TUTORIAL_STEPS.findIndex((s) => s.id === 'ap_intro')
    expect(handIdx).toBeGreaterThanOrEqual(0)
    expect(apIdx).toBeGreaterThanOrEqual(0)
    expect(handIdx).toBeLessThan(apIdx)
  })

  it('no step with id card_selected exists (replaced by card_selected_qp + charge flow)', () => {
    expect(COMBAT_TUTORIAL_STEPS.find((s) => s.id === 'card_selected')).toBeUndefined()
  })

  it('no step with id card_selected_charge exists (removed)', () => {
    expect(COMBAT_TUTORIAL_STEPS.find((s) => s.id === 'card_selected_charge')).toBeUndefined()
  })

  it('no step with id post_first_play exists (removed)', () => {
    expect(COMBAT_TUTORIAL_STEPS.find((s) => s.id === 'post_first_play')).toBeUndefined()
  })

  it('new steps post_quick_play, select_for_charge, charge_prompt, post_charge are present', () => {
    const ids = COMBAT_TUTORIAL_STEPS.map((s) => s.id)
    expect(ids).toContain('post_quick_play')
    expect(ids).toContain('select_for_charge')
    expect(ids).toContain('charge_prompt')
    expect(ids).toContain('post_charge')
  })
})

describe('enemy_intro step', () => {
  const step = combatStep('enemy_intro')

  it('shows on turn 1, player_action', () => {
    expect(step.showWhen(makeCombatCtx())).toBe(true)
  })

  it('does NOT show on turn 2+', () => {
    expect(step.showWhen(makeCombatCtx({ encounterTurnNumber: 2 }))).toBe(false)
  })

  it('does NOT show during enemy turn', () => {
    expect(step.showWhen(makeCombatCtx({ phase: 'enemy_turn' }))).toBe(false)
  })

  it('showWhen does not depend on cardsPlayedThisTurn', () => {
    // proactive step — cardsPlayedThisTurn has no effect on showWhen
    expect(step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 5 }))).toBe(true)
  })

  it('getMessage includes enemy name', () => {
    const msg = step.getMessage(makeCombatCtx({ enemyName: 'Page Flutter' }))
    expect(msg).toContain('Page Flutter')
  })

  it('getMessage uses "facing" text', () => {
    const msg = step.getMessage(makeCombatCtx({ enemyName: 'Page Flutter' }))
    expect(msg).toContain('facing')
  })

  it('getMessage returns null when no enemy name', () => {
    expect(step.getMessage(makeCombatCtx({ enemyName: null }))).toBeNull()
  })

  it('doneWhen always returns true (proactive step)', () => {
    expect(step.doneWhen(makeCombatCtx())).toBe(true)
    expect(step.doneWhen(makeCombatCtx({ encounterTurnNumber: 2 }))).toBe(true)
    expect(step.doneWhen(makeCombatCtx({ cardsPlayedThisTurn: 3 }))).toBe(true)
  })

  it('autoDismiss is false (requires manual Got it)', () => {
    expect(step.autoDismiss).toBe(false)
  })

  it('proactive is true', () => {
    expect(step.proactive).toBe(true)
  })

  it('spotlight is false (enemy is in Phaser canvas, not DOM)', () => {
    expect(step.spotlight).toBe(false)
  })

  it('anchor targets enemy-sprite with position below', () => {
    expect(step.anchor.target).toBe('enemy-sprite')
    expect(step.anchor.position).toBe('below')
  })
})

describe('enemy_passive_intro step', () => {
  const step = combatStep('enemy_passive_intro')

  it('shows on turn 1, player_action', () => {
    expect(step.showWhen(makeCombatCtx())).toBe(true)
  })

  it('does NOT show on turn 2+', () => {
    expect(step.showWhen(makeCombatCtx({ encounterTurnNumber: 2 }))).toBe(false)
  })

  it('getMessage returns null when enemyPassives is empty (step skip)', () => {
    expect(step.getMessage(makeCombatCtx({ enemyPassives: [] }))).toBeNull()
  })

  it('getMessage returns null when enemyPassives is undefined (step skip)', () => {
    const ctx = makeCombatCtx()
    delete (ctx as Partial<TutorialContext>).enemyPassives
    expect(step.getMessage(ctx as TutorialContext)).toBeNull()
  })

  it('getMessage includes passive name when enemyPassives populated', () => {
    const msg = step.getMessage(
      makeCombatCtx({ enemyName: 'Page Flutter', enemyPassives: ['Enrage'] })
    )
    expect(msg).not.toBeNull()
    expect(msg).toContain('Enrage')
    expect(msg).toContain('Page Flutter')
  })

  it('doneWhen always returns true (proactive step)', () => {
    expect(step.doneWhen(makeCombatCtx())).toBe(true)
  })

  it('autoDismiss is false', () => {
    expect(step.autoDismiss).toBe(false)
  })

  it('blockInput is true', () => {
    expect(step.blockInput).toBe(true)
  })

  it('proactive is true', () => {
    expect(step.proactive).toBe(true)
  })
})

describe('enemy_intent_intro step', () => {
  const step = combatStep('enemy_intent_intro')

  it('shows on turn 1, player_action, with intent type set', () => {
    expect(step.showWhen(makeCombatCtx({ enemyIntentType: 'attack' }))).toBe(true)
  })

  it('does NOT show when enemyIntentType is null', () => {
    expect(step.showWhen(makeCombatCtx({ enemyIntentType: null }))).toBe(false)
  })

  it('does NOT show on turn 2+', () => {
    expect(step.showWhen(makeCombatCtx({ encounterTurnNumber: 2 }))).toBe(false)
  })

  it('getMessage includes intent description and damage value for attack', () => {
    const msg = step.getMessage(
      makeCombatCtx({ enemyIntentType: 'attack', enemyIntentValue: 12 })
    )
    expect(msg).not.toBeNull()
    expect(msg).toContain('12')
  })

  it('getMessage includes card-type guidance for attack intent', () => {
    const msg = step.getMessage(
      makeCombatCtx({ enemyIntentType: 'attack', enemyIntentValue: 8 })
    )
    expect(msg).not.toBeNull()
    expect(msg).toContain('Shield')
  })

  it('getMessage includes card-type guidance for buff intent', () => {
    const msg = step.getMessage(
      makeCombatCtx({ enemyIntentType: 'buff' })
    )
    expect(msg).not.toBeNull()
    expect(msg).toContain('Attack')
  })

  it('getMessage always returns a non-null string (never skips)', () => {
    // even with null intentType, falls back to "take an action"
    const msg = step.getMessage(makeCombatCtx({ enemyIntentType: null }))
    expect(msg).not.toBeNull()
    expect(msg).toContain('take an action')
  })

  it('doneWhen always returns true (proactive step)', () => {
    expect(step.doneWhen(makeCombatCtx())).toBe(true)
  })

  it('autoDismiss is false', () => {
    expect(step.autoDismiss).toBe(false)
  })

  it('proactive is true', () => {
    expect(step.proactive).toBe(true)
  })
})

describe('ap_intro step', () => {
  const step = combatStep('ap_intro')

  it('shows on turn 1, player_action', () => {
    expect(step.showWhen(makeCombatCtx())).toBe(true)
  })

  it('does NOT show on turn 2+', () => {
    expect(step.showWhen(makeCombatCtx({ encounterTurnNumber: 2 }))).toBe(false)
  })

  it('getMessage includes apCurrent value (not apMax)', () => {
    const msg = step.getMessage(makeCombatCtx({ apCurrent: 4, apMax: 3 }))
    expect(msg).not.toBeNull()
    expect(msg).toContain('4')
    expect(msg).toContain('Action Points')
  })

  it('getMessage uses apCurrent not apMax when they differ', () => {
    // apCurrent=2, apMax=4 — message should contain "2", not "4"
    const msg = step.getMessage(makeCombatCtx({ apCurrent: 2, apMax: 4 })) ?? ''
    expect(msg).toContain('2')
    // "4" should NOT appear as the AP count (apMax not referenced)
    // Note: "4" might appear in other contexts, so we check the specific phrase
    expect(msg).toContain('2 Action Points')
  })

  it('doneWhen always returns true (proactive step)', () => {
    expect(step.doneWhen(makeCombatCtx())).toBe(true)
  })

  it('autoDismiss is false', () => {
    expect(step.autoDismiss).toBe(false)
  })

  it('proactive is true', () => {
    expect(step.proactive).toBe(true)
  })

  it('blockInput is true', () => {
    expect(step.blockInput).toBe(true)
  })
})

describe('hand_intro step', () => {
  const step = combatStep('hand_intro')

  it('shows on turn 1, player_action', () => {
    expect(step.showWhen(makeCombatCtx())).toBe(true)
  })

  it('does NOT show on turn 2+', () => {
    expect(step.showWhen(makeCombatCtx({ encounterTurnNumber: 2 }))).toBe(false)
  })

  it('showWhen does not depend on cardPlayStage (proactive step)', () => {
    expect(step.showWhen(makeCombatCtx({ cardPlayStage: 'selected' }))).toBe(true)
  })

  it('getMessage returns non-null string about Quick Play and Charge', () => {
    const msg = step.getMessage(makeCombatCtx())
    expect(msg).not.toBeNull()
    expect(msg).toContain('Quick Play')
    expect(msg).toContain('Charge')
  })

  it('doneWhen always returns true (proactive step)', () => {
    expect(step.doneWhen(makeCombatCtx())).toBe(true)
    expect(step.doneWhen(makeCombatCtx({ cardPlayStage: 'selected' }))).toBe(true)
    expect(step.doneWhen(makeCombatCtx({ cardsPlayedThisTurn: 1 }))).toBe(true)
  })

  it('autoDismiss is false (requires manual Got it)', () => {
    expect(step.autoDismiss).toBe(false)
  })

  it('proactive is true', () => {
    expect(step.proactive).toBe(true)
  })

  it('blockInput is true', () => {
    expect(step.blockInput).toBe(true)
  })

  it('spotlight is true (highlights the card hand)', () => {
    expect(step.spotlight).toBe(true)
  })

  it('anchor targets card-hand with position above', () => {
    expect(step.anchor.target).toBe('card-hand')
    expect(step.anchor.position).toBe('above')
  })
})

describe('tap_card_prompt step', () => {
  const step = combatStep('tap_card_prompt')

  it('shows on turn 1, player_action, hand stage, no cards played', () => {
    expect(step.showWhen(makeCombatCtx())).toBe(true)
  })

  it('shows on turn 2 (encounterTurnNumber <= 2)', () => {
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

describe('card_selected_qp step', () => {
  const step = combatStep('card_selected_qp')

  it('shows when card is selected and no play actions taken yet', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ cardPlayStage: 'selected', encounterTurnNumber: 1 })
      )
    ).toBe(true)
  })

  it('does NOT show before card is selected', () => {
    expect(step.showWhen(makeCombatCtx({ cardPlayStage: 'hand' }))).toBe(false)
  })

  it('does NOT show when player has already quick-played', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardPlayStage: 'selected', hasPlayedQuickPlay: true }))
    ).toBe(false)
  })

  it('does NOT show when player has already charged', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardPlayStage: 'selected', hasPlayedCharge: true }))
    ).toBe(false)
  })

  it('getMessage mentions card type and AP cost', () => {
    const msg = step.getMessage(
      makeCombatCtx({ selectedCardType: 'attack', selectedCardApCost: 1 })
    )
    expect(msg).toContain('attack')
    expect(msg).toContain('1 AP')
  })

  it('getMessage mentions Quick Play', () => {
    const msg = step.getMessage(makeCombatCtx({ selectedCardType: 'shield', selectedCardApCost: 2 }))
    expect(msg).toContain('Quick Play')
  })

  it('getMessage uses fallbacks when type/cost are null', () => {
    const msg = step.getMessage(
      makeCombatCtx({ selectedCardType: null, selectedCardApCost: null })
    )
    expect(msg).not.toBeNull()
  })

  it('doneWhen fires when hasPlayedQuickPlay is true', () => {
    expect(step.doneWhen(makeCombatCtx({ hasPlayedQuickPlay: true }))).toBe(true)
  })

  it('doneWhen fires when hasPlayedCharge is true', () => {
    expect(step.doneWhen(makeCombatCtx({ hasPlayedCharge: true }))).toBe(true)
  })

  it('doneWhen fires when cardsPlayedThisTurn > 0', () => {
    expect(step.doneWhen(makeCombatCtx({ cardsPlayedThisTurn: 1 }))).toBe(true)
  })

  it('doneWhen does NOT fire when no play actions taken', () => {
    expect(
      step.doneWhen(
        makeCombatCtx({ hasPlayedQuickPlay: false, hasPlayedCharge: false, cardsPlayedThisTurn: 0 })
      )
    ).toBe(false)
  })

  it('autoDismiss is true', () => {
    expect(step.autoDismiss).toBe(true)
  })
})

describe('post_quick_play step', () => {
  const step = combatStep('post_quick_play')

  it('shows when at least 1 card played during player_action', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 1, phase: 'player_action' }))
    ).toBe(true)
  })

  it('does NOT show before any cards played', () => {
    expect(step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 0 }))).toBe(false)
  })

  it('does NOT show during enemy turn', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 1, phase: 'enemy_turn' }))
    ).toBe(false)
  })

  it('getMessage returns quick-play message when neither charge nor wrong answer', () => {
    const msg = step.getMessage(
      makeCombatCtx({ hasPlayedCharge: false, hasAnsweredWrong: false })
    )
    expect(msg).not.toBeNull()
    expect(msg).toContain('Quick Play')
    expect(msg).toContain('Charge')
  })

  it('getMessage adapts when player charged correctly instead of QP', () => {
    const msg = step.getMessage(
      makeCombatCtx({ hasPlayedCharge: true, hasAnsweredWrong: false })
    )
    expect(msg).not.toBeNull()
    expect(msg).toContain('1.5x')
    expect(msg).toContain('Quick Play')
  })

  it('getMessage adapts when player charged and answered wrong', () => {
    const msg = step.getMessage(
      makeCombatCtx({ hasPlayedCharge: true, hasAnsweredWrong: true })
    )
    expect(msg).not.toBeNull()
    expect(msg).toContain('reduced power')
    expect(msg).toContain('Quick Play')
  })

  it('doneWhen always returns true (proactive step)', () => {
    expect(step.doneWhen(makeCombatCtx())).toBe(true)
  })

  it('autoDismiss is false (requires manual Got it)', () => {
    expect(step.autoDismiss).toBe(false)
  })

  it('proactive is true', () => {
    expect(step.proactive).toBe(true)
  })

  it('blockInput is true', () => {
    expect(step.blockInput).toBe(true)
  })
})

describe('select_for_charge step', () => {
  const step = combatStep('select_for_charge')

  it('shows on turn 1 after 1 card played, hand stage, player_action', () => {
    expect(
      step.showWhen(
        makeCombatCtx({
          phase: 'player_action',
          cardPlayStage: 'hand',
          cardsPlayedThisTurn: 1,
          encounterTurnNumber: 1,
        })
      )
    ).toBe(true)
  })

  it('does NOT show before any cards played (cardsPlayedThisTurn === 0)', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardPlayStage: 'hand', cardsPlayedThisTurn: 0, encounterTurnNumber: 1 }))
    ).toBe(false)
  })

  it('does NOT show when card is already selected', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ cardPlayStage: 'selected', cardsPlayedThisTurn: 1, encounterTurnNumber: 1 })
      )
    ).toBe(false)
  })

  it('does NOT show on turn 2+ (encounterTurnNumber > 1)', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ cardPlayStage: 'hand', cardsPlayedThisTurn: 1, encounterTurnNumber: 2 })
      )
    ).toBe(false)
  })

  it('getMessage returns charge instruction when hasPlayedCharge is false', () => {
    const msg = step.getMessage(makeCombatCtx({ hasPlayedCharge: false }))
    expect(msg).not.toBeNull()
    expect(msg).toContain('Charge')
  })

  it('getMessage adapts when player already charged on first card', () => {
    const msg = step.getMessage(makeCombatCtx({ hasPlayedCharge: true }))
    expect(msg).not.toBeNull()
    expect(msg).toContain('Quick Play')
  })

  it('doneWhen fires when card becomes selected', () => {
    expect(step.doneWhen(makeCombatCtx({ cardPlayStage: 'selected' }))).toBe(true)
  })

  it('doneWhen fires when 2+ cards played', () => {
    expect(step.doneWhen(makeCombatCtx({ cardsPlayedThisTurn: 2 }))).toBe(true)
  })

  it('doneWhen does NOT fire when still at hand stage with 1 card played', () => {
    expect(
      step.doneWhen(makeCombatCtx({ cardPlayStage: 'hand', cardsPlayedThisTurn: 1 }))
    ).toBe(false)
  })

  it('autoDismiss is true', () => {
    expect(step.autoDismiss).toBe(true)
  })
})

describe('charge_prompt step', () => {
  const step = combatStep('charge_prompt')

  it('shows when card selected, 1+ cards played, turn 1', () => {
    expect(
      step.showWhen(
        makeCombatCtx({
          cardPlayStage: 'selected',
          cardsPlayedThisTurn: 1,
          encounterTurnNumber: 1,
        })
      )
    ).toBe(true)
  })

  it('does NOT show before a card is selected', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ cardPlayStage: 'hand', cardsPlayedThisTurn: 1, encounterTurnNumber: 1 })
      )
    ).toBe(false)
  })

  it('does NOT show when no cards played yet', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ cardPlayStage: 'selected', cardsPlayedThisTurn: 0, encounterTurnNumber: 1 })
      )
    ).toBe(false)
  })

  it('does NOT show on turn 2+ (encounterTurnNumber > 1)', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ cardPlayStage: 'selected', cardsPlayedThisTurn: 1, encounterTurnNumber: 2 })
      )
    ).toBe(false)
  })

  it('getMessage returns drag-upward charge instruction when not yet charged', () => {
    const msg = step.getMessage(makeCombatCtx({ hasPlayedCharge: false }))
    expect(msg).not.toBeNull()
    expect(msg).toContain('Charge')
    expect(msg).toContain('+1')
  })

  it('getMessage adapts when player already charged — suggests Quick Play', () => {
    const msg = step.getMessage(makeCombatCtx({ hasPlayedCharge: true }))
    expect(msg).not.toBeNull()
    expect(msg).toContain('Quick Play')
  })

  it('doneWhen fires when card is deselected', () => {
    expect(
      step.doneWhen(makeCombatCtx({ cardPlayStage: 'hand', cardsPlayedThisTurn: 1 }))
    ).toBe(true)
  })

  it('doneWhen fires when 2+ cards played', () => {
    expect(
      step.doneWhen(makeCombatCtx({ cardPlayStage: 'selected', cardsPlayedThisTurn: 2 }))
    ).toBe(true)
  })

  it('doneWhen does NOT fire when still selected with only 1 card played', () => {
    expect(
      step.doneWhen(makeCombatCtx({ cardPlayStage: 'selected', cardsPlayedThisTurn: 1 }))
    ).toBe(false)
  })

  it('autoDismiss is true', () => {
    expect(step.autoDismiss).toBe(true)
  })
})

describe('charge_explain step', () => {
  const step = combatStep('charge_explain')

  it('shows when quiz is visible', () => {
    expect(step.showWhen(makeCombatCtx({ quizVisible: true }))).toBe(true)
  })

  it('does NOT show when quiz is hidden', () => {
    expect(step.showWhen(makeCombatCtx({ quizVisible: false }))).toBe(false)
  })

  it('shows regardless of hasPlayedCharge value (no longer gated)', () => {
    // showWhen only checks quizVisible — hasPlayedCharge is irrelevant
    expect(step.showWhen(makeCombatCtx({ quizVisible: true, hasPlayedCharge: true }))).toBe(true)
    expect(step.showWhen(makeCombatCtx({ quizVisible: true, hasPlayedCharge: false }))).toBe(true)
  })

  it('doneWhen fires when quiz becomes hidden', () => {
    expect(step.doneWhen(makeCombatCtx({ quizVisible: false }))).toBe(true)
  })

  it('doneWhen does NOT fire while quiz is visible', () => {
    expect(step.doneWhen(makeCombatCtx({ quizVisible: true }))).toBe(false)
  })

  it('getMessage includes correct/wrong outcome text', () => {
    const msg = step.getMessage(makeCombatCtx())
    expect(msg).not.toBeNull()
    expect(msg).toContain('1.5x')
    expect(msg).toContain('reduced power')
  })

  it('autoDismiss is true', () => {
    expect(step.autoDismiss).toBe(true)
  })
})

describe('post_charge step', () => {
  const step = combatStep('post_charge')

  it('shows when 2+ cards played during player_action', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 2, phase: 'player_action' }))
    ).toBe(true)
  })

  it('does NOT show with fewer than 2 cards played', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 1, phase: 'player_action' }))
    ).toBe(false)
  })

  it('does NOT show during enemy turn', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 2, phase: 'enemy_turn' }))
    ).toBe(false)
  })

  it('getMessage returns correct-answer congratulations when no wrong answer', () => {
    const msg = step.getMessage(makeCombatCtx({ hasAnsweredWrong: false }))
    expect(msg).not.toBeNull()
    expect(msg).toContain('1.5x')
    expect(msg).toContain('Quick Play')
    expect(msg).toContain('Charge')
  })

  it('getMessage adapts when player answered wrong', () => {
    const msg = step.getMessage(makeCombatCtx({ hasAnsweredWrong: true }))
    expect(msg).not.toBeNull()
    expect(msg).toContain('reduced power')
    expect(msg).toContain('Quick Play')
    expect(msg).toContain('Charge')
  })

  it('doneWhen always returns true (proactive step)', () => {
    expect(step.doneWhen(makeCombatCtx())).toBe(true)
  })

  it('autoDismiss is false (requires manual Got it)', () => {
    expect(step.autoDismiss).toBe(false)
  })

  it('proactive is true', () => {
    expect(step.proactive).toBe(true)
  })

  it('blockInput is true', () => {
    expect(step.blockInput).toBe(true)
  })
})

describe('end_turn_prompt step', () => {
  const step = combatStep('end_turn_prompt')

  it('shows when 1+ cards played during player_action', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 1, phase: 'player_action' }))
    ).toBe(true)
  })

  it('does NOT show before any cards played', () => {
    expect(step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 0 }))).toBe(false)
  })

  it('does NOT show during enemy turn', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 1, phase: 'enemy_turn' }))
    ).toBe(false)
  })

  it('doneWhen fires when phase leaves player_action', () => {
    expect(step.doneWhen(makeCombatCtx({ phase: 'enemy_turn' }))).toBe(true)
  })

  it('doneWhen does NOT fire while still in player_action', () => {
    expect(step.doneWhen(makeCombatCtx({ phase: 'player_action' }))).toBe(false)
  })

  it('autoDismiss is false', () => {
    expect(step.autoDismiss).toBe(false)
  })

  it('proactive is true', () => {
    expect(step.proactive).toBe(true)
  })

  it('blockInput is true', () => {
    expect(step.blockInput).toBe(true)
  })

  it('getMessage mentions End Turn', () => {
    const msg = step.getMessage(makeCombatCtx())
    expect(msg).not.toBeNull()
    expect(msg).toContain('End Turn')
  })
})

describe('fog_meter_intro step', () => {
  const step = combatStep('fog_meter_intro')

  it('shows when fog is active and at least 1 card played', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 1, fogLevel: 5 }))
    ).toBe(true)
  })

  it('does NOT show when fogLevel is null (fog meter not present in this run)', () => {
    expect(
      step.showWhen(makeCombatCtx({ cardsPlayedThisTurn: 1, fogLevel: null }))
    ).toBe(false)
  })

  it('does NOT show before any cards played', () => {
    expect(step.showWhen(makeCombatCtx({ fogLevel: 5 }))).toBe(false)
  })

  it('getMessage returns null when fogLevel is null (step skip)', () => {
    expect(step.getMessage(makeCombatCtx({ fogLevel: null }))).toBeNull()
  })

  it('getMessage returns Focus Meter message when fogLevel is a number', () => {
    const msg = step.getMessage(makeCombatCtx({ fogLevel: 5 }))
    expect(msg).not.toBeNull()
    expect(msg).toContain('Focus Meter')
  })

  it('getMessage returns Focus Meter message even when fogLevel is 0', () => {
    const msg = step.getMessage(makeCombatCtx({ fogLevel: 0 }))
    expect(msg).not.toBeNull()
    expect(msg).toContain('Focus Meter')
  })

  it('doneWhen always returns true (proactive step)', () => {
    expect(step.doneWhen(makeCombatCtx())).toBe(true)
  })

  it('proactive is true', () => {
    expect(step.proactive).toBe(true)
  })

  it('blockInput is true', () => {
    expect(step.blockInput).toBe(true)
  })
})

describe('quiz_wrong_ok step', () => {
  const step = combatStep('quiz_wrong_ok')

  it('shows after player answered wrong during player_action phase on turn <= 3', () => {
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

  it('does NOT show on turn 4+ (encounterTurnNumber > 3)', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ hasAnsweredWrong: true, phase: 'player_action', encounterTurnNumber: 4 })
      )
    ).toBe(false)
  })

  it('shows on turn 3 (boundary)', () => {
    expect(
      step.showWhen(
        makeCombatCtx({ hasAnsweredWrong: true, phase: 'player_action', encounterTurnNumber: 3 })
      )
    ).toBe(true)
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
