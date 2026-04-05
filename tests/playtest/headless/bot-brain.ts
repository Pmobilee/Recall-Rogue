/**
 * BotBrain — Parameterized Decision Engine for Headless Simulator
 * ================================================================
 * Replaces hardcoded dumb-bot logic in simulator.ts / full-run-simulator.ts.
 * All decision-making is driven by a BotSkills profile (axes 0–1).
 *
 * Usage:
 *   const brain = new BotBrain(skills);
 *   const plan  = brain.planTurn(hand, turnState, ascMods);
 *   // plan is { cardId, mode }[] — the simulator then rolls accuracy per play
 */

import type { Card, CardType } from '../../../src/data/card-types.js';
import type { MechanicDefinition } from '../../../src/data/mechanics.js';
import { getMechanicDefinition } from '../../../src/data/mechanics.js';
import type { TurnState } from '../../../src/services/turnManager.js';
import type { MapNode } from '../../../src/services/mapGenerator.js';
import {
  CHARGE_CORRECT_MULTIPLIER,
  FIZZLE_EFFECT_RATIO,
  CHAIN_MULTIPLIERS,
  SURGE_INTERVAL,
  SURGE_FIRST_TURN,
  CHARGE_AP_SURCHARGE,
} from '../../../src/data/balance.js';
import {
  MASTERY_UPGRADE_DEFS,
  getMasteryBaseBonus,
} from '../../../src/services/cardUpgradeService.js';

export { CHARGE_CORRECT_MULTIPLIER, FIZZLE_EFFECT_RATIO, CHAIN_MULTIPLIERS, SURGE_INTERVAL };

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

/** All skill axes that govern bot decision quality (0 = worst, 1 = optimal). */
export interface BotSkills {
  /** 0–1: probability of answering a quiz question correctly */
  accuracy: number;
  /** 0–1: hand ordering quality (which cards to play first) */
  cardSelection: number;
  /** 0–1: charge-vs-quick-play decision quality */
  chargeSkill: number;
  /** 0–1: chain type awareness and sequencing quality */
  chainSkill: number;
  /** 0–1: shield/block prioritization intelligence */
  blockSkill: number;
  /** 0–1: AP usage optimization (filling remaining AP with cheap cards) */
  apEfficiency: number;
  /** 0–1: surge turn exploitation (CC bonus multiplier + extra draw) */
  surgeAwareness: number;
  /** 0–1: preference for charging high-perLevelDelta cards to gain mastery */
  masteryHunting: number;
  /** 0–1: card reward selection quality */
  rewardSkill: number;
  /** 0–1: shop purchase intelligence */
  shopSkill: number;
  /** 0–1: rest site decision quality (heal vs study) */
  restSkill: number;
  /** 0–1: relic selection quality (tier awareness + context bonuses) */
  relicSkill: number;
}

/** A single planned card play (mode only — accuracy roll happens in simulator). */
export interface CardPlay {
  cardId: string;
  mode: 'charge' | 'quick';
}

/** Shop action options the bot can choose. */
export type ShopAction =
  | { type: 'buy_card'; index: number }
  | { type: 'buy_relic'; index: number }
  | { type: 'remove_card' }
  | { type: 'buy_food' }
  | { type: 'skip' };

/** Minimal ascension modifier shape used by planTurn. */
export interface AscensionMods {
  freeCharging?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Return true if this global turn number is a Surge turn (CC bonus multiplier + extra draw). */
function isSurgeTurn(globalTurnNumber: number): boolean {
  // Surge on turns: SURGE_FIRST_TURN, SURGE_FIRST_TURN + SURGE_INTERVAL, ...
  // e.g. turns 2, 6, 10, 14 (first turn = 1, so first surge at turn 2)
  if (globalTurnNumber < SURGE_FIRST_TURN) return false;
  return (globalTurnNumber - SURGE_FIRST_TURN) % SURGE_INTERVAL === 0;
}

/**
 * Get perLevelDelta for a mechanic (used for mastery-hunting priority).
 * Returns 0 if mechanic has no mastery def or perLevelDelta = 0.
 */
function getPerLevelDelta(mechanicId: string): number {
  return MASTERY_UPGRADE_DEFS[mechanicId]?.perLevelDelta ?? 0;
}

/**
 * Estimate the quick-play effective value for a card, including mastery bonus.
 * Uses mechanic.quickPlayValue (the actual quick-play value, e.g. Strike=4)
 * rather than baseEffectValue (the combined total, e.g. Strike=8).
 */
function cardQuickPlayEffective(card: Card): number {
  const mechanic = getMechanicDefinition(card.mechanicId);
  const qpv = mechanic?.quickPlayValue ?? card.baseEffectValue ?? 0;
  const masteryBonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  return qpv + masteryBonus;
}

/**
 * Estimate charge EV per card using per-mechanic chargeWrongValue.
 * chargeEV = acc × (qpv + masteryBonus) × 1.5 + (1-acc) × (mechanic.chargeWrongValue + masteryBonus)
 * vs quickEV = qpv + masteryBonus
 * Returns raw EVs so the caller can compare.
 */
function computeChargeEV(card: Card, accuracy: number): { chargeEV: number; quickEV: number } {
  const mechanic = getMechanicDefinition(card.mechanicId);
  const qpv = mechanic?.quickPlayValue ?? card.baseEffectValue ?? 0;
  const masteryBonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);

  const chargeCorrectValue = (qpv + masteryBonus) * CHARGE_CORRECT_MULTIPLIER;
  const chargeWrongValue = (mechanic?.chargeWrongValue ?? qpv * FIZZLE_EFFECT_RATIO) + masteryBonus;

  const chargeEV = accuracy * chargeCorrectValue + (1 - accuracy) * chargeWrongValue;
  const quickEV = qpv + masteryBonus;
  return { chargeEV, quickEV };
}

/** True if a card type is primarily defensive (not damage-dealing). */
function isDefensiveType(type: CardType): boolean {
  return type === 'shield';
}

/** True if a card type is primarily a buff/utility (low multiplier payoff for charging). */
function isBuffOrUtility(type: CardType): boolean {
  return type === 'buff' || type === 'utility';
}

// ──────────────────────────────────────────────────────────────────────────────
// BotBrain
// ──────────────────────────────────────────────────────────────────────────────

/**
 * BotBrain — parameterized decision engine for the headless simulator.
 *
 * Instantiate once per profile. Call planTurn() each time the simulator
 * needs to decide what to do with the current hand.
 *
 * IMPORTANT: planTurn returns a plan of { cardId, mode } pairs. It does NOT
 * roll accuracy (that's the simulator's job). The plan is the bot's *intent*;
 * whether the charge succeeds is determined by Math.random() < skills.accuracy.
 */
export class BotBrain {
  constructor(public readonly skills: BotSkills) {}

  // ── planTurn ──────────────────────────────────────────────────────────────

  /**
   * Plan the current turn: return an ordered list of card plays.
   * The simulator will iterate the plan, apply AP checks, and roll accuracy.
   *
   * @param hand        Cards currently in hand
   * @param turnState   Full TurnState from the simulator
   * @param ascMods     Ascension modifiers (for freeCharging check)
   * @returns           Ordered plan of { cardId, mode } — may be fewer than hand.length
   *                    if the bot chooses to skip some cards
   */
  planTurn(hand: Card[], turnState: TurnState, ascMods: AscensionMods = {}): CardPlay[] {
    const { skills } = this;
    const isSurge = isSurgeTurn(turnState.turnNumber);
    // CHARGE_AP_SURCHARGE = 0: Charge costs same AP as Quick Play for all turns
    const chargeSurcharge = CHARGE_AP_SURCHARGE;
    const apAvailable = turnState.apCurrent;
    const playerHpPct = turnState.playerState.hp / (turnState.playerState.maxHP || 100);
    const enemyHp = turnState.enemy.currentHP;
    const currentChainType = turnState.chainType;
    const chainMomentumType = turnState.nextChargeFreeForChainType;

    // Read enemy intent for block scoring
    const nextIntent = turnState.enemy.nextIntent;
    const enemyNextDamage = nextIntent
      ? (nextIntent.type === 'attack' || nextIntent.type === 'multi_attack'
        ? nextIntent.value * (nextIntent.hitCount ?? 1)
        : 0)
      : 0;

    // Step 1: Order cards using cardSelection + chainSkill + blockSkill axes
    let ordered = this._orderHand(hand, {
      playerHpPct,
      enemyHp,
      currentChainType,
      apAvailable,
      chargeSurcharge,
      enemyNextDamage,
      playerShield: turnState.playerState?.shield ?? 0,
    });

    // Step 2: Build play plan — decide mode per card
    const plan: CardPlay[] = [];
    let apRemaining = apAvailable;

    for (const card of ordered) {
      const apCost = card.apCost ?? 1;
      if (apRemaining < apCost) {
        // apEfficiency: look ahead for cheaper cards (skill >= 0.5)
        if (skills.apEfficiency >= 0.5) {
          // We'll skip this card and try cheaper ones — continue
          continue;
        } else {
          break; // low apEfficiency: stop on first unaffordable card
        }
      }

      // Chain momentum: if this card's chainType matches the momentum type, no surcharge
      const hasMomentum = chainMomentumType !== null && card.chainType === chainMomentumType;
      const effectiveSurcharge = hasMomentum ? 0 : chargeSurcharge;
      const chargeApCost = apCost + effectiveSurcharge;
      const canCharge = apRemaining >= chargeApCost;
      const mode = this._decideMode(card, canCharge, isSurge, currentChainType, plan.length, hasMomentum);

      plan.push({ cardId: card.id, mode });
      apRemaining -= mode === 'charge' ? chargeApCost : apCost;
    }

    return plan;
  }

  // ── _orderHand ────────────────────────────────────────────────────────────

  private _orderHand(
    hand: Card[],
    ctx: {
      playerHpPct: number;
      enemyHp: number;
      currentChainType: number | null;
      apAvailable: number;
      chargeSurcharge: number;
      enemyNextDamage: number;
      playerShield: number;
    },
  ): Card[] {
    const { skills } = this;
    const { playerHpPct, enemyHp, currentChainType, apAvailable, chargeSurcharge, enemyNextDamage, playerShield } = ctx;

    if (skills.cardSelection < 0.3) {
      // 0.0–0.3: play in hand order
      return [...hand];
    }

    const scored = hand.map(card => {
      let score = 0;

      // ── blockSkill contribution ─────────────────────────────────────────
      const isDefensive = isDefensiveType(card.cardType);
      if (isDefensive) {
        if (skills.blockSkill >= 0.3 && playerHpPct < 0.3) {
          // Urgently prioritize shields when HP low
          score += 200 * skills.blockSkill;
        } else if (skills.blockSkill >= 0.7 && enemyNextDamage > 0) {
          // Smart block: prioritize shields when enemy damage is high
          const shieldValue = cardQuickPlayEffective(card);
          score += 100 * Math.min(shieldValue / enemyNextDamage, 1.0) * skills.blockSkill;
        } else {
          // Linear shield deprioritization: -50 at blockSkill=0, fades to 0 at blockSkill≥0.5
          const shieldPenalty = Math.max(0, Math.round(50 * (1 - skills.blockSkill / 0.5)));
          if (shieldPenalty > 0) score -= shieldPenalty;
        }

        // Persistence-aware shield scoring: block compounds value over remaining turns
        if (skills.blockSkill >= 0.5 && enemyHp > 0) {
          const shieldValue = cardQuickPlayEffective(card);
          // Estimate average damage per turn from attack cards in hand
          const attackCards = hand.filter(c => !isDefensiveType(c.cardType));
          const avgDpt = attackCards.length > 0
            ? attackCards.reduce((sum, c) => sum + cardQuickPlayEffective(c), 0) / attackCards.length
            : 1;
          const estimatedTurnsLeft = Math.ceil(enemyHp / Math.max(avgDpt, 1));
          if (estimatedTurnsLeft > 1) {
            const persistenceBonus = shieldValue * Math.min(estimatedTurnsLeft, 4) * 0.15 * skills.blockSkill;
            score += persistenceBonus;
          }
        }
      }

      // ── cardSelection: attack priority and efficiency ───────────────────
      if (skills.cardSelection >= 0.3 && !isDefensive) {
        score += 50; // prefer attacks over shields at base level
      }

      if (skills.cardSelection >= 0.7) {
        // Score by damage efficiency: quickPlayValue / apCost
        const qpv = cardQuickPlayEffective(card);
        const apCost = card.apCost ?? 1;
        score += (qpv / apCost) * 10;

        // Prefer high-mastery cards (they scale better)
        score += (card.masteryLevel ?? 0) * 5;
      }

      if (skills.cardSelection >= 1.0) {
        // Finish kill: if enemy HP is low, prefer high-damage cards
        const qpv = cardQuickPlayEffective(card);
        if (enemyHp > 0 && qpv >= enemyHp) {
          score += 300; // finishing blow priority
        }
        // Defensive when player is critically low
        if (playerHpPct < 0.2 && isDefensive) {
          score += 200;
        }
      }

      // ── chainSkill contribution ─────────────────────────────────────────
      if (skills.chainSkill >= 0.3 && currentChainType !== null) {
        if (card.chainType === currentChainType) {
          score += 80 * skills.chainSkill; // reward continuing chain
        }
      }

      if (skills.chainSkill >= 0.7) {
        // Count how many cards in hand share this card's chain type
        const chainTypeCount = hand.filter(c => c.chainType === card.chainType).length;
        if (chainTypeCount >= 2) {
          score += 40 * chainTypeCount * skills.chainSkill;
        }
      }

      // ── apEfficiency: prefer cards we can actually afford ───────────────
      if (skills.apEfficiency >= 1.0) {
        const apCost = card.apCost ?? 1;
        // Slightly deprioritize cards that cost more than our remaining AP budget split
        if (apCost > apAvailable * 0.6) {
          score -= 20;
        }
      }

      // ── blockSkill: don't waste AP on block-dependent cards with no block ──
      // Entrench (fortify) and Shield Bash (conversion) do nothing without existing block
      if ((card.mechanicId === 'fortify' || card.mechanicId === 'conversion') &&
          playerShield < 5) {
        score -= 500; // Don't waste AP on block-dependent cards with no block
      }

      return { card, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .map(s => s.card);
  }

  // ── _decideMode ───────────────────────────────────────────────────────────

  private _decideMode(
    card: Card,
    canCharge: boolean,
    isSurge: boolean,
    currentChainType: number | null,
    playsInPlanSoFar: number,
    hasMomentum: boolean = false,
  ): 'charge' | 'quick' {
    if (!canCharge) return 'quick';

    const { skills } = this;
    const acc = skills.accuracy;

    // surgeAwareness: during surge turns, ALWAYS charge (CC bonus multiplier = always higher EV)
    if (isSurge && skills.surgeAwareness >= 1.0) return 'charge';
    if (isSurge && skills.surgeAwareness >= 0.5) {
      // 50% boost to charge rate during surge (CC bonus multiplier)
      if (Math.random() < Math.min(1.0, acc * 1.5)) return 'charge';
    }

    // Chain momentum: surcharge waived — even low-skill players should charge when free
    if (hasMomentum && skills.chargeSkill >= 0.1) return 'charge';

    if (skills.chargeSkill < 0.3) {
      // 0.0–0.3: randomly charge at a low rate
      const rate = acc * 0.3 * skills.chargeSkill / 0.3;
      return Math.random() < rate ? 'charge' : 'quick';
    }

    if (skills.chargeSkill < 0.5) {
      // 0.3–0.5: charge when EV positive, soft gate on buff/utility
      if (acc < 0.35) return 'quick';
      if (isBuffOrUtility(card.cardType) && Math.random() > skills.chargeSkill) return 'quick';
      return 'charge';
    }

    if (skills.chargeSkill < 0.7) {
      // 0.5–0.7: charge at EV break-even, also factor in card type
      if (acc < 0.35) return 'quick';
      if (isBuffOrUtility(card.cardType) && Math.random() > skills.chargeSkill) return 'quick';
      return 'charge';
    }

    // 0.7–1.0: Full EV calculation
    // buff/utility cards: charging has low multiplier payoff, skip
    if (isBuffOrUtility(card.cardType) && skills.chargeSkill < 0.9) return 'quick';

    const { chargeEV, quickEV } = computeChargeEV(card, acc);
    if (chargeEV <= quickEV) return 'quick';

    // masteryHunting: prefer charging high-perLevelDelta cards
    if (skills.masteryHunting >= 0.5) {
      const delta = getPerLevelDelta(card.mechanicId ?? '');
      if (delta <= 0 && skills.masteryHunting >= 0.5) return 'quick'; // no mastery gain
      if (!isDefensiveType(card.cardType)) return 'charge'; // prefer attack mastery
    }

    // chainSkill: commit to chain — if this card matches current chain and 3+ in hand, always charge
    if (skills.chainSkill >= 1.0 && currentChainType !== null && card.chainType === currentChainType) {
      return 'charge';
    }

    // masteryHunting at 1.0: prioritize highest perLevelDelta and lowest mastery
    if (skills.masteryHunting >= 1.0) {
      const delta = getPerLevelDelta(card.mechanicId ?? '');
      const masteryLevel = card.masteryLevel ?? 0;
      // Charge if high scaling potential and room to grow
      if (delta >= 1.0 && masteryLevel < 5) return 'charge';
    }

    return chargeEV > quickEV ? 'charge' : 'quick';
  }

  // ── pickReward ────────────────────────────────────────────────────────────

  /**
   * Pick a card reward from the offered options.
   *
   * @param options      Card mechanics offered as rewards
   * @param currentDeck  Current deck cards (for deck composition analysis)
   * @returns            Chosen mechanic, or null to skip the reward
   */
  pickReward(options: MechanicDefinition[], currentDeck: Card[]): MechanicDefinition | null {
    if (options.length === 0) return null;

    const { skills } = this;

    if (skills.rewardSkill < 0.3) {
      // Random pick
      return options[Math.floor(Math.random() * options.length)];
    }

    if (skills.rewardSkill < 0.7) {
      // Balance deck type distribution — prefer under-represented types
      const typeCounts: Partial<Record<CardType, number>> = {};
      for (const card of currentDeck) {
        typeCounts[card.cardType] = (typeCounts[card.cardType] ?? 0) + 1;
      }
      const deckSize = currentDeck.length || 1;

      let bestOption = options[0];
      let bestScore = -Infinity;

      for (const opt of options) {
        const currentPct = (typeCounts[opt.type] ?? 0) / deckSize;
        const perLevelDelta = MASTERY_UPGRADE_DEFS[opt.id]?.perLevelDelta ?? 0;
        const apCost = opt.apCost ?? 1;
        // Delta-aware: value mastery scaling for ALL card types, gap-fill bonus, penalize high AP cost
        const score = (perLevelDelta * 10) + (1.0 - currentPct) * 5 - (apCost - 1) * 3;
        if (score > bestScore) {
          bestScore = score;
          bestOption = opt;
        }
      }

      return bestOption;
    }

    // 0.7–1.0: Prefer high-perLevelDelta attack cards, fill gaps, consider synergy
    let bestOption = options[0];
    let bestScore = -Infinity;

    const typeCounts: Partial<Record<CardType, number>> = {};
    for (const card of currentDeck) {
      typeCounts[card.cardType] = (typeCounts[card.cardType] ?? 0) + 1;
    }
    const deckSize = currentDeck.length || 1;

    // Count shield-type cards for block synergy scoring
    const shieldCount = typeCounts['shield'] ?? 0;

    for (const opt of options) {
      let score = 0;

      // Prefer any card type with high mastery scaling (not just attacks)
      const delta = MASTERY_UPGRADE_DEFS[opt.id]?.perLevelDelta ?? 0;
      score += delta * 20;

      // Gap filling
      const currentPct = (typeCounts[opt.type] ?? 0) / deckSize;
      score += (1.0 - currentPct) * 15;

      // Prefer low AP cost for AP efficiency
      score -= opt.apCost * 5;

      // Synergy bonus: Entrench (fortify) and Shield Bash (conversion) are better
      // when the deck already has enough block cards to make them useful
      if ((opt.id === 'fortify' || opt.id === 'conversion') && shieldCount >= 3) {
        score += 15; // Synergy bonus with existing shield cards
      }

      if (score > bestScore) {
        bestScore = score;
        bestOption = opt;
      }
    }

    return bestOption;
  }

  // ── pickRelic ─────────────────────────────────────────────────────────────

  /**
   * Pick the best relic from a set of candidates.
   *
   * @param options          Relic IDs to choose from
   * @param hpPct            Current HP as a fraction of max HP
   * @param deckAttackPct    Fraction of deck cards that are attack type
   * @returns                Chosen relic ID, or empty string if no options
   */
  pickRelic(options: string[], hpPct: number, deckAttackPct: number): string {
    if (options.length === 0) return '';
    if (options.length === 1) return options[0];

    const { relicSkill } = this.skills;

    // Low skill: random
    if (relicSkill < 0.3) return options[Math.floor(Math.random() * options.length)];

    // Score each relic
    const RELIC_TIERS: Record<string, number> = {
      // S-tier (massive impact)
      swift_boots: 100, blood_price: 95, volatile_core: 90, berserker_s_oath: 90,
      scholars_crown: 85, mirror_of_knowledge: 85, phoenix_feather: 85,
      prismatic_shard: 80, capacitor: 80, time_warp: 80,
      // A-tier (strong)
      crit_lens: 70, chain_reactor: 70, quicksilver_quill: 70, double_down: 70,
      scavengers_eye: 65, tag_magnet: 65, adrenaline_shard: 65,
      memory_nexus: 60, overflow_gem: 60, resonance_crystal: 60,
      last_breath: 60, aegis_stone: 60, bastions_will: 60,
      // B-tier (solid)
      whetstone: 50, iron_shield: 50, herbal_pouch: 50, steel_skin: 50,
      vitality_ring: 50, gold_magnet: 45, merchants_favor: 45,
      reckless_resolve: 45, red_fang: 45, domain_mastery_sigil: 45,
      brass_knuckles: 45, battle_scars: 45, regeneration_orb: 45,
      // C-tier (situational)
      lucky_coin: 30, thick_skin: 30, tattered_notebook: 30,
      quick_study: 30, insight_prism: 30, plague_flask: 30,
      chain_forge: 25, scholars_gambit: 25, null_shard: 20, chronometer: 20,
    };

    let bestId = options[0];
    let bestScore = -1;

    for (const id of options) {
      let score = RELIC_TIERS[id] ?? 35; // default B-tier

      // Context bonuses (relicSkill >= 0.5)
      if (relicSkill >= 0.5) {
        if (hpPct < 0.4) {
          // Low HP: prefer sustain
          if (['herbal_pouch', 'regeneration_orb', 'last_breath', 'phoenix_feather', 'vitality_ring', 'steel_skin'].includes(id)) score += 30;
        }
        if (deckAttackPct > 0.6) {
          // Attack-heavy deck: prefer damage relics
          if (['whetstone', 'volatile_core', 'crit_lens', 'red_fang', 'berserker_s_oath'].includes(id)) score += 20;
        }
      }

      // Add some randomness to prevent identical picks
      score += Math.random() * 10 * (1 - relicSkill);

      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }

    return bestId;
  }

  // ── planShop ──────────────────────────────────────────────────────────────

  /**
   * Decide what to do at the shop.
   *
   * @param runState      Current run state (hp, maxHp, gold, deckSize)
   * @param shopCards     Card mechanics available to buy
   * @param shopRelics    Relic IDs available to buy
   * @param removalCost   Gold cost to remove a card
   * @param cardPrice     Gold cost for a card
   * @param relicPrice    Gold cost for a relic
   * @param foodItems     Array of { healPct, cost } food options
   * @returns             Ordered list of actions the bot will take
   */
  planShop(
    runState: { hp: number; maxHp: number; gold: number; deckSize: number },
    shopCards: MechanicDefinition[],
    shopRelics: string[],
    removalCost: number,
    cardPrice: number = 50,
    relicPrice: number = 120,
    foodItems: Array<{ healPct: number; cost: number }> = [],
  ): ShopAction[] {
    const { skills } = this;
    const { hp, maxHp, gold, deckSize } = runState;
    const hpPct = hp / (maxHp || 1);

    if (skills.shopSkill < 0.3) {
      return [{ type: 'skip' }];
    }

    const actions: ShopAction[] = [];
    let goldLeft = gold;

    if (skills.shopSkill >= 0.5) {
      // Rule-based: remove if deck bloated, buy food if HP low
      if (deckSize > 15 && goldLeft >= removalCost) {
        actions.push({ type: 'remove_card' });
        goldLeft -= removalCost;
      }

      if (hpPct < 0.6 && foodItems.length > 0) {
        const cheapFood = foodItems.filter(f => f.cost <= goldLeft).sort((a, b) => a.cost - b.cost)[0];
        if (cheapFood) {
          actions.push({ type: 'buy_food' });
          goldLeft -= cheapFood.cost;
        }
      }

      // Buy a card if we can afford it and deck isn't too large
      if (deckSize <= 20 && shopCards.length > 0 && goldLeft >= cardPrice) {
        actions.push({ type: 'buy_card', index: 0 });
        goldLeft -= cardPrice;
      }
    }

    if (skills.shopSkill >= 1.0) {
      // Prioritize removal of weak starter cards
      if (goldLeft >= removalCost) {
        actions.unshift({ type: 'remove_card' });
        goldLeft -= removalCost;
      }

      // Buy relics if we can afford
      if (shopRelics.length > 0 && goldLeft >= relicPrice) {
        actions.push({ type: 'buy_relic', index: 0 });
        goldLeft -= relicPrice;
      }

      // Buy high-scaling attack cards
      if (shopCards.length > 0 && goldLeft >= cardPrice) {
        const bestIdx = shopCards.reduce((best, cur, idx, arr) => {
          const curDelta = MASTERY_UPGRADE_DEFS[cur.id]?.perLevelDelta ?? 0;
          const bestDelta = MASTERY_UPGRADE_DEFS[arr[best].id]?.perLevelDelta ?? 0;
          return curDelta > bestDelta ? idx : best;
        }, 0);
        if (!actions.some(a => a.type === 'buy_card')) {
          actions.push({ type: 'buy_card', index: bestIdx });
        }
      }
    }

    if (actions.length === 0) actions.push({ type: 'skip' });
    return actions;
  }

  // ── planRest ──────────────────────────────────────────────────────────────

  /**
   * Decide what to do at a rest site.
   *
   * @param runState  Current run state snapshot
   * @returns         'heal', 'study', or 'meditate' (remove a card)
   */
  planRest(runState: { hp: number; maxHp: number; deckSize: number }): 'heal' | 'study' | 'meditate' {
    const { skills } = this;
    const hpPct = runState.hp / (runState.maxHp || 1);

    if (skills.restSkill < 0.3) return 'heal';

    if (skills.restSkill < 0.7) {
      if (hpPct < 0.5) return 'heal';
      if (runState.deckSize > 15) return 'meditate';
      return 'study';
    }

    // 0.7+: smart
    if (hpPct < 0.4) return 'heal';
    if (runState.deckSize > 12) return 'meditate';
    if (hpPct > 0.7) return 'study';
    return 'heal';
  }

  // ── pickRoom ──────────────────────────────────────────────────────────────

  /**
   * Pick the next room from available map nodes.
   * Lower HP → prefer rest/shop; higher HP → prefer combat/elite.
   *
   * @param options   Available map nodes to choose from
   * @param runState  Current run state snapshot
   * @returns         Chosen MapNode
   */
  pickRoom(options: MapNode[], runState: { hp: number; maxHp: number }): MapNode {
    if (options.length === 0) throw new Error('[BotBrain] pickRoom: no options');
    if (options.length === 1) return options[0];

    const hpPct = runState.hp / (runState.maxHp || 1);

    // Score each node type by situation
    const nodeScore = (node: MapNode): number => {
      const type = node.type;
      if (hpPct < 0.3) {
        // Critical HP: desperately want rest/shop
        if (type === 'rest')    return 100;
        if (type === 'shop')    return 80;
        if (type === 'mystery') return 30;
        if (type === 'combat')  return 10;
        return 5;
      }
      if (hpPct < 0.5) {
        // Low HP: prefer rest/shop over combat
        if (type === 'rest')    return 80;
        if (type === 'shop')    return 60;
        if (type === 'mystery') return 40;
        if (type === 'combat')  return 30;
        return 20;
      }
      // Healthy: prefer combat/elite for rewards
      if (type === 'elite')     return 90;
      if (type === 'combat')    return 70;
      if (type === 'mystery')   return 50;
      if (type === 'shop')      return 40;
      if (type === 'rest')      return 20;
      return 30;
    };

    const scored = options.map(n => ({ node: n, score: nodeScore(n) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].node;
  }
}
