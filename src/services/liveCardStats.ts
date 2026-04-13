/**
 * Live Card Stats Service (AR-10.1)
 *
 * Canonical single-source-of-truth for "what does this card actually do right now?"
 * Accepts a Card and TurnState and returns the exact final effective values that
 * would display in the card UI.
 *
 * All card UI rendering MUST call selectLiveCardStats — never read baseEffectValue
 * directly or compute damage inline. This is the 10.1 hard rule.
 *
 * Delegates to computeDamagePreview (damagePreviewService.ts) for the
 * actual computation. This layer translates TurnState → DamagePreviewContext
 * so callers don't need to build the context manually.
 *
 * Pure function — no side effects, no audio, no Phaser or Svelte imports.
 */

import type { Card } from '../data/card-types';
import type { TurnState } from './turnManager';
import { computeDamagePreview, type DamagePreview, type DamagePreviewContext } from './damagePreviewService';
import { getMasteryStats } from './cardUpgradeService';
import { isVulnerable, getStrengthModifier } from '../data/statusEffects';
import { getAuraLevel } from './knowledgeAuraSystem';

export type { DamagePreview };

/**
 * Subset of TurnState fields needed to compute live card stats.
 * Avoids importing the full TurnState type in UI layers that only need preview.
 */
export interface LiveCardTurnContext {
  activeRelicIds: Set<string>;
  buffNextCard: number;
  overclockReady: boolean;
  doubleStrikeReady: boolean;
  firstAttackUsed: boolean;
  cardsPlayedThisTurn: number;
  encounterTurnNumber: number;
  chainMultiplier: number;
  playerState: {
    hp: number;
    maxHP: number;
    shield: number;
    statusEffects: Array<{ type: string; value: number; turnsRemaining: number }>;
  };
  enemy: {
    currentHP: number;
    maxHP: number;
    statusEffects: Array<{ type: string; value: number; turnsRemaining: number }>;
    _hardcover?: number;
    _hardcoverBroken?: boolean;
    _quickPlayDamageMultiplierOverride?: number;
    chargeResistant?: boolean;
  };
  /** From the active inscription-fury inscription, if any. */
  inscriptionFuryBonus?: number;
  /** Accumulated wrong-charge count for scar_tissue flat bonus. */
  scarTissueStacks?: number;
}

/**
 * Returns the canonical live effective stats for a card given the current turn context.
 *
 * @param card    - The card to evaluate.
 * @param ctx     - Relevant slice of TurnState (or a full TurnState object).
 * @returns DamagePreview with qpValue, ccValue, and modification indicators.
 */
export function selectLiveCardStats(card: Card, ctx: LiveCardTurnContext): DamagePreview {
  const playerHpPercent = ctx.playerState.maxHP > 0
    ? ctx.playerState.hp / ctx.playerState.maxHP
    : 1;
  const enemyHpPercent = ctx.enemy.maxHP > 0
    ? ctx.enemy.currentHP / ctx.enemy.maxHP
    : 1;

  // Build status-effect arrays typed for the statusEffects helpers.
  // Cast is safe: we only read type/value/turnsRemaining fields.
  const enemyStatusEffects = ctx.enemy.statusEffects as import('../data/statusEffects').StatusEffect[];
  const playerStatusEffects = ctx.playerState.statusEffects as import('../data/statusEffects').StatusEffect[];

  const enemyIsVulnerable = isVulnerable(enemyStatusEffects);
  const playerStrengthModifier = getStrengthModifier(playerStatusEffects);

  // Extract enemy poison/burn stacks for relic bonuses.
  const enemyPoisonEffect = enemyStatusEffects.find(e => e.type === 'poison' && e.turnsRemaining > 0);
  const enemyBurnEffect = enemyStatusEffects.find(e => e.type === 'burn' && e.turnsRemaining > 0);

  const previewCtx: DamagePreviewContext = {
    activeRelicIds: ctx.activeRelicIds,
    buffNextCard: ctx.buffNextCard,
    overclockReady: ctx.overclockReady,
    doubleStrikeReady: ctx.doubleStrikeReady,
    firstAttackUsed: ctx.firstAttackUsed,
    playerHpPercent,
    enemyHpPercent,
    enemyPoisonStacks: enemyPoisonEffect?.value ?? 0,
    enemyBurnStacks: enemyBurnEffect?.value ?? 0,
    enemyIsVulnerable,
    enemyQpDamageMultiplier: ctx.enemy._quickPlayDamageMultiplierOverride,
    enemyChargeResistant: ctx.enemy.chargeResistant ?? false,
    enemyHardcover: ctx.enemy._hardcover ?? 0,
    enemyHardcoverBroken: ctx.enemy._hardcoverBroken ?? false,
    inscriptionFuryBonus: ctx.inscriptionFuryBonus ?? 0,
    cardsPlayedThisTurn: ctx.cardsPlayedThisTurn,
    encounterTurnNumber: ctx.encounterTurnNumber,
    scarTissueStacks: ctx.scarTissueStacks ?? 0,
    playerStrengthModifier,
    chainMultiplier: ctx.chainMultiplier,
  };

  return computeDamagePreview(card, previewCtx);
}

/**
 * Returns the effective draw count for a draw card (scout, foresight, recycle, etc.)
 * accounting for mastery level. Returns null for non-draw cards.
 *
 * Used by the UI to show the correct draw number on utility cards.
 * Fixes the "Draw 0" display bug caused by qpValue=0 on foresight/scout.
 *
 * @param card - The card to evaluate.
 * @returns The draw count at the card's current mastery level, or null if not a draw card.
 */
export function getEffectiveDrawCount(card: Card): number | null {
  const drawMechanics = new Set(['foresight', 'scout', 'sift', 'recollect', 'synapse']);
  if (!card.mechanicId || !drawMechanics.has(card.mechanicId)) return null;

  const stats = getMasteryStats(card.mechanicId, card.masteryLevel ?? 0);
  if (stats?.drawCount != null) return stats.drawCount;

  // Fallback for mechanics not in stat tables
  return null;
}

/**
 * Returns the effective aura-level Knowledge Aura multiplier for aura-scaled cards
 * (smite, feedback_loop, knowledge_ward). Returns 1 if not an aura-scaled card.
 *
 * @param card - The card to evaluate.
 * @returns The aura level (0-5) relevant to this card's scaling, or 0.
 */
export function getEffectiveAuraLevel(card: Card): number {
  const auraScaledMechanics = new Set(['smite', 'feedback_loop', 'knowledge_ward']);
  if (!card.mechanicId || !auraScaledMechanics.has(card.mechanicId)) return 0;
  return getAuraLevel();
}
