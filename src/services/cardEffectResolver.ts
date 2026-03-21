// === Card Effect Resolver ===
// Resolves card play into effect results. Does not mutate player/enemy state.

import type { Card, CardType } from '../data/card-types';
import type { StatusEffect } from '../data/statusEffects';
import type { PlayerCombatState } from './playerCombatState';
import type { EnemyInstance } from '../data/enemies';
import {
  BASE_EFFECT,
  LEGACY_TIER_MULTIPLIER,
  TIER_MULTIPLIER,
  CHARGE_CORRECT_MULTIPLIER,
  getBalanceOverrides,
  CURSED_QP_MULTIPLIER,
  CURSED_CHARGE_CORRECT_MULTIPLIER,
  CURSED_CHARGE_WRONG_MULTIPLIER,
} from '../data/balance';
import { getMasteryBaseBonus, getMasterySecondaryBonus } from './cardUpgradeService';
import { isVulnerable } from '../data/statusEffects';
import { getMechanicDefinition, type PlayMode } from '../data/mechanics';
import { resolveAttackModifiers, resolveShieldModifiers, resolvePoisonDurationBonus } from './relicEffectResolver';

export interface CardEffectResult {
  effectType: CardType;
  rawValue: number;
  finalValue: number;
  targetHit: boolean;
  damageDealt: number;
  shieldApplied: number;
  healApplied: number;
  statusesApplied: StatusEffect[];
  extraCardsDrawn: number;
  enemyDefeated: boolean;
  mechanicId?: string;
  mechanicName?: string;
  damageDealtBypassesBlock?: boolean;
  selfDamage?: number;
  reflectDamage?: number;
  persistentShield?: number;
  parryDrawBonus?: number;
  overhealToShield?: number;
  grantsAp?: number;
  applyDoubleStrikeBuff?: boolean;
  /** double_strike charge bonus: next attack also pierces (charge_correct only). */
  doubleStrikeAddsPierce?: boolean;
  applyFocusBuff?: boolean;
  /** Number of cards that will benefit from Focus AP reduction (1 = normal, 2 = Focus+). */
  focusCharges?: number;
  applySlow?: boolean;
  applyForesight?: boolean;
  applyTransmute?: boolean;
  applyImmunity?: boolean;
  applyOverclock?: boolean;
  drawCountOverride?: number;
  /** thorns: reflect this much damage back to enemy when hit */
  thornsValue?: number;
  /** cleanse: remove debuffs from player */
  applyCleanse?: boolean;
  /** mirror: copy the previous card's full effect result */
  mirrorCopy?: boolean;
  /** adapt: cleanse one random debuff from player */
  adaptCleanse?: boolean;
  /** foresight charge_correct bonus: reveal the next enemy intent */
  revealNextIntent?: boolean;
  /** recycle charge_correct bonus: number of cards to draw from discard pile */
  drawFromDiscard?: number;
  /** AR-203: Burn stacks to apply to the target on this card play. */
  applyBurnStacks?: number;
  /** AR-203: Bleed stacks to apply to the target on this card play. */
  applyBleedStacks?: number;
  /**
   * AR-203: If set, this card's damage was resolved as N separate hits.
   * Burn triggers once per hit (halving after each). turnManager resolves per-hit loop.
   * When hitCount > 1, damageDealt in this result is the PER-HIT base value (not total).
   */
  hitCount?: number;
  /** AR-206: If set, enemy's next action should be skipped (stagger mechanic). */
  applyStagger?: boolean;
  /** AR-206: If true, also apply Vulnerable (for Bash CC stagger CC bonus). */
  staggerAppliesVulnerable?: boolean;
  /** AR-206: Number of enemy block points to remove (corrode mechanic). Negative = remove all. */
  removeEnemyBlock?: number;
  /** AR-206: Pending Burn stacks that will be added to the next attack played (ignite buff). */
  applyIgniteBuff?: number;
  /** AR-206: Cards to discard and then draw (swap mechanic). */
  swapDiscardDraw?: { discardCount: number; drawCount: number };
  /** AR-206: Number of cards to retrieve from discard pile to top of draw (scavenge). */
  scavengeCount?: number;
  /** AR-206: Number of cards to look at and discard count (sift mechanic). */
  siftParams?: { lookAt: number; discardCount: number };
  /** AR-206: Heal from overkill (siphon_strike). Value is already computed. */
  overkillHeal?: number;
  /** AR-206: Extra block granted to same-chain cards in hand (aegis_pulse CC). */
  chainBlockBonus?: number;
  /** AR-207: Gambit self-damage amount (QP: 2, CW: 5; reduced by 1 at L3+). */
  gambitselfDamage?: number;
  /** AR-207: Gambit CC heal amount. */
  gambitHeal?: number;
  /** AR-207: If true, the card should be exhausted after resolution (volatile_slash CC, burnout_shield CC). */
  exhaustOnResolve?: boolean;
  /** AR-207: Knowledge Ward — block is per-domain (value = block per unique domain, resolver sets finalValue). */
  knowledgeWardBlock?: number;
  /**
   * AR-207: Warcry — apply strength status to player.
   * value = stacks, turnsRemaining = 99 for permanent (rest of combat), 1 for this-turn only.
   */
  applyStrengthToPlayer?: { value: number; permanent: boolean };
  /** AR-207: Warcry CC — next Charge this turn costs +0 AP surcharge. */
  warcryFreeCharge?: boolean;
  /** AR-207: Battle Trance lockout — set battleTranceRestriction on turn state. */
  applyBattleTranceRestriction?: boolean;
  /** AR-207: Number of cards to draw immediately (battle_trance). */
  battleTranceDraw?: number;
  /** AR-207: Curse of Doubt — apply charge_damage_amp_percent status to enemy. */
  applyChargeDamageAmpPercent?: { value: number; turns: number };
  /** AR-207: Mark of Ignorance — apply charge_damage_amp_flat status to enemy. */
  applyChargeDamageAmpFlat?: { value: number; turns: number };
  /**
   * AR-207: Phase Shift — pending choice for QP/CW (player must choose dmg or block).
   * 'damage' | 'block'. Resolved by turnManager when choice returns.
   * For now auto-selects damage when no popup is wired.
   */
  phaseShiftChoice?: 'damage' | 'block' | 'pending';
  /** AR-207: Phase Shift CC — both damage AND block simultaneously. */
  phaseShiftBothDmgAndBlock?: { damage: number; block: number };
  /**
   * AR-207: Chameleon — copy last card's base mechanic at the given multiplier.
   * turnManager resolves the actual copy using lastPlayedMechanicId.
   */
  chameleonMultiplier?: number;
  /** AR-207: Chameleon CC — inherit the last played card's chain type. */
  chameleonInheritChain?: boolean;
  /**
   * AR-207: Dark Knowledge — damage per cursed fact (already multiplied in damageDealt).
   * Stored for UI display.
   */
  darkKnowledgeDmgPerCurse?: number;
  /**
   * AR-207: Chain Anchor CC — set chainAnchorActive flag on turn state.
   * Chain Anchor is NOT a chain link itself.
   */
  applyChainAnchor?: boolean;
  /**
   * AR-207: Unstable Flux — random/choice result.
   * 'damage' | 'block' | 'draw' | 'debuff'
   */
  unstableFluxEffect?: 'damage' | 'block' | 'draw' | 'debuff';
  /**
   * AR-207: Chain Lightning CC damage multiplied by chain length.
   * This value is set in turnManager after extending the chain.
   * The resolver sets a sentinel (8 base) and turnManager overrides.
   */
  chainLightningChainLength?: number;
}

export interface AdvancedResolveOptions {
  activeRelicIds?: Set<string>;
  isFirstAttackThisEncounter?: boolean;
  isDoubleStrikeActive?: boolean;
  isFocusActive?: boolean;
  isOverclockActive?: boolean;
  damageDealtThisTurn?: number;
  /** Whether the card was answered correctly. Defaults to true. */
  correct?: boolean;
  /** How the card was played (quick/charge/charge_correct/charge_wrong). */
  playMode?: PlayMode;
  /** Knowledge Chain multiplier (1.0 = no chain). */
  chainMultiplier?: number;
  /**
   * Count of cards per domain in the active deck (draw + discard + hand, not exhaust).
   * Keyed by FactDomain string. Required for domain_mastery_sigil v2.
   */
  deckDomainCounts?: Record<string, number>;
  /**
   * AR-204: Flat damage bonus from active Inscription of Fury. Added at damage pipeline step 3,
   * after mastery bonus and before relic flat bonuses. Only applies to attack cards.
   */
  inscriptionFuryBonus?: number;
  /**
   * AR-207: Unique domain strings from the current hand (for knowledge_ward).
   * Populated by turnManager at resolve time. Deduplicated before passing.
   */
  handDomains?: string[];
  /**
   * AR-207: Count of cursed facts in runState.cursedFactIds at the time this card was played.
   * Snapshotted by turnManager before resolving dark_knowledge.
   */
  cursedFactCount?: number;
}

export function isCardBlocked(card: Card, enemy: EnemyInstance): boolean {
  return enemy.template.immuneDomain != null && card.domain === enemy.template.immuneDomain;
}

function getTierMultiplier(tier: Card['tier']): number {
  if (typeof tier === 'string') return TIER_MULTIPLIER[tier] ?? 1.0;
  return LEGACY_TIER_MULTIPLIER[tier as 1 | 2 | 3] ?? 1.0;
}

/** Get base effect value for a card type, checking overrides first. */
function getBaseEffect(cardType: string): number {
  const overrides = getBalanceOverrides();
  if (overrides) {
    if (cardType === 'attack' && overrides.baseEffectAttack !== undefined) return overrides.baseEffectAttack;
    if (cardType === 'shield' && overrides.baseEffectShield !== undefined) return overrides.baseEffectShield;
  }
  return BASE_EFFECT[cardType as keyof typeof BASE_EFFECT] ?? 0;
}

export function resolveCardEffect(
  card: Card,
  playerState: PlayerCombatState,
  enemy: EnemyInstance,
  speedBonus: number,
  buffNextCard: number,
  lastCardType?: CardType,
  passiveBonuses?: Partial<Record<CardType, number>>,
  advanced: AdvancedResolveOptions = {},
): CardEffectResult {
  const activeRelicIds = advanced.activeRelicIds ?? new Set<string>();
  const mechanic = getMechanicDefinition(card.mechanicId);

  const result: CardEffectResult = {
    effectType: card.cardType,
    rawValue: 0,
    finalValue: 0,
    targetHit: true,
    damageDealt: 0,
    shieldApplied: 0,
    healApplied: 0,
    statusesApplied: [],
    extraCardsDrawn: 0,
    enemyDefeated: false,
    mechanicId: card.mechanicId,
    mechanicName: card.mechanicName,
  };

  if (isCardBlocked(card, enemy)) {
    result.targetHit = false;
    return result;
  }

  let effectiveType: CardType = card.cardType;
  if (card.cardType === 'wild' && card.mechanicId !== 'overclock') {
    effectiveType = lastCardType ?? 'attack';
    result.effectType = effectiveType;
    const baseValue = getBaseEffect(effectiveType);
    card = { ...card, baseEffectValue: baseValue > 0 ? baseValue : card.baseEffectValue };
  }

  const chainMultiplier = advanced.chainMultiplier ?? 1.0;
  const buffMultiplier = 1 + buffNextCard / 100;
  const overclockMultiplier = advanced.isOverclockActive ? 2 : 1;
  const correct = advanced.correct ?? true;
  const playMode: PlayMode = advanced.playMode ?? 'quick';
  const baseEffectValue = card.baseEffectValue;

  // Tier multiplier — used for no-mechanic (legacy) cards and execute bonus.
  const tierMultiplier = getTierMultiplier(card.tier);
  // Card's effectMultiplier (tier-derived, set at card creation time).
  const focusAdjustedMultiplier = card.effectMultiplier;

  // Per-mechanic play-mode values: use mechanic's quickPlayValue / chargeCorrectValue / chargeWrongValue
  // if available; otherwise fall back to card.baseEffectValue with tier scaling (legacy path).
  const isChargeCorrect = playMode === 'charge' || playMode === 'charge_correct';
  const isChargeWrong = playMode === 'charge_wrong';

  let mechanicBaseValue: number;
  if (mechanic) {
    if (isChargeCorrect) {
      mechanicBaseValue = Math.round(mechanic.quickPlayValue * CHARGE_CORRECT_MULTIPLIER);
    } else if (isChargeWrong) {
      mechanicBaseValue = mechanic.chargeWrongValue;
    } else {
      // quick / quick_play
      mechanicBaseValue = mechanic.quickPlayValue;
    }
  } else {
    // No mechanic definition (wild fallback, unknown mechanic).
    // Apply tier multiplier to preserve pre-v2 behavior for these cards.
    mechanicBaseValue = baseEffectValue * tierMultiplier;
  }

  // Apply mastery bonus (AR-113)
  const masteryBonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  mechanicBaseValue += masteryBonus;

  const masterySecondaryBonus = getMasterySecondaryBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  // Apply mastery secondary bonus to a copy of the card so switch cases can read it uniformly
  if (masterySecondaryBonus > 0 && mechanic) {
    const currentSecondary = card.secondaryValue ?? mechanic.secondaryValue ?? 0;
    card = { ...card, secondaryValue: currentSecondary + masterySecondaryBonus };
  }

  // AR-202: Apply cursed multipliers if the card carries a cursed fact.
  // Applied after mastery bonus but before tier/combo/chain/relic multipliers.
  if (card.isCursed) {
    const isQuickPlay2 = playMode === 'quick' || playMode === 'quick_play';
    const isChargeCorrect2 = playMode === 'charge' || playMode === 'charge_correct';
    const isChargeWrong2 = playMode === 'charge_wrong';
    // Scar Tissue relic stub (AR-203): overrides QP multiplier to 0.85 on QP plays.
    let cursedQpMult = CURSED_QP_MULTIPLIER; // 0.7
    if (isQuickPlay2 && activeRelicIds.has('scar_tissue')) {
      cursedQpMult = 0.85;
    }
    if (isQuickPlay2) {
      mechanicBaseValue = Math.round(mechanicBaseValue * cursedQpMult);
    } else if (isChargeCorrect2) {
      mechanicBaseValue = Math.round(mechanicBaseValue * CURSED_CHARGE_CORRECT_MULTIPLIER); // 1.0 — no change
    } else if (isChargeWrong2) {
      mechanicBaseValue = Math.round(mechanicBaseValue * CURSED_CHARGE_WRONG_MULTIPLIER); // 0.5
    }
  }

  const strikeTag = mechanic?.tags.includes('strike') ?? false;
  const sharpenedEdgeBonus = strikeTag && activeRelicIds.has('barbed_edge') ? 3 : 0;
  // AR-204: Inscription of Fury bonus — flat damage at pipeline step 3 (after mastery, before relic flat bonuses).
  // Only applies to attack cards; non-attack types are unaffected.
  const furyBonus = effectiveType === 'attack' ? (advanced.inscriptionFuryBonus ?? 0) : 0;
  const effectiveBase = mechanicBaseValue + sharpenedEdgeBonus + furyBonus;

  // ── Relic attack modifiers ──────────────────────────────────────────────────
  // resolveAttackModifiers handles all attack-boosting relics (whetstone, flame_brand,
  // glass_cannon, berserker_band, etc.). We read playerState for HP context.
  const relicAttackMods = effectiveType === 'attack'
    ? resolveAttackModifiers(activeRelicIds, {
        isFirstAttack: advanced.isFirstAttackThisEncounter ?? false,
        isStrikeTagged: strikeTag,
        playerHpPercent: playerState.hp / playerState.maxHP,
        consecutiveCorrectAttacks: 0, // crescendo_blade context not tracked in card resolver; zero is safe
        cardTier: typeof card.tier === 'string' ? card.tier : 'learning',
        correctStreakThisEncounter: 0, // memory_palace context not tracked here; handled upstream
        enemyHpPercent: enemy.currentHP / enemy.maxHP,
        enemyPoisonStacks: (enemy.statusEffects ?? []).filter(s => s.type === 'poison').reduce((sum, s) => sum + (s.value ?? 0), 0),
        cardDomain: card.domain,
        deckDomainCounts: advanced.deckDomainCounts,
      })
    : null;

  // ── Relic shield modifiers ──────────────────────────────────────────────────
  const relicShieldMods = (effectiveType === 'shield' || effectiveType === 'wild')
    ? resolveShieldModifiers(activeRelicIds)
    : null;

  // Build the attack relic multiplier from the resolver results.
  // Flat bonus is applied after scaling (added to finalValue below).
  // Percent bonus is applied as a multiplier here.
  const attackRelicMultiplier = relicAttackMods
    ? 1 + relicAttackMods.percentDamageBonus
    : 1;

  const rawValue = effectiveBase * focusAdjustedMultiplier;
  result.rawValue = rawValue;
  const scaledValue = Math.round(rawValue * chainMultiplier * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier);
  // Apply flat relic attack bonus after all multipliers (so it isn't multiplied by combo/chain).
  const relicFlatAttackBonus = relicAttackMods?.flatDamageBonus ?? 0;
  const finalValue = effectiveType === 'attack'
    ? scaledValue + relicFlatAttackBonus
    : scaledValue;
  result.finalValue = finalValue;

  // Flat shield bonus from relics (stone_wall: +3). Added to every shield result.
  const shieldRelicBonus = relicShieldMods?.flatBlockBonus ?? 0;

  // bastions_will Quick Play +25% block multiplier — only on Quick Play (not Charged).
  // The Charged +75% path is handled in turnManager via resolveChargeCorrectEffects.
  const isQuickPlay = playMode === 'quick' || playMode === 'quick_play';
  const quickPlayShieldMult = (isQuickPlay && (relicShieldMods?.quickPlayShieldBonus ?? 0) > 0)
    ? 1 + (relicShieldMods!.quickPlayShieldBonus / 100)
    : 1;

  const applyAttackDamage = (baseDamage: number): void => {
    let damage = Math.max(0, Math.round(baseDamage + (passiveBonuses?.attack ?? 0)));
    if (isVulnerable(enemy.statusEffects)) damage = Math.round(damage * 1.5);
    result.damageDealt = damage;
    result.enemyDefeated = damage >= enemy.currentHP;
  };

  /**
   * Applies relic shield modifiers to a base shield value:
   *   result = Math.round((base + stone_wall_flat) * bastions_will_quick_play_mult)
   * - stone_wall +3 flat applies always.
   * - bastions_will +25% applies on Quick Play only; the Charged +75% path is in turnManager.
   * All callers pass their full pre-relic shield amount as `base`.
   */
  const applyShieldRelics = (base: number): number => Math.round((base + shieldRelicBonus) * quickPlayShieldMult);

  // Double Strike buff consumes on next attack card — full power per hit.
  if (advanced.isDoubleStrikeActive && effectiveType === 'attack') {
    const perHit = Math.round(finalValue * 1.0);
    applyAttackDamage(perHit * 2);
    return result;
  }

  // TODO(AR-203): mastery_surge must skip cards where isCursed === true — per Appendix F.
  // When mastery_surge is implemented, add: if (candidate.isCursed) continue; in its hand iteration.

  const mechanicId = card.mechanicId ?? '';
  switch (mechanicId) {
    case 'multi_hit': {
      const hits = (card.secondaryValue ?? mechanic?.secondaryValue ?? 3) + (activeRelicIds.has('chain_lightning_rod') ? 1 : 0);
      // AR-203: Set hitCount so turnManager resolves Burn per-hit instead of combined.
      // damageDealt is set to the per-hit base value; turnManager accumulates the total.
      if (hits > 1) {
        applyAttackDamage(finalValue); // per-hit base (Vulnerable already applied)
        result.hitCount = hits;
        return result;
      }
      applyAttackDamage(finalValue * hits);
      return result;
    }
    case 'piercing': {
      result.damageDealtBypassesBlock = true;
      applyAttackDamage(finalValue);
      return result;
    }
    case 'reckless': {
      result.selfDamage = card.secondaryValue ?? mechanic?.secondaryValue ?? 3;
      applyAttackDamage(finalValue);
      return result;
    }
    case 'execute': {
      const threshold = mechanic?.secondaryThreshold ?? 0.3;
      // execute bonus scales with the same per-mechanic charge value (chargeCorrectValue = 8 bonus at base)
      const bonusBaseValue = isChargeCorrect ? 24 : (isChargeWrong ? 4 : 8);
      const scaledBonus = Math.round(bonusBaseValue * focusAdjustedMultiplier * chainMultiplier * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier);
      const executeBonus = enemy.currentHP / enemy.maxHP < threshold ? scaledBonus : 0;
      applyAttackDamage(finalValue + executeBonus);
      return result;
    }
    case 'fortify': {
      const shield = applyShieldRelics(finalValue);
      result.shieldApplied = shield;
      result.persistentShield = shield;
      return result;
    }
    case 'parry': {
      result.shieldApplied = applyShieldRelics(finalValue);
      const enemyIsAttacking = enemy.nextIntent.type === 'attack' || enemy.nextIntent.type === 'multi_attack';
      if (enemyIsAttacking) result.parryDrawBonus = 1;
      return result;
    }
    case 'brace': {
      const enemyIsAttacking = enemy.nextIntent.type === 'attack' || enemy.nextIntent.type === 'multi_attack';
      if (!enemyIsAttacking) {
        result.shieldApplied = 0;
        return result;
      }
      // Brace scales enemy intent by play-mode multiplier
      const braceMultiplier = isChargeCorrect ? 3.0 : (isChargeWrong ? 0.7 : 1.0);
      result.shieldApplied = applyShieldRelics(Math.round(enemy.nextIntent.value * braceMultiplier));
      return result;
    }
    case 'overheal': {
      const healthPercentage = playerState.hp / playerState.maxHP;
      const bonusMultiplier = healthPercentage < 0.5 ? 2.0 : 1.0;
      result.shieldApplied = applyShieldRelics(Math.round(finalValue * bonusMultiplier));
      return result;
    }
    case 'lifetap': {
      const damageFromCard = finalValue + (passiveBonuses?.attack ?? 0);
      result.healApplied = Math.max(1, Math.floor(damageFromCard * 0.20));
      applyAttackDamage(damageFromCard);
      return result;
    }
    case 'quicken': {
      result.grantsAp = 1;
      // charge_correct bonus: also draw 1 card
      result.extraCardsDrawn = isChargeCorrect ? 1 : 0;
      result.finalValue = 1;
      return result;
    }
    case 'focus': {
      result.applyFocusBuff = true;
      // charge_correct bonus: grant 2 focus charges (two cards get AP reduction)
      const focusCharges = isChargeCorrect ? 2 : 1;
      result.focusCharges = focusCharges;
      return result;
    }
    case 'double_strike': {
      result.applyDoubleStrikeBuff = true;
      // charge_correct bonus: next attack also pierces
      if (isChargeCorrect) result.doubleStrikeAddsPierce = true;
      return result;
    }
    case 'slow': {
      result.applySlow = true;
      // charge_correct bonus: also apply Weaken for 1 turn
      if (isChargeCorrect) {
        result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    case 'hex': {
      // hex poison value scales with play mode
      const poisonValue = isChargeCorrect ? 8 : (isChargeWrong ? 2 : 3);
      // plague_flask — poison lasts 1 extra turn
      const poisonTurns = 3 + resolvePoisonDurationBonus(activeRelicIds);
      result.statusesApplied.push({ type: 'poison', value: poisonValue, turnsRemaining: poisonTurns });
      return result;
    }
    case 'foresight': {
      // draw count scales with play mode; charge_correct also reveals next intent
      const drawCount = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.extraCardsDrawn = drawCount;
      if (isChargeCorrect) result.revealNextIntent = true;
      return result;
    }
    case 'transmute': {
      result.applyTransmute = true;
      return result;
    }
    case 'immunity': {
      result.applyImmunity = true;
      return result;
    }
    case 'overclock': {
      result.applyOverclock = true;
      return result;
    }
    case 'thorns': {
      // Both block and reflect scale with play mode
      result.shieldApplied = applyShieldRelics(finalValue);
      // thornsValue scales proportionally: quick=3, charge_correct=9, charge_wrong=2
      const thornsBaseReflect = isChargeCorrect ? 9 : (isChargeWrong ? 2 : 3);
      result.thornsValue = Math.round(thornsBaseReflect * focusAdjustedMultiplier);
      return result;
    }
    case 'cleanse': {
      result.applyCleanse = true;
      result.extraCardsDrawn = 1;
      return result;
    }
    case 'empower': {
      // empower finalValue is used directly as buffNextCard in turnManager
      result.finalValue = finalValue;
      return result;
    }
    case 'scout': {
      // draw count scales with play mode
      const scoutDrawCount = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.extraCardsDrawn = scoutDrawCount;
      return result;
    }
    case 'recycle': {
      // draw count scales with play mode; charge_correct also draws from discard
      const recycleDrawCount = isChargeCorrect ? 4 : (isChargeWrong ? 2 : 3);
      result.extraCardsDrawn = recycleDrawCount;
      if (isChargeCorrect) result.drawFromDiscard = 1;
      return result;
    }
    case 'emergency': {
      const hpPercent = playerState.hp / playerState.maxHP;
      const block = hpPercent < 0.3 ? finalValue * 2 : finalValue;
      result.shieldApplied = applyShieldRelics(Math.round(block));
      return result;
    }
    case 'mirror': {
      result.mirrorCopy = true;
      // Actual copy happens in turnManager after checking lastCardEffect.
      return result;
    }
    case 'adapt': {
      const intentType = enemy.nextIntent.type;
      if (intentType === 'attack' || intentType === 'multi_attack') {
        result.shieldApplied = applyShieldRelics(finalValue);
      } else if (intentType === 'debuff') {
        result.adaptCleanse = true;
      } else {
        // defend, buff, heal, or unknown — go offensive
        applyAttackDamage(finalValue);
      }
      return result;
    }
    // AR-203: Ignite — sets a buff so the NEXT attack card played adds Burn stacks.
    case 'ignite': {
      // finalValue encodes the Burn stacks to apply on the next attack.
      // QP = 4, CC = 8, CW = 2 (from mechanic definition + mastery bonus).
      result.applyIgniteBuff = finalValue;
      return result;
    }
    // AR-203/AR-206: Lacerate — applies Bleed stacks AND deals damage.
    case 'lacerate': {
      // QP: 4 dmg + 4 Bleed; CC: 12 dmg + 8 Bleed; CW: 3 dmg + 2 Bleed
      const lacerateBleed = isChargeCorrect ? 8 : (isChargeWrong ? 2 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 4));
      applyAttackDamage(finalValue);
      result.applyBleedStacks = lacerateBleed;
      return result;
    }

    // ── AR-206: New card resolver cases ────────────────────────────────────────

    // Filler: Twin Strike — 2 hits, each triggers Burn/Bleed separately
    case 'twin_strike': {
      const hits = 2;
      applyAttackDamage(finalValue); // per-hit damage (Vulnerable already applied)
      result.hitCount = hits;
      return result;
    }
    // Filler: Iron Wave — hybrid damage + block
    case 'iron_wave': {
      applyAttackDamage(finalValue);
      const ironWaveBlock = isChargeCorrect
        ? Math.round((mechanic?.quickPlayValue ?? 5) * CHARGE_CORRECT_MULTIPLIER + getMasterySecondaryBonus(mechanicId, card.masteryLevel ?? 0))
        : (isChargeWrong ? Math.round((card.secondaryValue ?? mechanic?.secondaryValue ?? 5) * 0.7) : applyShieldRelics(card.secondaryValue ?? mechanic?.secondaryValue ?? 5));
      result.shieldApplied = applyShieldRelics(ironWaveBlock);
      return result;
    }
    // Filler: Shrug It Off — block + draw on QP/CC (no draw on CW)
    case 'shrug_it_off': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (!isChargeWrong) {
        // L3+ draws 2 instead of 1 (addTagAtLevel: [3, 'draw2'])
        const draws = (card.masteryLevel ?? 0) >= 3 ? 2 : 1;
        result.extraCardsDrawn = draws;
      }
      return result;
    }
    // Filler: Bash — damage + apply Vulnerable
    case 'bash': {
      applyAttackDamage(finalValue);
      const bashVulnDuration = isChargeCorrect ? 2 : 1;
      // L3+ bonus: +1 Vuln duration (addTagAtLevel: [3, 'vuln_ext'])
      const masteryVulnBonus = (card.masteryLevel ?? 0) >= 3 ? 1 : 0;
      result.statusesApplied.push({
        type: 'vulnerable',
        value: 1,
        turnsRemaining: bashVulnDuration + masteryVulnBonus,
      });
      return result;
    }
    // Filler: Sap — small damage + apply Weakness
    case 'sap': {
      applyAttackDamage(finalValue);
      const sapWeakDuration = isChargeCorrect ? 2 : 1;
      // L3+ bonus: +1 Weakness duration
      const masteryWeakBonus = (card.masteryLevel ?? 0) >= 3 ? 1 : 0;
      result.statusesApplied.push({
        type: 'weakness',
        value: 1,
        turnsRemaining: sapWeakDuration + masteryWeakBonus,
      });
      return result;
    }
    // Bleed: Rupture — damage + Bleed stacks
    case 'rupture': {
      applyAttackDamage(finalValue);
      const ruptureBleed = isChargeCorrect ? 8 : (isChargeWrong ? 2 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 3));
      result.applyBleedStacks = ruptureBleed;
      return result;
    }
    // Burn: Kindle — damage + Burn, and the hit itself triggers the Burn immediately
    case 'kindle': {
      applyAttackDamage(finalValue);
      const kindleBurn = isChargeCorrect ? 8 : (isChargeWrong ? 2 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 4));
      result.applyBurnStacks = kindleBurn;
      // hitCount = 1 so turnManager triggers Burn once on this hit
      result.hitCount = 1;
      return result;
    }
    // New: Overcharge — QP/CW fixed damage; CC scales with encounter charge count
    case 'overcharge': {
      // The turnManager will read encounterChargeCount to compute CC bonus.
      // We set a flag via mechanicId being 'overcharge' — turnManager handles scaling.
      applyAttackDamage(finalValue);
      return result;
    }
    // New: Riposte — hybrid damage + block
    case 'riposte': {
      applyAttackDamage(finalValue);
      const riposteBlock = isChargeCorrect
        ? Math.round(12 * focusAdjustedMultiplier * chainMultiplier * speedBonus * buffMultiplier * overclockMultiplier)
        : (isChargeWrong ? applyShieldRelics(Math.round((card.secondaryValue ?? mechanic?.secondaryValue ?? 4) * 0.75))
          : applyShieldRelics(card.secondaryValue ?? mechanic?.secondaryValue ?? 4));
      result.shieldApplied = applyShieldRelics(riposteBlock);
      return result;
    }
    // New: Absorb — block, CC also draws a card
    case 'absorb': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (isChargeCorrect) {
        // L3+ draws 2 instead of 1
        const draws = (card.masteryLevel ?? 0) >= 3 ? 2 : 1;
        result.extraCardsDrawn = draws;
      }
      return result;
    }
    // New: Reactive Shield — block + Thorns for turns
    case 'reactive_shield': {
      result.shieldApplied = applyShieldRelics(finalValue);
      const rsThornValue = isChargeCorrect ? 5 : (isChargeWrong ? 1 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 2));
      const rsThornDuration = isChargeCorrect ? 2 : 1;
      // L3+ bonus: +1 Thorns base
      const masteryThornsBonus = (card.masteryLevel ?? 0) >= 3 ? 1 : 0;
      result.thornsValue = rsThornValue + masteryThornsBonus;
      return result;
    }
    // New: Sift — scry (look at top N, discard some)
    case 'sift': {
      const siftLookAt = isChargeCorrect ? 5 : (isChargeWrong ? 2 : (card.baseEffectValue ?? 3));
      const siftDiscard = isChargeCorrect ? 2 : 1;
      result.siftParams = { lookAt: siftLookAt, discardCount: siftDiscard };
      return result;
    }
    // New: Scavenge — retrieve card(s) from discard to top of draw
    case 'scavenge': {
      const scavengeCount = isChargeCorrect ? 2 : 1;
      // L3+ on QP: also retrieves 2 (same as CC)
      const masteryScavengeBonus = (!isChargeCorrect && !isChargeWrong && (card.masteryLevel ?? 0) >= 3) ? 1 : 0;
      result.scavengeCount = scavengeCount + masteryScavengeBonus;
      return result;
    }
    // New: Precision Strike — damage; timer extension handled by quiz system reading mechanic tag
    case 'precision_strike': {
      applyAttackDamage(finalValue);
      // Timer extension (+50%, or +75% at L3+) is handled by the quiz timer system via mechanic ID.
      return result;
    }
    // New: Stagger — skip enemy next action
    case 'stagger': {
      result.applyStagger = true;
      if (isChargeCorrect) {
        result.statusesApplied.push({ type: 'vulnerable', value: 1, turnsRemaining: 1 });
      }
      // L3+ bonus on QP: also apply Weakness
      if (!isChargeCorrect && !isChargeWrong && (card.masteryLevel ?? 0) >= 3) {
        result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    // New: Corrode — remove enemy block + apply Weakness
    case 'corrode': {
      // QP: remove 5 block + 1t Weakness; CC: remove ALL block + 2t Weakness; CW: remove 3 + 1t
      const corrodeRemove = isChargeCorrect ? -1 : (isChargeWrong ? 3 : finalValue); // -1 = remove all
      const corrodeWeakDuration = isChargeCorrect ? 2 : 1;
      // L3+ bonus: +1 Weakness duration
      const masteryWeakBonusC = (card.masteryLevel ?? 0) >= 3 ? 1 : 0;
      result.removeEnemyBlock = corrodeRemove;
      result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: corrodeWeakDuration + masteryWeakBonusC });
      return result;
    }
    // New: Swap — discard 1, draw 1 (QP/CW) or draw 2 (CC)
    case 'swap': {
      const swapDrawCount = isChargeCorrect ? 2 : 1;
      // L3+ CC: draws 3
      const masterySwapBonus = (isChargeCorrect && (card.masteryLevel ?? 0) >= 3) ? 1 : 0;
      result.swapDiscardDraw = { discardCount: 1, drawCount: swapDrawCount + masterySwapBonus };
      return result;
    }
    // New: Siphon Strike — damage + overkill heal (min 2, max 10)
    case 'siphon_strike': {
      applyAttackDamage(finalValue);
      if (!isChargeWrong) {
        // Overkill heal computed here; turnManager adjusts based on actual HP remaining.
        // We store the min heal; turnManager computes overkill and clamps.
        const minHeal = (card.masteryLevel ?? 0) >= 3 ? 3 : 2;
        result.overkillHeal = minHeal; // sentinel: turnManager computes actual overkill
      }
      return result;
    }
    // New: Aegis Pulse — block; CC also grants chain block bonus to same-chain cards
    case 'aegis_pulse': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (isChargeCorrect) {
        // L3+: chain buff = +3 instead of +2
        const chainBuff = (card.masteryLevel ?? 0) >= 3 ? 3 : 2;
        result.chainBlockBonus = chainBuff;
      }
      return result;
    }
    // New: Inscription of Fury — persistent attack bonus for rest of combat
    case 'inscription_fury': {
      // resolveInscription() in turnManager handles registration + exhaust.
      // finalValue encodes the per-attack bonus (QP=2, CC=4, CW=1 + mastery).
      result.finalValue = finalValue;
      return result;
    }
    // New: Inscription of Iron — persistent block per turn for rest of combat
    case 'inscription_iron': {
      // resolveInscription() in turnManager handles registration + exhaust.
      // finalValue encodes the per-turn block bonus (QP=3, CC=6, CW=1 + mastery).
      result.finalValue = finalValue;
      return result;
    }

    // ── AR-207: Phase 2 Identity / Flagship Cards ───────────────────────────

    // Gambit — HP swing attack
    case 'gambit': {
      applyAttackDamage(finalValue);
      const masteryL3 = (card.masteryLevel ?? 0) >= 3;
      if (isChargeCorrect) {
        result.gambitHeal = 5;
        result.healApplied = 5;
      } else if (isChargeWrong) {
        const selfDmg = masteryL3 ? 4 : 5;
        result.gambitselfDamage = selfDmg;
        result.selfDamage = selfDmg;
      } else {
        // QP
        const selfDmg = masteryL3 ? 1 : 2;
        result.gambitselfDamage = selfDmg;
        result.selfDamage = selfDmg;
      }
      return result;
    }

    // Chain Lightning — chain-scaling attack (turnManager overrides CC damage)
    case 'chain_lightning': {
      // QP: always 8 base (+ mastery bonus already in finalValue); CW: 5 (+ mastery).
      // CC: turnManager reads chainLightningChainLength and overrides damageDealt.
      //     Resolver sets a sentinel (8 * 1 = base) — turnManager replaces it.
      if (isChargeCorrect) {
        // Sentinel: will be overridden by turnManager after chain is extended
        applyAttackDamage(finalValue);
        result.chainLightningChainLength = 1; // sentinel; turnManager sets real value
      } else {
        applyAttackDamage(finalValue);
      }
      return result;
    }

    // Volatile Slash — exhaust on CC
    case 'volatile_slash': {
      applyAttackDamage(finalValue);
      if (isChargeCorrect) {
        result.exhaustOnResolve = true;
      }
      return result;
    }

    // Burnout Shield — exhaust on CC
    case 'burnout_shield': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (isChargeCorrect) {
        result.exhaustOnResolve = true;
      }
      return result;
    }

    // Knowledge Ward — block per unique domain in hand
    case 'knowledge_ward': {
      // handDomains is populated by turnManager; fallback to 1 domain if absent.
      const domains = advanced.handDomains ?? [];
      const uniqueDomainCount = new Set(domains.filter(Boolean)).size || 1;
      // finalValue = per-domain block value (QP/CC/CW base + mastery bonus already applied).
      const blockTotal = Math.round(finalValue * uniqueDomainCount);
      result.shieldApplied = applyShieldRelics(blockTotal);
      result.knowledgeWardBlock = finalValue; // per-domain value for UI
      return result;
    }

    // Warcry — Strength buff + optional free Charge
    case 'warcry': {
      const masteryL3Warcry = (card.masteryLevel ?? 0) >= 3;
      if (isChargeCorrect) {
        // +2 Str permanent + free Charge flag
        result.applyStrengthToPlayer = { value: 2, permanent: true };
        result.warcryFreeCharge = true;
      } else if (isChargeWrong) {
        // +1 Str this turn only
        result.applyStrengthToPlayer = { value: 1, permanent: false };
      } else {
        // QP: +2 Str this turn; L3+: also +1 Str permanent
        result.applyStrengthToPlayer = { value: 2, permanent: false };
        if (masteryL3Warcry) {
          // Handled in turnManager: check for warcry_perm_str tag at L3+
          result.warcryFreeCharge = false; // no free charge on QP
        }
      }
      result.finalValue = isChargeCorrect ? 2 : (isChargeWrong ? 1 : 2);
      return result;
    }

    // Battle Trance — draw + optional lockout
    case 'battle_trance': {
      const masteryL3BT = (card.masteryLevel ?? 0) >= 3;
      if (isChargeCorrect) {
        // Draw 3, no restriction
        result.battleTranceDraw = 3;
        result.extraCardsDrawn = 3;
      } else if (isChargeWrong) {
        // Draw 2, locked out
        result.battleTranceDraw = 2;
        result.extraCardsDrawn = 2;
        result.applyBattleTranceRestriction = true;
      } else {
        // QP: draw 3 (or 4 at L3+), locked out
        const drawCount = masteryL3BT ? 4 : 3;
        result.battleTranceDraw = drawCount;
        result.extraCardsDrawn = drawCount;
        result.applyBattleTranceRestriction = true;
      }
      return result;
    }

    // Curse of Doubt — charge damage percent amplifier on enemy
    case 'curse_of_doubt': {
      // finalValue = percent bonus (30/50/20 base + mastery bonus via perLevelDelta=5)
      const doubTurns = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.applyChargeDamageAmpPercent = { value: finalValue, turns: doubTurns };
      return result;
    }

    // Mark of Ignorance — charge damage flat amplifier on enemy
    case 'mark_of_ignorance': {
      // finalValue = flat bonus (3/5/2 base + mastery bonus via perLevelDelta=1)
      const markTurns = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.applyChargeDamageAmpFlat = { value: finalValue, turns: markTurns };
      return result;
    }

    // Corroding Touch — 0 AP, Weakness + optional Vulnerable
    case 'corroding_touch': {
      const masteryBonusDuration = getMasteryBaseBonus(mechanicId, card.masteryLevel ?? 0);
      if (isChargeCorrect) {
        // 3 Weakness (2t) + 2 Vulnerable (1t)
        result.statusesApplied.push({
          type: 'weakness',
          value: 3,
          turnsRemaining: 2 + Math.round(masteryBonusDuration),
        });
        result.statusesApplied.push({
          type: 'vulnerable',
          value: 2,
          turnsRemaining: 1,
        });
      } else if (isChargeWrong) {
        // 1 Weakness (1t)
        result.statusesApplied.push({
          type: 'weakness',
          value: 1,
          turnsRemaining: 1 + Math.round(masteryBonusDuration),
        });
      } else {
        // QP: 2 Weakness (1t + mastery duration)
        result.statusesApplied.push({
          type: 'weakness',
          value: 2,
          turnsRemaining: 1 + Math.round(masteryBonusDuration),
        });
      }
      return result;
    }

    // Phase Shift — choice: damage or block (QP/CW); both (CC)
    case 'phase_shift': {
      if (isChargeCorrect) {
        // 12 dmg AND 12 block simultaneously
        const psValue = finalValue;
        applyAttackDamage(psValue);
        result.shieldApplied = applyShieldRelics(psValue);
        result.phaseShiftBothDmgAndBlock = { damage: psValue, block: psValue };
      } else {
        // QP/CW: choose damage or block — auto-select damage (popup wired in encounterBridge later)
        // For now: default to damage. turnManager will handle pendingChoice when popup is wired.
        applyAttackDamage(finalValue);
        result.phaseShiftChoice = 'damage'; // placeholder until popup wired
      }
      return result;
    }

    // Chameleon — copy last card at multiplier
    case 'chameleon': {
      // turnManager resolves the actual copy using lastPlayedMechanicId.
      // We emit the multiplier; turnManager handles copy resolution.
      const chameleonMult = isChargeCorrect ? 1.3 : (isChargeWrong ? 0.7 : 1.0);
      result.chameleonMultiplier = chameleonMult;
      if (isChargeCorrect) {
        result.chameleonInheritChain = true;
      }
      // Check L3+ QP chain inherit
      if (!isChargeCorrect && !isChargeWrong && (card.masteryLevel ?? 0) >= 3) {
        result.chameleonInheritChain = true;
      }
      // Damage/shield/draw is resolved by turnManager after reading lastPlayedMechanicId.
      // This card itself does 0 effect without a previous card.
      return result;
    }

    // Dark Knowledge — damage per cursed fact
    case 'dark_knowledge': {
      const cursedCount = advanced.cursedFactCount ?? 0;
      const dmgPerCurse = isChargeCorrect ? 5 : (isChargeWrong ? 1 : 3);
      // Apply mastery bonus (+1 per level to dmg per curse base)
      const masteryDmgBonus = getMasteryBaseBonus(mechanicId, card.masteryLevel ?? 0);
      const effectiveDmgPerCurse = dmgPerCurse + masteryDmgBonus;
      const totalDamage = effectiveDmgPerCurse * cursedCount;
      if (totalDamage > 0) {
        applyAttackDamage(totalDamage);
      }
      result.darkKnowledgeDmgPerCurse = effectiveDmgPerCurse;
      return result;
    }

    // Chain Anchor — draw + optional chain anchor flag
    case 'chain_anchor': {
      // Draws 1 in all modes. CC also sets chainAnchorActive.
      // Chain Anchor is NOT a chain link itself.
      result.extraCardsDrawn = 1;
      if (isChargeCorrect) {
        result.applyChainAnchor = true;
      }
      return result;
    }

    // Unstable Flux — random (QP/CW) or chosen (CC) effect
    case 'unstable_flux': {
      const fluxMult = isChargeCorrect ? 1.5 : (isChargeWrong ? 0.7 : 1.0);
      const baseDmg = Math.round(10 * fluxMult);
      const baseBlock = Math.round(10 * fluxMult);
      const baseDraw = Math.max(1, Math.round(2 * fluxMult));
      const baseWeakTurns = isChargeCorrect ? 3 : 2;

      if (isChargeCorrect) {
        // CC: player CHOOSES — auto-select damage for now (popup wired later).
        // In real integration, turnManager will present MultiChoicePopup and resolve chosen effect.
        // For headless sim: default to damage.
        applyAttackDamage(baseDmg);
        result.unstableFluxEffect = 'damage';
      } else {
        // QP/CW: random selection
        const masteryL3Flux = (card.masteryLevel ?? 0) >= 3;
        // At L3+ QP, player chooses 1 of 2 pre-selected options (simulated as random for now).
        const roll = Math.floor(Math.random() * 4);
        if (roll === 0) {
          applyAttackDamage(baseDmg);
          result.unstableFluxEffect = 'damage';
        } else if (roll === 1) {
          result.shieldApplied = applyShieldRelics(baseBlock);
          result.unstableFluxEffect = 'block';
        } else if (roll === 2) {
          result.extraCardsDrawn = baseDraw;
          result.unstableFluxEffect = 'draw';
        } else {
          result.statusesApplied.push({ type: 'weakness', value: 2, turnsRemaining: baseWeakTurns });
          result.unstableFluxEffect = 'debuff';
        }
      }
      return result;
    }

    default:
      break;
  }

  // Fallback behavior by card type (phase-1 compatibility).
  switch (effectiveType) {
    case 'attack': {
      applyAttackDamage(finalValue);
      break;
    }
    case 'shield': {
      result.shieldApplied = applyShieldRelics(finalValue);
      break;
    }
    case 'buff': {
      result.finalValue = finalValue + (passiveBonuses?.buff ?? 0);
      break;
    }
    case 'debuff': {
      const debuffFinal = finalValue + (passiveBonuses?.debuff ?? 0);
      const weaknessValue = Math.floor(debuffFinal / 2);
      if (weaknessValue > 0) {
        result.statusesApplied.push({
          type: 'weakness',
          value: weaknessValue,
          turnsRemaining: 2,
        });
      }
      if (debuffFinal >= 5) {
        result.statusesApplied.push({
          type: 'vulnerable',
          value: 1,
          turnsRemaining: 2,
        });
      }
      break;
    }
    case 'utility': {
      result.extraCardsDrawn = Math.max(1, finalValue + (passiveBonuses?.utility ?? 0));
      break;
    }
    case 'wild':
      break;
  }

  return result;
}
