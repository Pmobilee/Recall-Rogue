/**
 * AR-271 Integration Tests: Verify all 10 previously-disconnected mechanics
 * actually fire during gameplay (card mechanics, relic mechanics, status/aura effects).
 *
 * Each test verifies ONE mechanic fires. Focused integration tests — no UI rendering.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Card, CardRunState } from '../../src/data/card-types';
import type { EnemyTemplate, EnemyInstance } from '../../src/data/enemies';

import { createEnemy } from '../../src/services/enemyManager';
import { createDeck } from '../../src/services/deckManager';
import {
  startEncounter,
  playCardAction,
  endPlayerTurn,
  resetFactLastSeenEncounter,
} from '../../src/services/turnManager';
import {
  resetAura,
  adjustAura,
  getAuraState,
  getAuraLevel,
} from '../../src/services/knowledgeAuraSystem';
import {
  resetReviewQueue,
  addToReviewQueue,
  isReviewQueueFact,
} from '../../src/services/reviewQueueSystem';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEnemyTemplate(overrides?: Partial<EnemyTemplate>): EnemyTemplate {
  return {
    id: 'test_enemy',
    name: 'Test Enemy',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 100,
    intentPool: [{ type: 'attack', value: 1, weight: 1, telegraph: 'Strike' }],
    description: 'A test enemy for AR-271 integration tests.',
    ...overrides,
  };
}

function makeEnemy(): EnemyInstance {
  return createEnemy(makeEnemyTemplate(), 1);
}

function makeCard(overrides?: Partial<Card>): Card {
  return {
    id: 'card_test_1',
    factId: 'fact_test_1',
    cardType: 'attack',
    domain: 'science',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1.0,
    apCost: 1,
    ...overrides,
  };
}

function makeDeck(cards: Card[]): CardRunState {
  return createDeck(cards);
}

/**
 * Set up an encounter with `mainCard` guaranteed to be in hand.
 * Returns the turn state. Use `turnState.enemy` for HP checks.
 */
function setupEncounter(mainCard: Card, relicIds: Set<string> = new Set()) {
  const padding: Card[] = Array.from({ length: 19 }, (_, i) =>
    makeCard({ id: `pad_${i}`, factId: `pad_fact_${i}` })
  );
  const deck = makeDeck([mainCard, ...padding]);
  const enemy = makeEnemy();
  const turnState = startEncounter(deck, enemy);
  turnState.activeRelicIds = new Set(relicIds); // copy so mutations don't leak
  turnState.apCurrent = 20; // plenty of AP for all tests

  // Ensure the main card is in hand (startEncounter draws 5; inject if it ended up in draw pile)
  if (!turnState.deck.hand.find((c) => c.id === mainCard.id)) {
    const di = turnState.deck.drawPile.findIndex((c) => c.id === mainCard.id);
    if (di !== -1) {
      turnState.deck.hand.unshift(...turnState.deck.drawPile.splice(di, 1));
    } else {
      const ddi = turnState.deck.discardPile.findIndex((c) => c.id === mainCard.id);
      if (ddi !== -1) {
        turnState.deck.hand.unshift(...turnState.deck.discardPile.splice(ddi, 1));
      }
    }
  }
  return turnState;
}

/** Inject a card into the turnState hand (if not already present). */
function injectIntoHand(turnState: ReturnType<typeof setupEncounter>, card: Card) {
  if (!turnState.deck.hand.find((c) => c.id === card.id)) {
    const di = turnState.deck.drawPile.findIndex((c) => c.id === card.id);
    if (di !== -1) {
      turnState.deck.hand.push(...turnState.deck.drawPile.splice(di, 1));
    } else {
      const ddi = turnState.deck.discardPile.findIndex((c) => c.id === card.id);
      if (ddi !== -1) {
        turnState.deck.hand.push(...turnState.deck.discardPile.splice(ddi, 1));
      }
    }
  }
}

// ─── Before each: reset shared module state ──────────────────────────────────
beforeEach(() => {
  resetAura();
  resetReviewQueue();
  resetFactLastSeenEncounter(); // also resets _scarTissueStacks = 0 and _luckyCoinArmed = false
});

// ─────────────────────────────────────────────────────────────────────────────
// CARD MECHANIC WIRING
// ─────────────────────────────────────────────────────────────────────────────

describe('AR-271 Card Mechanic: Recall + Review Queue', () => {
  /**
   * Test 1a: Recall CC on a fact in the review queue deals bonus damage (30).
   * The review_queue_recall bonus path overrides mechanicBaseValue to 30.
   */
  it('Recall CC on a Review Queue fact deals bonus damage (30)', () => {
    const recallCard = makeCard({
      id: 'recall_card',
      factId: 'recall_review_fact',
      cardType: 'attack',
      mechanicId: 'recall',
      mechanicName: 'Recall',
      apCost: 1,
      baseEffectValue: 10,
    });

    const turnState = setupEncounter(recallCard);
    // Get the actual factId assigned to the card in hand (drawHand may reassign factIds)
    const cardInHand = turnState.deck.hand.find(c => c.id === 'recall_card');
    const factId = cardInHand?.factId ?? 'recall_review_fact';
    // Re-add after startEncounter (which resets the queue)
    addToReviewQueue(factId);
    expect(isReviewQueueFact(factId)).toBe(true);

    const result = playCardAction(turnState, 'recall_card', true, false, 'charge');

    expect(result.fizzled).toBe(false);
    expect(result.blocked).toBe(false);
    // Recall CC on review queue fact: 30 dmg (vs 20 for non-review-queue CC)
    expect(result.effect.damageDealt).toBe(30);
    // Review queue entry is cleared after correct charge
    expect(isReviewQueueFact(factId)).toBe(false);
  });

  /**
   * Test 1b: Recall CC on a non-review-queue fact deals normal CC damage (20).
   * Confirms the bonus ONLY fires when wasReviewQueueFact is true.
   */
  it('Recall CC on a non-Review-Queue fact deals 20 damage', () => {
    const factId = 'recall_normal_fact';
    const recallCard = makeCard({
      id: 'recall_normal',
      factId,
      cardType: 'attack',
      mechanicId: 'recall',
      mechanicName: 'Recall',
      apCost: 1,
      baseEffectValue: 10,
    });

    const turnState = setupEncounter(recallCard);
    // Do NOT add to review queue

    const result = playCardAction(turnState, 'recall_normal', true, false, 'charge');

    expect(result.fizzled).toBe(false);
    expect(result.effect.damageDealt).toBe(20);
  });

  /**
   * Test 1c: Wrong charge adds fact to review queue via AR-261 wiring.
   */
  it('wrong Charge adds the fact to the review queue', () => {
    const wrongCard = makeCard({
      id: 'wrong_card',
      factId: 'wrong_charge_queues',
      cardType: 'attack',
      apCost: 1,
      baseEffectValue: 8,
    });

    const turnState = setupEncounter(wrongCard);
    // Get the actual factId assigned to the card in hand (drawHand may reassign factIds)
    const cardInHand = turnState.deck.hand.find(c => c.id === 'wrong_card');
    const factId = cardInHand?.factId ?? 'wrong_charge_queues';
    expect(isReviewQueueFact(factId)).toBe(false);

    playCardAction(turnState, 'wrong_card', false, false, 'charge');

    expect(isReviewQueueFact(factId)).toBe(true);
  });
});

describe('AR-271 Card Mechanic: Knowledge Ward + Charges Counter', () => {
  /**
   * Test 2a: Knowledge Ward CC block scales with correct Charges this encounter.
   * correctChargesForResolver = chargesCorrectThisEncounter + 1 (pre-incremented in turnManager).
   * With 0 prior correct charges: resolver receives 1 → 10 × 1 = 10 block.
   */
  it('Knowledge Ward CC block = 10 when no prior correct Charges (clamped to min 1)', () => {
    const kwCard = makeCard({
      id: 'kw_card_0',
      factId: 'kw_fact_0',
      cardType: 'shield',
      mechanicId: 'knowledge_ward',
      mechanicName: 'Knowledge Ward',
      apCost: 1,
      baseEffectValue: 6,
    });

    const turnState = setupEncounter(kwCard);
    turnState.chargesCorrectThisEncounter = 0;

    const result = playCardAction(turnState, 'kw_card_0', true, false, 'charge');

    expect(result.fizzled).toBe(false);
    // Resolver receives 0+1=1, clamped min 1 → 10 × 1 = 10
    expect(result.effect.shieldApplied).toBe(10);
  });

  /**
   * Test 2b: Knowledge Ward scales higher when more correct Charges have been made.
   * With 3 prior charges → resolver receives 4 → 10 × 4 = 40 block.
   */
  it('Knowledge Ward CC block scales higher with more prior correct Charges', () => {
    const kwCard3 = makeCard({
      id: 'kw_card_3',
      factId: 'kw_fact_3',
      cardType: 'shield',
      mechanicId: 'knowledge_ward',
      mechanicName: 'Knowledge Ward',
      apCost: 1,
      baseEffectValue: 6,
    });

    const turnState = setupEncounter(kwCard3);
    turnState.chargesCorrectThisEncounter = 3;

    const result = playCardAction(turnState, 'kw_card_3', true, false, 'charge');

    expect(result.fizzled).toBe(false);
    // Resolver receives 3+1=4 → 10 × 4 = 40 block
    expect(result.effect.shieldApplied).toBe(40);
  });

  /**
   * Test 2c: Knowledge Ward CC block is strictly higher than QP block (scaling matters).
   * QP formula: 6 × correctCharges. CC formula: 10 × correctCharges.
   */
  it('Knowledge Ward CC gives more block than QP for same charge count', () => {
    // CC path with 2 prior charges → 10 × 3 = 30
    const kwCC = makeCard({
      id: 'kw_cc',
      factId: 'kw_cc_fact',
      cardType: 'shield',
      mechanicId: 'knowledge_ward',
      mechanicName: 'Knowledge Ward',
      apCost: 1,
      baseEffectValue: 6,
    });
    const tsCC = setupEncounter(kwCC);
    tsCC.chargesCorrectThisEncounter = 2;
    const resCC = playCardAction(tsCC, 'kw_cc', true, false, 'charge');

    // QP path with 2 prior charges → 6 × 2 = 12 (QP uses chargesCorrectThisEncounter directly, not +1)
    const kwQP = makeCard({
      id: 'kw_qp',
      factId: 'kw_qp_fact',
      cardType: 'shield',
      mechanicId: 'knowledge_ward',
      mechanicName: 'Knowledge Ward',
      apCost: 1,
      baseEffectValue: 6,
    });
    const tsQP = setupEncounter(kwQP);
    tsQP.chargesCorrectThisEncounter = 2;
    // QP plays use answeredCorrectly=true (no quiz penalty; see CardCombatOverlay.svelte line 1661)
    const resQP = playCardAction(tsQP, 'kw_qp', true, false, 'quick');

    expect(resCC.effect.shieldApplied).toBeGreaterThan(resQP.effect.shieldApplied);
    expect(resCC.effect.shieldApplied).toBe(30); // 10 × 3 (2+1)
    // QP: 6 × correctCharges. correctChargesForResolver = chargesCorrectThisEncounter (no +1 for QP)
    // = 2; clamped to [1,5] → 2; 6 × 2 = 12
    expect(resQP.effect.shieldApplied).toBe(12);
  });
});

describe('AR-271 Card Mechanic: Precision Strike + Distractor Count', () => {
  /**
   * Test 3a: Precision Strike CC damage scales with distractorCount.
   * CC formula: 8 × (distractorCount + 1).
   * With 2 distractors: 8 × 3 = 24.
   */
  it('Precision Strike CC damage = 18 with 2 distractors [Pass 8 balance]', () => {
    const psCard = makeCard({
      id: 'ps_card',
      factId: 'ps_fact',
      cardType: 'attack',
      mechanicId: 'precision_strike',
      mechanicName: 'Precision Strike',
      apCost: 1,
      baseEffectValue: 8,
    });

    const turnState = setupEncounter(psCard);
    const result = playCardAction(turnState, 'ps_card', true, false, 'charge', 2);

    expect(result.fizzled).toBe(false);
    expect(result.effect.damageDealt).toBe(18); // 6 × (2 + 1) [Pass 8 balance]
  });

  /**
   * Test 3b: Precision Strike CC damage scales higher with 4 distractors.
   * With 4 distractors: 8 × 5 = 40.
   */
  it('Precision Strike CC damage = 30 with 4 distractors (scales correctly) [Pass 8 balance]', () => {
    const psCard4 = makeCard({
      id: 'ps_4dist',
      factId: 'ps_4_fact',
      cardType: 'attack',
      mechanicId: 'precision_strike',
      mechanicName: 'Precision Strike',
      apCost: 1,
      baseEffectValue: 8,
    });

    const turnState = setupEncounter(psCard4);
    const result = playCardAction(turnState, 'ps_4dist', true, false, 'charge', 4);

    expect(result.fizzled).toBe(false);
    expect(result.effect.damageDealt).toBe(30); // 6 × (4 + 1) [Pass 8 balance]
  });

  /**
   * Test 3c: Precision Strike does NOT fall back to 0 when distractorCount is omitted.
   * turnManager falls back to `Math.min(2 + masteryLevel, 4)` which is at least 2.
   */
  it('Precision Strike CC damage is non-zero when distractorCount is omitted (fallback = 2)', () => {
    const psFallback = makeCard({
      id: 'ps_fallback',
      factId: 'ps_fallback_fact',
      cardType: 'attack',
      mechanicId: 'precision_strike',
      mechanicName: 'Precision Strike',
      apCost: 1,
      baseEffectValue: 8,
    });

    const turnState = setupEncounter(psFallback);
    // No distractorCount passed → uses fallback
    const result = playCardAction(turnState, 'ps_fallback', true, false, 'charge');

    expect(result.fizzled).toBe(false);
    expect(result.effect.damageDealt).toBeGreaterThan(0);
    // Fallback = masteryLevel 0 → 2 distractors → 6 × 3 = 18 [Pass 8 balance]
    expect(result.effect.damageDealt).toBe(18);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RELIC MECHANIC WIRING
// ─────────────────────────────────────────────────────────────────────────────

describe('AR-271 Relic Mechanic: Scar Tissue stacking', () => {
  /**
   * Test 4: Scar Tissue adds +3 flat damage per stack (Pass 7) accumulated from wrong Charges.
   * After 2 wrong Charges with scar_tissue active, _scarTissueStacks = 2 → +6 flat on next CC.
   *
   * We compare:
   *   (A) CC damage WITHOUT scar_tissue (baseline)
   *   (B) CC damage WITH scar_tissue after 2 wrong Charges (should be +4 more)
   *
   * Uses `result.effect.damageDealt` directly (no enemy HP tracking needed).
   */
  it('Scar Tissue adds +6 flat damage after 2 wrong Charges (2 stacks × +3, Pass 7)', () => {
    // ── (A) Baseline: CC damage without scar_tissue ──────────────────────────
    const baseAttack = makeCard({
      id: 'base_attack',
      factId: 'base_fact',
      cardType: 'attack',
      mechanicId: 'strike',
      mechanicName: 'Strike',
      apCost: 1,
      baseEffectValue: 8,
    });
    const baseTS = setupEncounter(baseAttack, new Set()); // no relics
    const baseResult = playCardAction(baseTS, 'base_attack', true, false, 'charge');
    const baseDamage = baseResult.effect.damageDealt;
    expect(baseDamage).toBeGreaterThan(0);

    // ── (B) With scar_tissue: play 2 wrong charges, then CC ─────────────────
    // Reset stacks first (beforeEach handles this, but being explicit)
    resetFactLastSeenEncounter(); // resets _scarTissueStacks = 0

    const scarWrong1 = makeCard({ id: 'scar_w1', factId: 'scar_wf1', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const scarWrong2 = makeCard({ id: 'scar_w2', factId: 'scar_wf2', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const scarAttack = makeCard({
      id: 'scar_attack',
      factId: 'scar_fact',
      cardType: 'attack',
      mechanicId: 'strike',
      mechanicName: 'Strike',
      apCost: 1,
      baseEffectValue: 8,
    });

    const scarPadding: Card[] = Array.from({ length: 17 }, (_, i) =>
      makeCard({ id: `sp_${i}`, factId: `sp_fact_${i}` })
    );
    const scarDeck = makeDeck([scarWrong1, scarWrong2, scarAttack, ...scarPadding]);
    const scarEnemy = makeEnemy();
    const scarTS = startEncounter(scarDeck, scarEnemy);
    scarTS.activeRelicIds = new Set(['scar_tissue']);
    scarTS.apCurrent = 20;

    // Inject all three cards into hand
    injectIntoHand(scarTS, scarWrong1);
    injectIntoHand(scarTS, scarWrong2);
    injectIntoHand(scarTS, scarAttack);

    // 2 wrong Charges → 2 scar_tissue stacks (+2 flat each = +4 total bonus)
    playCardAction(scarTS, 'scar_w1', false, false, 'charge');
    playCardAction(scarTS, 'scar_w2', false, false, 'charge');
    const scarResult = playCardAction(scarTS, 'scar_attack', true, false, 'charge');
    const scarDamage = scarResult.effect.damageDealt;

    expect(scarDamage).toBeGreaterThan(baseDamage);
    expect(scarDamage - baseDamage).toBe(6); // +3 per stack × 2 stacks (Pass 7)
  });
});

describe('AR-271 Relic Mechanic: Domain Mastery Sigil AP modifier', () => {
  /**
   * Test 5a: Domain Mastery Sigil grants +1 AP at turn start when aura is Flow State.
   * After endPlayerTurn, the new turn begins. The turn-start handler reads the current
   * aura state and applies auraApModifier = +1 for flow_state.
   */
  it('Domain Mastery Sigil grants +1 AP when aura is Flow State at turn start', () => {
    const relics = new Set(['domain_mastery_sigil']);
    const card = makeCard({ id: 'dms_card', factId: 'dms_fact' });
    const turnState = setupEncounter(card, relics);

    // Force Flow State (fog ≤ 2). resetAura() sets fog to 0 (already flow_state).
    // fog=0 is already flow_state; no adjustment needed.
    expect(getAuraState()).toBe('flow_state');

    // End turn — this triggers enemy turn + turn-start effects for the new player turn
    endPlayerTurn(turnState);

    // Base AP per turn = 3 (Act 1, floor 1) + SURGE_BONUS_AP +1 (turn 2 is surge) + flow_state +1 = 5.
    expect(turnState.apCurrent).toBe(5);
    expect(turnState.triggeredRelicId).toBe('domain_mastery_sigil');
  });

  /**
   * Test 5b: Domain Mastery Sigil subtracts 1 AP at turn start when aura is Brain Fog.
   * max(1, 3 - 1) = 2.
   */
  it('Domain Mastery Sigil subtracts 1 AP when aura is Brain Fog at turn start', () => {
    const relics = new Set(['domain_mastery_sigil']);
    const card = makeCard({ id: 'dms_fog_card', factId: 'dms_fog_fact' });
    const turnState = setupEncounter(card, relics);

    // Force Brain Fog (fog ≥ 7). resetAura() sets fog to 0; +7 takes it to 7.
    adjustAura(7);
    expect(getAuraState()).toBe('brain_fog');

    endPlayerTurn(turnState);

    // base 3 (Act 1) + surge turn 2 (+1) = 4, then max(1, 4 - 1) = 3 (brain_fog penalty).
    expect(turnState.apCurrent).toBe(3);
    expect(turnState.triggeredRelicId).toBe('domain_mastery_sigil');
  });

  /**
   * Test 5c: No AP modifier when aura is Neutral (4-6).
   */
  it('Domain Mastery Sigil does NOT modify AP when aura is Neutral', () => {
    const relics = new Set(['domain_mastery_sigil']);
    const card = makeCard({ id: 'dms_neut_card', factId: 'dms_neut_fact' });
    const turnState = setupEncounter(card, relics);

    // Set fog to 4 (neutral range: 3-6). resetAura() sets fog to 0 (flow_state).
    adjustAura(4);
    expect(getAuraState()).toBe('neutral');

    endPlayerTurn(turnState);

    // No modifier → base 3 AP (Act 1) + SURGE_BONUS_AP +1 (turn 2 is surge) = 4.
    expect(turnState.apCurrent).toBe(4);
  });
});

describe('AR-271 Relic Mechanic: Lucky Coin armed flag', () => {
  /**
   * Test 6: Lucky Coin arms after exactly 2 wrong Charges in one encounter.
   * The next correct Charge gets +50% damage multiplier.
   *
   * Approach: compare `result.effect.damageDealt` of a CC attack with vs without
   * the coin armed. Without prior wrongs (coin unarmed): baseDamage.
   * With 2 prior wrong Charges (coin armed): ~1.5× baseDamage.
   */
  it('Lucky Coin boosts CC damage after 2 wrong Charges (armed → +50%)', () => {
    const relics = new Set(['lucky_coin']);

    // ── Baseline: play CC immediately without arming lucky_coin ─────────────
    const baseCard = makeCard({
      id: 'lc_base',
      factId: 'lc_base_fact',
      cardType: 'attack',
      mechanicId: 'strike',
      mechanicName: 'Strike',
      apCost: 1,
      baseEffectValue: 8,
    });
    const baseTS = setupEncounter(baseCard, relics);
    const baseResult = playCardAction(baseTS, 'lc_base', true, false, 'charge');
    const baseDamage = baseResult.effect.damageDealt;
    expect(baseDamage).toBeGreaterThan(0);

    // ── Lucky Coin path: 3 wrong charges → arm → CC gets +50% ───────────────
    // Reset module state (clear _luckyCoinArmed + _wrongChargesForLuckyCoin + _scarTissueStacks)
    resetFactLastSeenEncounter();

    const lc0 = makeCard({ id: 'lc_w0', factId: 'lc_wf0', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const lc1 = makeCard({ id: 'lc_w1', factId: 'lc_wf1', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const lc2 = makeCard({ id: 'lc_w2', factId: 'lc_wf2', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const lcCC = makeCard({
      id: 'lc_cc',
      factId: 'lc_cc_fact',
      cardType: 'attack',
      mechanicId: 'strike',
      mechanicName: 'Strike',
      apCost: 1,
      baseEffectValue: 8,
    });

    const lcPadding: Card[] = Array.from({ length: 16 }, (_, i) =>
      makeCard({ id: `lcp_${i}`, factId: `lcp_fact_${i}` })
    );
    const lcDeck = makeDeck([lc0, lc1, lc2, lcCC, ...lcPadding]);
    const lcEnemy = makeEnemy();
    const lcTS = startEncounter(lcDeck, lcEnemy);
    lcTS.activeRelicIds = new Set(relics);
    lcTS.apCurrent = 20;

    injectIntoHand(lcTS, lc0);
    injectIntoHand(lcTS, lc1);
    injectIntoHand(lcTS, lc2);
    injectIntoHand(lcTS, lcCC);

    // 2 wrong Charges → _wrongChargesForLuckyCoin reaches 2 → armed
    playCardAction(lcTS, 'lc_w0', false, false, 'charge');
    playCardAction(lcTS, 'lc_w1', false, false, 'charge');
    playCardAction(lcTS, 'lc_w2', false, false, 'charge');

    // Next CC: lucky_coin is armed → +50% multiplier
    const lcResult = playCardAction(lcTS, 'lc_cc', true, false, 'charge');
    const lcDamage = lcResult.effect.damageDealt;

    // Lucky Coin armed → ~1.5× baseline (may include scar_tissue flat bonus too,
    // so test for > baseline and >= 1.4× baseline to allow for rounding)
    expect(lcDamage).toBeGreaterThan(baseDamage);
    expect(lcDamage).toBeGreaterThanOrEqual(Math.round(baseDamage * 1.4));
  });

  /**
   * Test 6b: Lucky Coin does NOT fire if only 1 wrong Charge (threshold = 2).
   */
  it('Lucky Coin does NOT boost damage after only 1 wrong Charge (unarmed)', () => {
    const relics = new Set(['lucky_coin']);

    // Baseline: CC with no prior wrongs
    const baseCard = makeCard({
      id: 'lc_b2',
      factId: 'lc_b2_fact',
      cardType: 'attack',
      mechanicId: 'strike',
      mechanicName: 'Strike',
      apCost: 1,
      baseEffectValue: 8,
    });
    const baseTS = setupEncounter(baseCard, relics);
    const baseResult = playCardAction(baseTS, 'lc_b2', true, false, 'charge');
    const baseDamage = baseResult.effect.damageDealt;

    resetFactLastSeenEncounter();

    const lcW0 = makeCard({ id: 'lc2_w0', factId: 'lc2_wf0', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const lcW1 = makeCard({ id: 'lc2_w1', factId: 'lc2_wf1', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const lcCC2 = makeCard({
      id: 'lc2_cc',
      factId: 'lc2_cc_fact',
      cardType: 'attack',
      mechanicId: 'strike',
      mechanicName: 'Strike',
      apCost: 1,
      baseEffectValue: 8,
    });
    const lcPad2: Card[] = Array.from({ length: 17 }, (_, i) =>
      makeCard({ id: `lcp2_${i}`, factId: `lcp2_fact_${i}` })
    );
    const lcDeck2 = makeDeck([lcW0, lcW1, lcCC2, ...lcPad2]);
    const lcTS2 = startEncounter(lcDeck2, makeEnemy());
    lcTS2.activeRelicIds = new Set(relics);
    lcTS2.apCurrent = 20;
    injectIntoHand(lcTS2, lcW0);
    injectIntoHand(lcTS2, lcW1);
    injectIntoHand(lcTS2, lcCC2);

    // Only 1 wrong charge → NOT armed (threshold is 2)
    playCardAction(lcTS2, 'lc2_w0', false, false, 'charge');
    const lcResult2 = playCardAction(lcTS2, 'lc2_cc', true, false, 'charge');

    // Should be same as baseline (coin unarmed)
    expect(lcResult2.effect.damageDealt).toBe(baseDamage);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATUS EFFECT / AURA STATE WIRING
// ─────────────────────────────────────────────────────────────────────────────

describe('AR-271 Aura States: Brain Fog and Flow State via gameplay', () => {
  /**
   * Test 7: Wrong Charges increase fog toward Brain Fog (≥ 7).
   * Starting at 0, each wrong Charge raises fog by 1.
   * After 2 wrong Charges: 0 + 1 + 1 = 2 → still flow_state.
   * After 3 wrong Charges: 2 + 1 = 3 → neutral.
   */
  it('wrong Charges increase fog (2 wrongs: fog rises from 0 to 2, still flow_state)', () => {
    const w0 = makeCard({ id: 'fog_w0', factId: 'fog_wf0', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const w1 = makeCard({ id: 'fog_w1', factId: 'fog_wf1', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const padding: Card[] = Array.from({ length: 18 }, (_, i) =>
      makeCard({ id: `fogpad_${i}`, factId: `fogpad_fact_${i}` })
    );

    const deck = makeDeck([w0, w1, ...padding]);
    const turnState = startEncounter(deck, makeEnemy());
    turnState.apCurrent = 20;
    injectIntoHand(turnState, w0);
    injectIntoHand(turnState, w1);

    expect(getAuraState()).toBe('flow_state');
    expect(getAuraLevel()).toBe(0);

    playCardAction(turnState, 'fog_w0', false, false, 'charge');
    expect(getAuraLevel()).toBe(1); // 0 + 1 = 1 (still flow_state)

    playCardAction(turnState, 'fog_w1', false, false, 'charge');
    expect(getAuraLevel()).toBe(2); // 1 + 1 = 2 → still flow_state (threshold is ≤2)

    expect(getAuraState()).toBe('flow_state');
  });

  /**
   * Test 8: Correct Charges decrease fog toward Flow State (≤ 2).
   * Starting at fog 4 (neutral), each correct Charge lowers fog by 1.
   * After 2 correct Charges: 4 - 1 - 1 = 2 → flow_state.
   */
  it('correct Charges decrease fog into flow_state (2 corrects: fog drops from 4 to 2)', () => {
    const c0 = makeCard({ id: 'flow_c0', factId: 'flow_cf0', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const c1 = makeCard({ id: 'flow_c1', factId: 'flow_cf1', cardType: 'attack', apCost: 1, baseEffectValue: 8 });
    const padding: Card[] = Array.from({ length: 18 }, (_, i) =>
      makeCard({ id: `flowpad_${i}`, factId: `flowpad_fact_${i}` })
    );

    const deck = makeDeck([c0, c1, ...padding]);
    const turnState = startEncounter(deck, makeEnemy());
    turnState.apCurrent = 20;
    injectIntoHand(turnState, c0);
    injectIntoHand(turnState, c1);

    // Start at fog 4 (neutral) so we can demonstrate correct answers reducing fog
    adjustAura(4); // 0 → 4 (neutral)
    expect(getAuraState()).toBe('neutral');
    expect(getAuraLevel()).toBe(4);

    playCardAction(turnState, 'flow_c0', true, false, 'charge');
    expect(getAuraLevel()).toBe(3); // 4 - 1 = 3 (still neutral)

    playCardAction(turnState, 'flow_c1', true, false, 'charge');
    expect(getAuraLevel()).toBe(2); // 3 - 1 = 2 → flow_state

    expect(getAuraState()).toBe('flow_state');
  });

  /**
   * Test: fog resets to 0 (flow_state) at the start of each new encounter.
   */
  it('fog resets to 0 (flow_state) at the start of each encounter', () => {
    // Set fog to extreme (brain_fog) before encounter
    adjustAura(10); // 0+10 = 10
    expect(getAuraState()).toBe('brain_fog');

    const card = makeCard({ id: 'reset_c', factId: 'reset_f' });
    const deck = makeDeck([card, ...Array.from({ length: 19 }, (_, i) =>
      makeCard({ id: `rpad_${i}`, factId: `rpad_f_${i}` })
    )]);
    // startEncounter calls resetAura() internally
    startEncounter(deck, makeEnemy());

    expect(getAuraLevel()).toBe(0);
    expect(getAuraState()).toBe('flow_state');
  });

  /**
   * Test: review queue resets at the start of each new encounter.
   */
  it('review queue is cleared at the start of each encounter', () => {
    addToReviewQueue('stale_fact_123');
    expect(isReviewQueueFact('stale_fact_123')).toBe(true);

    const card = makeCard({ id: 'rq_card', factId: 'rq_fact' });
    const deck = makeDeck([card, ...Array.from({ length: 19 }, (_, i) =>
      makeCard({ id: `rqpad_${i}`, factId: `rqpad_f_${i}` })
    )]);
    // startEncounter calls resetReviewQueue() internally
    startEncounter(deck, makeEnemy());

    expect(isReviewQueueFact('stale_fact_123')).toBe(false);
  });

  /**
   * Test: correct Charge clears the fact from the review queue.
   */
  it('correct Charge removes the fact from the review queue', () => {
    const card = makeCard({
      id: 'rq_correct',
      factId: 'cleared_by_correct',
      cardType: 'attack',
      apCost: 1,
      baseEffectValue: 8,
    });

    const turnState = setupEncounter(card);
    // After setupEncounter, drawHand may have reassigned factId from the fact pool.
    // Find the card in hand and use its ACTUAL factId.
    const cardInHand = turnState.deck.hand.find(c => c.id === 'rq_correct');
    const actualFactId = cardInHand?.factId ?? 'cleared_by_correct';

    // Manually add the card's actual factId to queue (simulating prior wrong answer)
    addToReviewQueue(actualFactId);
    expect(isReviewQueueFact(actualFactId)).toBe(true);

    playCardAction(turnState, 'rq_correct', true, false, 'charge');

    expect(isReviewQueueFact(actualFactId)).toBe(false);
  });
});
