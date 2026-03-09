// === Status Effect System ===
// Pure logic for status effects in the card roguelite encounter engine.
// NO Phaser, Svelte, or DOM imports.

/** The types of status effects that can be applied to players or enemies. */
export type StatusEffectType = 'poison' | 'regen' | 'strength' | 'weakness' | 'vulnerable' | 'immunity';

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

  return { effects, poisonDamage, regenHeal };
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
