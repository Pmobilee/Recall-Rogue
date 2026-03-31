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
import type { TurnState } from '../../../src/services/turnManager.js';
import type { MapNode } from '../../../src/services/mapGenerator.js';
import {
  CHARGE_CORRECT_MULTIPLIER,
  FIZZLE_EFFECT_RATIO,
  CHAIN_MULTIPLIERS,
  SURGE_INTERVAL,
  SURGE_FIRST_TURN,
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
  /** 0–1: surge turn exploitation (free charge surcharge) */
  surgeAwareness: number;
  /** 0–1: preference for charging high-perLevelDelta cards to gain mastery */
  masteryHunting: number;
  /** 0–1: card reward selection quality */
  rewardSkill: number;
  /** 0–1: shop purchase intelligence */
  shopSkill: number;
  /** 0–1: rest site decision quality (heal vs study) */
  restSkill: number;
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

/** Return true if this global turn number is a Surge turn (free charge surcharge). */
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
 */
function cardQuickPlayEffective(card: Card): number {
  const mechDef = card; // Card has quickPlayValue? Use baseEffectValue as proxy
  // Cards in simulation use baseEffectValue as the quick-play base
  const masteryBonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  return (card.baseEffectValue ?? 0) + masteryBonus;
}

/**
 * Estimate charge EV per card.
 * chargeEV = acc × (qpv + masteryBonus) × 1.5 + (1-acc) × (qpv + masteryBonus) × 0.25
 *          vs quickEV = qpv + masteryBonus
 * Charge is better when chargeEV > quickEV.
 * Simplifies to: acc × 1.5 + (1-acc) × 0.25 > 1.0  → acc > 0.5
 * But this function returns the raw EVs so the caller can compare.
 */
function computeChargeEV(card: Card, accuracy: number): { chargeEV: number; quickEV: number } {
  const qpv = cardQuickPlayEffective(card);
  const chargeEV = accuracy * qpv * CHARGE_CORRECT_MULTIPLIER
    + (1 - accuracy) * qpv * FIZZLE_EFFECT_RATIO;
  const quickEV = qpv;
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
    const chargeSurcharge = (ascMods.freeCharging || isSurge) ? 0 : 1;
    const apAvailable = turnState.apCurrent;
    const playerHpPct = turnState.playerState.hp / (turnState.playerState.maxHP || 100);
    const enemyHp = turnState.enemy.currentHP;
    const currentChainType = turnState.chainType;

    // Step 1: Order cards using cardSelection + chainSkill + blockSkill axes
    let ordered = this._orderHand(hand, {
      playerHpPct,
      enemyHp,
      currentChainType,
      apAvailable,
      chargeSurcharge,
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

      const chargeApCost = apCost + chargeSurcharge;
      const canCharge = apRemaining >= chargeApCost;
      const mode = this._decideMode(card, canCharge, isSurge, currentChainType, plan.length);

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
    },
  ): Card[] {
    const { skills } = this;
    const { playerHpPct, enemyHp, currentChainType, apAvailable, chargeSurcharge } = ctx;

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
        } else if (skills.blockSkill >= 0.7) {
          // Estimate if we need to absorb enemy damage
          const enemyAttack = (ctx as { enemyAttack?: number }).enemyAttack ?? 0;
          const shieldValue = cardQuickPlayEffective(card);
          if (shieldValue > 0 && enemyAttack > 0) {
            score += 100 * Math.min(shieldValue / enemyAttack, 1.0) * skills.blockSkill;
          }
        } else if (skills.blockSkill < 0.3) {
          // Low blockSkill: deprioritize shields
          score -= 50;
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
  ): 'charge' | 'quick' {
    if (!canCharge) return 'quick';

    const { skills } = this;
    const acc = skills.accuracy;

    // surgeAwareness: during surge turns, ALWAYS charge (free surcharge = always +EV)
    if (isSurge && skills.surgeAwareness >= 1.0) return 'charge';
    if (isSurge && skills.surgeAwareness >= 0.5) {
      // 50% boost to charge rate during surge
      if (Math.random() < Math.min(1.0, acc * 1.5)) return 'charge';
    }

    if (skills.chargeSkill < 0.3) {
      // 0.0–0.3: randomly charge at a low rate
      const rate = acc * 0.3 * skills.chargeSkill / 0.3;
      return Math.random() < rate ? 'charge' : 'quick';
    }

    if (skills.chargeSkill < 0.5) {
      // 0.3–0.5: charge when accuracy >= 0.56 (EV break-even)
      return acc >= 0.56 ? 'charge' : 'quick';
    }

    if (skills.chargeSkill < 0.7) {
      // 0.5–0.7: charge at EV break-even, also factor in card type
      if (acc < 0.56) return 'quick';
      if (isBuffOrUtility(card.cardType)) return 'quick'; // low multiplier payoff
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
        // Prefer options that fill gaps (under-represented types score higher)
        const score = 1.0 - currentPct;
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

    for (const opt of options) {
      let score = 0;

      // Prefer attack cards with high mastery scaling
      if (opt.type === 'attack') {
        const delta = MASTERY_UPGRADE_DEFS[opt.id]?.perLevelDelta ?? 0;
        score += delta * 20;
      }

      // Gap filling
      const currentPct = (typeCounts[opt.type] ?? 0) / deckSize;
      score += (1.0 - currentPct) * 15;

      // Prefer low AP cost for AP efficiency
      score -= opt.apCost * 5;

      if (score > bestScore) {
        bestScore = score;
        bestOption = opt;
      }
    }

    return bestOption;
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
   * @returns         'heal' or 'study'
   */
  planRest(runState: { hp: number; maxHp: number; deckSize: number }): 'heal' | 'study' {
    const { skills } = this;
    const hpPct = runState.hp / (runState.maxHp || 1);

    if (skills.restSkill < 0.3) {
      return 'heal';
    }

    if (skills.restSkill < 0.7) {
      // Heal if HP < 50%, else study
      return hpPct < 0.5 ? 'heal' : 'study';
    }

    // 0.7–1.0: Study when HP > 70% (mastery farming), heal only when HP < 40%
    if (hpPct > 0.7) return 'study';
    if (hpPct < 0.4) return 'heal';
    return skills.restSkill >= 0.85 ? 'study' : 'heal';
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
