// === Status Effect System ===
// Pure logic for status effects in the card roguelite encounter engine.
// NO Phaser, Svelte, or DOM imports.

/** The types of status effects that can be applied to players or enemies. */
export type StatusEffectType =
  | 'poison'
  | 'regen'
  | 'strength'
  | 'weakness'
  | 'vulnerable'
  | 'immunity'
  | 'burn'
  | 'bleed'
  /** AR-207: Curse of Doubt — percentage amplifier on Charge damage. value = percent bonus (e.g. 30 = +30%). */
  | 'charge_damage_amp_percent'
  /** AR-207: Mark of Ignorance — flat amplifier on Charge damage. value = flat bonus (e.g. 3 = +3 dmg). */
  | 'charge_damage_amp_flat';

/** A single active status effect instance. */
export interface StatusEffect {
  /** The type of this status effect. */
  type: StatusEffectType;
  /** The magnitude of the effect (stacks additively with same type). */
  value: number;
  /** How many turns this effect persists. */
  turnsRemaining: number;
}

/** Result of ticking status effects at end of turn. */
export interface TickResult {
  /** Updated status effects array (expired effects removed). */
  effects: StatusEffect[];
  /** Total poison damage dealt this tick. */
  poisonDamage: number;
  /** Total regen healing applied this tick. */
  regenHeal: number;
  /** Burn bonus dealt this tick (always 0 — Burn fires on-hit, not per tick). */
  burnBonusDealt: number;
  /** Bleed bonus dealt this tick (always 0 — Bleed fires on card-play damage, not per tick). */
  bleedBonusDealt: number;
}

/**
 * Applies a new status effect to an existing effects array.
 *
 * If an effect of the same type already exists, values are added
 * and duration is set to the maximum of the two.
 *
 * @param effects - The current status effects (mutated in place).
 * @param newEffect - The status effect to apply.
 * @returns The mutated effects array.
 */
export function applyStatusEffect(effects: StatusEffect[], newEffect: StatusEffect): StatusEffect[] {
  const existing = effects.find(e => e.type === newEffect.type);
  if (existing) {
    existing.value += newEffect.value;
    existing.turnsRemaining = Math.max(existing.turnsRemaining, newEffect.turnsRemaining);
  } else {
    effects.push({ ...newEffect });
  }
  return effects;
}

/**
 * Ticks all status effects, decrementing turns and applying per-turn effects.
 *
 * Poison deals its value as damage. Regen heals its value.
 * Effects with turnsRemaining <= 0 after decrement are removed.
 *
 * @param effects - The current status effects (mutated in place).
 * @returns Tick result with updated effects and damage/heal amounts.
 */
export function tickStatusEffects(effects: StatusEffect[]): TickResult {
  let poisonDamage = 0;
  let regenHeal = 0;
  const immunity = effects.find((effect) => effect.type === 'immunity' && effect.turnsRemaining > 0);

  for (const effect of effects) {
    if (effect.type === 'poison') {
      if (immunity) {
        immunity.turnsRemaining = 0;
      } else {
        poisonDamage += effect.value;
      }
    }
    if (effect.type === 'regen') {
      regenHeal += effect.value;
    }
    effect.turnsRemaining -= 1;
  }

  // Remove expired effects
  const remaining = effects.filter(e => e.turnsRemaining > 0);
  // Mutate in place
  effects.length = 0;
  effects.push(...remaining);

  return { effects, poisonDamage, regenHeal, burnBonusDealt: 0, bleedBonusDealt: 0 };
}

/**
 * Triggers Burn on a hit. Returns the bonus damage dealt and the updated Burn stack count.
 * Burn deals damage equal to current stacks, then halves (round down). Expires at 0.
 * Does NOT trigger on Thorns/reflect damage — call only from card-play attack paths.
 *
 * @param effects - The target's status effects array (mutated in place).
 * @returns { bonusDamage, stacksAfter }
 */
export function triggerBurn(
  effects: StatusEffect[],
  skipHalving = false,
): { bonusDamage: number; stacksAfter: number } {
  const burn = effects.find(e => e.type === 'burn' && e.turnsRemaining > 0);
  if (!burn) return { bonusDamage: 0, stacksAfter: 0 };
  const bonusDamage = burn.value;
  // Phase 3 twin_burn_chain tag: skipHalving=true prevents Burn stacks from halving per hit.
  if (!skipHalving) {
    burn.value = Math.floor(burn.value / 2);
    if (burn.value <= 0) {
      const idx = effects.indexOf(burn);
      if (idx !== -1) effects.splice(idx, 1);
      return { bonusDamage, stacksAfter: 0 };
    }
  }
  return { bonusDamage, stacksAfter: burn.value };
}

/**
 * Returns the Bleed bonus damage for the given damage source.
 * Bleed adds +BLEED_BONUS_PER_STACK per stack to incoming card-play damage.
 * Does NOT mutate stacks — decay is handled separately at end of enemy turn.
 * Import BLEED_BONUS_PER_STACK from balance.ts at the call site.
 *
 * @param effects - The target's status effects array.
 * @param bleedBonusPerStack - Flat bonus per stack (from BLEED_BONUS_PER_STACK constant).
 * @returns The flat bonus damage from Bleed (0 if no Bleed stacks).
 */
export function getBleedBonus(effects: StatusEffect[], bleedBonusPerStack: number): number {
  const bleed = effects.find(e => e.type === 'bleed' && e.turnsRemaining > 0);
  return bleed ? bleed.value * bleedBonusPerStack : 0;
}

/**
 * Computes the strength/weakness modifier from current status effects.
 *
 * Strength gives +25% per value, weakness gives -25% per value.
 * The result is a multiplier (minimum 0.25 to prevent full nullification).
 *
 * @param effects - The current status effects.
 * @returns A damage multiplier (1.0 = no modification).
 */
export function getStrengthModifier(effects: StatusEffect[]): number {
  let modifier = 1.0;

  const strength = effects.find(e => e.type === 'strength');
  if (strength) {
    modifier += strength.value * 0.25;
  }

  const weakness = effects.find(e => e.type === 'weakness');
  if (weakness) {
    modifier -= weakness.value * 0.25;
  }

  return Math.max(0.25, modifier);
}

/**
 * Checks whether the target has the vulnerable status effect.
 *
 * @param effects - The current status effects to check.
 * @returns True if the target is vulnerable.
 */
export function isVulnerable(effects: StatusEffect[]): boolean {
  return effects.some(e => e.type === 'vulnerable' && e.turnsRemaining > 0);
}
