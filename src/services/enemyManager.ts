// === Enemy Manager ===
// Creates and manages enemy instances during encounters.
// NO Phaser, Svelte, or DOM imports.

import type { EnemyTemplate, EnemyInstance, EnemyIntent, EnemyTurnStartContext } from '../data/enemies';
import type { StatusEffect } from '../data/statusEffects';
import { applyStatusEffect, tickStatusEffects, getStrengthModifier, PERMANENT_DURATION_SENTINEL } from '../data/statusEffects';
import { ENEMY_TURN_DAMAGE_CAP, FLOOR_DAMAGE_SCALING_PER_FLOOR, FLOOR_DAMAGE_SCALE_MID, GLOBAL_ENEMY_DAMAGE_MULTIPLIER, getBalanceValue, ENEMY_BASE_HP_MULTIPLIER, ENEMY_HP_SCALING_PER_FLOOR, ENEMY_HP_SCALING_PER_FLOOR_BY_SEGMENT } from '../data/balance';
import { resolvePoisonTickBonus } from './relicEffectResolver';
import { getAuraState } from './knowledgeAuraSystem';
import { getRunRng, isRunRngActive } from './seededRng';
import type { SharedEnemySnapshot, EnemyTurnDelta } from '../data/multiplayerTypes';

/**
 * Computes HP scaling factor for a given floor using segment-based scaling.
 *
 * Scaling rate varies by segment so early floors are gentle for beginners
 * while late floors ramp steeply for experienced players.
 * - Segment 1 (1-6): 0.08/floor  → Floor 1: 1.00×, Floor 6: 1.40×
 * - Segment 2 (7-12): 0.14/floor → Floor 7: ~1.48×, Floor 12: ~2.18×
 * - Segment 3 (13-18): 0.20/floor → Floor 13: ~2.38×, Floor 18: ~3.38×
 * - Segment 4 (19-24): 0.25/floor → Floor 19: ~3.63×, Floor 24: ~4.88×
 *
 * @param floor - The current floor number (1-indexed).
 * @returns The HP scaling multiplier.
 */
export function getFloorScaling(floor: number): number {
  // Determine segment (1-4)
  const segment = floor <= 6 ? 1 : floor <= 12 ? 2 : floor <= 18 ? 3 : 4;
  const scalingRate = ENEMY_HP_SCALING_PER_FLOOR_BY_SEGMENT[segment] ?? 0.18;
  return 1.0 + (floor - 1) * scalingRate;
}

/**
 * Computes damage scaling factor for a given floor.
 *
 * Floors 1-6 = 100% base, floors 7+ = 100% + 4% per floor above 6.
 */
export function getFloorDamageScaling(floor: number): number {
  if (floor <= 6) return FLOOR_DAMAGE_SCALE_MID;
  return FLOOR_DAMAGE_SCALE_MID + (floor - 6) * getBalanceValue('floorDamageScalingPerFloor', FLOOR_DAMAGE_SCALING_PER_FLOOR);
}

/**
 * Selects a random intent from a weighted pool.
 *
 * Uses weighted random selection where each intent's weight determines
 * its probability of being chosen.
 *
 * @param pool - The intent pool to select from.
 * @returns The selected EnemyIntent.
 */
function weightedRandomIntent(pool: EnemyIntent[]): EnemyIntent {
  const totalWeight = pool.reduce((sum, intent) => sum + intent.weight, 0);
  const intentRng = isRunRngActive() ? getRunRng('enemyIntents') : null;
  let roll = (intentRng ? intentRng.next() : Math.random()) * totalWeight;

  for (const intent of pool) {
    roll -= intent.weight;
    if (roll <= 0) {
      return intent;
    }
  }

  // Fallback (should not reach here)
  return pool[pool.length - 1];
}

/**
 * Computes HP scaling multiplier for co-op/multiplayer encounters.
 * Uses a sublinear curve inspired by Monster Hunter:
 * - 1 player: 1.0x (solo baseline)
 * - 2 players: 1.6x (not 2x — accounts for accuracy-dependent damage + co-op synergy)
 * - 3 players: 2.2x
 * - 4 players: 2.3x (capped)
 *
 * Recall Rogue scales lower than StS2 because damage depends on quiz accuracy:
 * two 70% accuracy players deal ~1.4x effective DPS, not 2x. The 0.6 coefficient
 * (vs naive 0.5) accounts for co-op synergy effects pushing combined DPS above
 * raw accuracy alone.
 *
 * @param playerCount - Number of players in the encounter (1 = solo baseline).
 * @returns The HP scaling multiplier (1.0 minimum).
 */
export function getCoopHpMultiplier(playerCount: number): number {
  if (playerCount <= 1) return 1.0;
  return Math.min(2.3, 1.0 + (playerCount - 1) * 0.6);
}

/**
 * Computes block scaling for co-op encounters.
 * +60% per additional player scales in lockstep with HP to prevent combined
 * DPS from trivializing enemy defense.
 *
 * @param playerCount - Number of players in the encounter (1 = solo baseline).
 * @returns The block scaling multiplier (1.0 minimum).
 */
export function getCoopBlockMultiplier(playerCount: number): number {
  if (playerCount <= 1) return 1.0;
  return 1.0 + (playerCount - 1) * 0.6;
}

/**
 * Computes damage cap scaling for co-op encounters.
 * Scales in lockstep with HP (0.6 coefficient) so caps don't bottleneck enemy
 * damage output against multi-HP pools.
 * Solo caps: 7/10/15/22 → 2P: ~11/16/24/35.
 *
 * @param playerCount - Number of players in the encounter (1 = solo baseline).
 * @returns The damage cap scaling multiplier (1.0 minimum).
 */
export function getCoopDamageCapMultiplier(playerCount: number): number {
  if (playerCount <= 1) return 1.0;
  return 1.0 + (playerCount - 1) * 0.6;
}

/**
 * Creates a live enemy instance from a template, scaled to the given floor.
 *
 * HP = round(baseHP × ENEMY_BASE_HP_MULTIPLIER × getFloorScaling(floor) × hpMultiplier × coopHpScale × difficultyVariance).
 * The first intent is pre-rolled.
 *
 * @param template - The enemy template to instantiate.
 * @param floor - The current floor number for HP scaling.
 * @param options - Optional {hpMultiplier, difficultyVariance, playerCount}. All default to 1.
 * @returns A fully initialized EnemyInstance.
 */
export function createEnemy(
  template: EnemyTemplate,
  floor: number,
  options?: { hpMultiplier?: number; difficultyVariance?: number; playerCount?: number },
): EnemyInstance {
  const hpMultiplier = options?.hpMultiplier ?? 1;
  const difficultyVariance = options?.difficultyVariance ?? 1;
  const playerCount = options?.playerCount ?? 1;
  const coopHpScale = getCoopHpMultiplier(playerCount);
  const scaledHP = Math.max(1, Math.round(
    template.baseHP * ENEMY_BASE_HP_MULTIPLIER * getFloorScaling(floor)
    * hpMultiplier * coopHpScale * difficultyVariance
  ));
  const instance: EnemyInstance = {
    template,
    currentHP: scaledHP,
    maxHP: scaledHP,
    block: 0,
    nextIntent: weightedRandomIntent(template.intentPool),
    statusEffects: [],
    phase: 1,
    floor,
    isCharging: false,
    chargedDamage: 0,
    difficultyVariance,
    enrageBonusDamage: 0,
    playerChargedThisTurn: false,
    playerCount,
  };
  // AR-263: Initialize hardcover armor from template if defined (The Textbook)
  if (template.hardcoverArmor !== undefined) {
    instance._hardcover = template.hardcoverArmor;
  }
  return instance;
}

/**
 * Rolls a new intent for the enemy from its current phase's intent pool.
 *
 * If the enemy is in phase 2 and has a phase2IntentPool, uses that pool.
 * If the enemy is currently charging, returns a synthetic attack intent that fires the charged attack.
 *
 * Block cannot follow block, buff, or debuff — prevents defensive stalling.
 * When the just-executed intent was 'defend', 'buff', or 'debuff', the defend
 * intent is filtered out of the candidate pool before selection. If the pool
 * contains ONLY defend intents (degenerate case), the filter is skipped and a
 * warning is logged so the encounter never deadlocks.
 *
 * NOTE: createEnemy() calls weightedRandomIntent() directly for the FIRST intent
 * because there is no prior intent history — this restriction only applies to
 * rollNextIntent() (turns 2+).
 *
 * @param enemy - The enemy instance (mutated in place).
 * @returns The newly rolled intent.
 */
export function rollNextIntent(enemy: EnemyInstance): EnemyIntent {
  // If charging, next turn automatically fires the charged attack
  if (enemy.isCharging) {
    const chargedIntent: EnemyIntent = {
      type: 'attack',
      value: enemy.chargedDamage,
      weight: 1,
      telegraph: 'Unleashing charged attack!',
      bypassDamageCap: true,
    };
    enemy.nextIntent = chargedIntent;
    enemy.isCharging = false;
    enemy.chargedDamage = 0;
    return chargedIntent;
  }

  const pool = (enemy.phase === 2 && enemy.template.phase2IntentPool)
    ? enemy.template.phase2IntentPool
    : enemy.template.intentPool;

  // Anti-stall rule: block cannot follow block, buff, or debuff.
  // Read the intent that was JUST EXECUTED (nextIntent hasn't been overwritten yet).
  const prevType = enemy.nextIntent.type;
  let activePool: EnemyIntent[] = pool;
  if (prevType === 'defend' || prevType === 'buff' || prevType === 'debuff') {
    const filtered = pool.filter(intent => intent.type !== 'defend');
    if (filtered.length > 0) {
      activePool = filtered;
    } else {
      // Edge case: pool has ONLY defend intents — fall back to full pool to avoid deadlock.
      console.warn(
        `[enemyManager] rollNextIntent: pool for enemy "${enemy.template.id}" contains only` +
        ` defend intents after filtering (prevType="${prevType}"). Falling back to full pool.`,
      );
    }
  }

  enemy.nextIntent = weightedRandomIntent(activePool);
  return enemy.nextIntent;
}

/**
 * Applies damage to an enemy, checking for phase transition and defeat.
 *
 * If the enemy has a phaseTransitionAt threshold and HP drops below it,
 * the enemy transitions to phase 2 and a new intent is rolled.
 *
 * @param enemy - The enemy instance (mutated in place).
 * @param damage - The amount of damage to deal.
 * @returns Object indicating whether the enemy was defeated and remaining HP.
 */
export function applyDamageToEnemy(
  enemy: EnemyInstance,
  damage: number
): { defeated: boolean; remainingHP: number } {
  if (enemy.block > 0) {
    const blockedDamage = Math.min(enemy.block, damage);
    enemy.block -= blockedDamage;
    damage -= blockedDamage;
  }
  enemy.currentHP = Math.max(0, enemy.currentHP - damage);

  // Check phase transition
  if (
    enemy.phase === 1 &&
    enemy.template.phaseTransitionAt != null &&
    enemy.template.phase2IntentPool &&
    enemy.currentHP > 0 &&
    enemy.currentHP / enemy.maxHP <= enemy.template.phaseTransitionAt
  ) {
    enemy.phase = 2;
    rollNextIntent(enemy);
    // AR-263: Fire onPhaseTransition callback for instance-level overrides (e.g. The Curriculum)
    if (enemy.template.onPhaseTransition) {
      enemy.template.onPhaseTransition(enemy);
    }
  }

  return {
    defeated: enemy.currentHP <= 0,
    remainingHP: enemy.currentHP,
  };
}

/**
 * Maps a floor number to its difficulty segment.
 *
 * @param floor - The current floor number.
 * @returns The segment (1-4) or 'endless' for floors 25+.
 */
function getSegmentForFloor(floor: number): 1 | 2 | 3 | 4 | 'endless' {
  if (floor <= 6) return 1;
  if (floor <= 12) return 2;
  if (floor <= 18) return 3;
  if (floor <= 24) return 4;
  return 'endless';
}

/**
 * Dispatches the onEnemyTurnStart callback for the given enemy, if defined.
 * Called at the start of each enemy turn (after player ends their turn).
 * Used for enrage logic (Timer Wyrm), mastery erosion (Brain Fog), and other per-turn enemy effects.
 *
 * @param enemy - The enemy instance (mutated in place by callback).
 * @param turnNumber - The current turn number (1-indexed).
 * @param playerChargedCorrectLastTurn - Whether the player made at least 1 correct Charge last turn.
 * @param playerHand - The actual card objects in the player's current hand (mutations affect real hand).
 */
export function dispatchEnemyTurnStart(
  enemy: EnemyInstance,
  turnNumber: number,
  playerChargedCorrectLastTurn: boolean,
  playerHand: Array<{ id: string; masteryLevel?: number }>,
): void {
  if (enemy.template.onEnemyTurnStart) {
    const ctx: EnemyTurnStartContext = { enemy, turnNumber, playerChargedCorrectLastTurn, playerHand };
    enemy.template.onEnemyTurnStart(ctx);
  }
}

/**
 * Executes the enemy's current intent, applying strength modifier and enrage bonus.
 *
 * Returns the results of the intent execution without modifying player state
 * (the turn manager is responsible for applying effects to the player).
 *
 * @param enemy - The enemy instance.
 * @returns The intent execution results.
 */
export function executeEnemyIntent(enemy: EnemyInstance): {
  damage: number;
  playerEffects: StatusEffect[];
  enemyHealed: number;
  stunned: boolean;
  /** Phase 9: Amount of player block stripped by a strip_block debuff intent. 0 = none. */
  blockStripped: number;
} {
  // AR-263: Pop Quiz stun — if stunned, skip action entirely
  if (enemy._stunNextTurn) {
    enemy._stunNextTurn = false;
    return { damage: 0, playerEffects: [], enemyHealed: 0, stunned: true, blockStripped: 0 };
  }

  const intent = enemy.nextIntent;
  const strengthMod = getStrengthModifier(enemy.statusEffects);

  let damage = 0;
  let enemyHealed = 0;
  let blockStripped = 0;
  const playerEffects: StatusEffect[] = [];

  switch (intent.type) {
    case 'attack': {
      const baseValue = intent.value + (enemy.enrageBonusDamage ?? 0);
      damage = Math.round(baseValue * strengthMod * getFloorDamageScaling(enemy.floor) * GLOBAL_ENEMY_DAMAGE_MULTIPLIER);
      // Phase 8: Tutor _nextAttackDoubled — double damage on wrong Charge, then clear flag
      if (enemy._nextAttackDoubled) {
        damage *= 2;
        enemy._nextAttackDoubled = false;
      }
      break;
    }
    case 'multi_attack': {
      const hits = intent.hitCount ?? 1;
      const baseValue = intent.value + (enemy.enrageBonusDamage ?? 0);
      damage = Math.round(baseValue * strengthMod * getFloorDamageScaling(enemy.floor) * GLOBAL_ENEMY_DAMAGE_MULTIPLIER) * hits;
      break;
    }
    case 'defend': {
      enemy.block += intent.value;
      break;
    }
    case 'buff': {
      // Apply buff to enemy (e.g., strength).
      // 6.3: Enemy buffs persist the entire encounter — use PERMANENT_DURATION_SENTINEL so
      // tickStatusEffects never expires them mid-fight. Player debuffs still use
      // their normal duration (handled in the 'debuff' case below).
      if (intent.statusEffect) {
        applyStatusEffect(enemy.statusEffects, {
          type: intent.statusEffect.type,
          value: intent.statusEffect.value,
          turnsRemaining: PERMANENT_DURATION_SENTINEL,
        });
      }
      break;
    }
    case 'debuff': {
      // Apply debuff to player
      if (intent.statusEffect) {
        if (intent.statusEffect.type === 'strip_block') {
          // Phase 9: strip_block is an instant block removal, not a persistent status.
          // We record the amount; turnManager applies it to playerState.shield.
          blockStripped = intent.statusEffect.value;
        } else {
          const effect = {
            type: intent.statusEffect.type,
            value: intent.statusEffect.value,
            turnsRemaining: intent.statusEffect.turns,
          };
          playerEffects.push(effect);
        }
      }
      break;
    }
    case 'heal': {
      enemyHealed = Math.min(intent.value, enemy.maxHP - enemy.currentHP);
      enemy.currentHP += enemyHealed;
      break;
    }
    case 'charge': {
      // No damage this turn — enemy is winding up
      enemy.isCharging = true;
      enemy.chargedDamage = intent.value;
      damage = 0;
      break;
    }
  }

  // Apply difficulty variance for common enemies (0.8-1.2x)
  if (damage > 0 && enemy.difficultyVariance !== 1) {
    damage = Math.round(damage * enemy.difficultyVariance);
  }

  // AR-261: Brain Fog — player's poor answer accuracy makes enemy hits 20% harder
  if (damage > 0 && getAuraState() === 'brain_fog') {
    damage = Math.round(damage * 1.2);
  }

  // Apply per-turn damage cap by segment (AR-32)
  // Charged attacks (marked with bypassDamageCap) bypass the cap
  if (damage > 0 && !intent.bypassDamageCap) {
    const seg = getSegmentForFloor(enemy.floor);
    const capLookup = getBalanceValue('enemyTurnDamageCap', ENEMY_TURN_DAMAGE_CAP) as Record<1 | 2 | 3 | 4 | 'endless', number | null>;
    const cap = capLookup[seg];
    if (cap != null) {
      damage = Math.min(damage, cap);
    }
  }

  return { damage, playerEffects, enemyHealed, stunned: false, blockStripped };
}

/**
 * Ticks status effects on an enemy (poison damage, regen heal, expiry).
 *
 * @param enemy    - The enemy instance (mutated in place).
 * @param relicIds - Set of relic IDs the player holds (for plague_flask bonus).
 * @returns The tick results (poison damage dealt, regen applied).
 */
export function tickEnemyStatusEffects(enemy: EnemyInstance, relicIds?: Set<string>): {
  poisonDamage: number;
  regenHeal: number;
} {
  const result = tickStatusEffects(enemy.statusEffects);

  // Apply poison damage to enemy
  // plague_flask — each active poison stack deals +2 bonus damage per tick
  if (result.poisonDamage > 0) {
    const poisonStackCount = enemy.statusEffects.filter(s => s.type === 'poison').length;
    const plagueBonus = resolvePoisonTickBonus(relicIds ?? new Set()) * poisonStackCount;
    const totalPoisonDamage = result.poisonDamage + plagueBonus;
    enemy.currentHP = Math.max(0, enemy.currentHP - totalPoisonDamage);
    result.poisonDamage = totalPoisonDamage;
  }

  // Apply regen heal to enemy
  if (result.regenHeal > 0) {
    enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + result.regenHeal);
  }

  return {
    poisonDamage: result.poisonDamage,
    regenHeal: result.regenHeal,
  };
}


// ── Coop Shared-Enemy Helpers ─────────────────────────────────────────────────
// These helpers support the optimistic-local + end-of-turn reconciliation model
// used in coop multiplayer. See docs/architecture/multiplayer.md for the full flow.

/**
 * Extract a serializable snapshot from a live EnemyInstance.
 * Captures only the mutable combat fields — template, floor, difficultyVariance
 * are established at creation and not included.
 *
 * @param enemy - The live enemy instance to snapshot.
 * @returns A SharedEnemySnapshot ready for broadcast.
 */
export function snapshotEnemy(enemy: EnemyInstance): SharedEnemySnapshot {
  return {
    currentHP: enemy.currentHP,
    maxHP: enemy.maxHP,
    block: enemy.block,
    phase: enemy.phase,
    nextIntent: { ...enemy.nextIntent },
    statusEffects: enemy.statusEffects.map(s => ({ ...s })),
  };
}

/**
 * Overwrite a live EnemyInstance's mutable fields from a host-authoritative snapshot.
 * Does NOT touch template, floor, difficultyVariance, enrageBonusDamage, or isCharging/chargedDamage
 * since those are established at creation or managed by the local combat system.
 *
 * @param enemy    - The live enemy instance to hydrate (mutated in place).
 * @param snapshot - The authoritative snapshot from the host.
 */
export function hydrateEnemyFromSnapshot(enemy: EnemyInstance, snapshot: SharedEnemySnapshot): void {
  enemy.currentHP = snapshot.currentHP;
  enemy.maxHP = snapshot.maxHP;
  enemy.block = snapshot.block;
  enemy.phase = snapshot.phase;
  enemy.nextIntent = { ...snapshot.nextIntent };
  enemy.statusEffects = snapshot.statusEffects.map(s => ({ ...s }));
}

/**
 * Pure function: merge an array of per-player turn deltas onto a pre-turn snapshot.
 * Used by the host to produce the authoritative end-of-turn enemy state.
 *
 * Merge order: deltas are sorted by playerId before application so the result
 * is deterministic regardless of message arrival order. Caller may pre-sort;
 * this function sorts defensively.
 *
 * Logic per delta:
 *   1. Apply blockDealt (reduce remaining block, remainder carries to HP).
 *   2. Apply damageDealt to HP (post-block).
 *   3. Clamp HP at 0.
 *   4. Check phase transition at the phaseTransitionAt threshold.
 *   5. Concat statusEffectsAdded (simple concat; dedup is best-effort by type).
 *
 * @param snapshot        - The enemy state at the START of the turn (not mutated).
 * @param deltas          - Per-player damage reports for this turn.
 * @param phaseTransitionAt - Optional HP-fraction threshold for phase 2 (0-1).
 * @param maxHP           - Used for phase transition percentage check.
 * @returns The new authoritative SharedEnemySnapshot after all deltas applied.
 */
export function applyEnemyDeltaToState(
  snapshot: SharedEnemySnapshot,
  deltas: EnemyTurnDelta[],
  phaseTransitionAt?: number,
): SharedEnemySnapshot {
  // Defensive sort by playerId for deterministic merge order
  const sorted = [...deltas].sort((a, b) => a.playerId.localeCompare(b.playerId));

  let currentHP = snapshot.currentHP;
  let block = snapshot.block;
  let phase = snapshot.phase;
  const statusEffects = snapshot.statusEffects.map(s => ({ ...s }));

  for (const delta of sorted) {
    // Strip block first, then apply remaining damage to HP
    let remainingDamage = delta.damageDealt;
    if (block > 0 && delta.blockDealt > 0) {
      const blockStripped = Math.min(block, delta.blockDealt);
      block -= blockStripped;
    }
    if (remainingDamage > 0) {
      // Block was already accounted for in the delta computation on the client
      // (damageDealt is the post-block damage as seen by the local enemy state).
      // Re-apply block stripping here only if block was still up when we process
      // this delta (another player's delta may have stripped it). This approach
      // is a simplification — true mid-turn interactions are accepted as minor
      // optimistic drift per the design.
      currentHP = Math.max(0, currentHP - remainingDamage);
    }

    // Merge status effects — concat, then dedupe by type (sum magnitudes)
    for (const effect of delta.statusEffectsAdded) {
      const existing = statusEffects.find(s => s.type === effect.type);
      if (existing) {
        existing.value += effect.value;
        // Extend duration to the max of the two
        if (effect.turnsRemaining != null && existing.turnsRemaining != null) {
          existing.turnsRemaining = Math.max(existing.turnsRemaining, effect.turnsRemaining);
        }
      } else {
        statusEffects.push({ ...effect });
      }
    }
  }

  // Phase transition check (phase 1 → 2 only)
  if (
    phase === 1 &&
    phaseTransitionAt != null &&
    currentHP > 0 &&
    currentHP / snapshot.maxHP <= phaseTransitionAt
  ) {
    phase = 2;
  }

  return {
    currentHP,
    maxHP: snapshot.maxHP,
    block,
    phase,
    // nextIntent is set by the host after rolling via rollNextIntent — preserve current for now
    nextIntent: snapshot.nextIntent,
    statusEffects,
  };
}
