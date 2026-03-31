// === Brain Fog System (was Knowledge Aura, AR-261) ===
// Per-encounter gauge (0-10) driven by Charge accuracy.
// Low fog (≤2) = Flow State (+1 card draw). High fog (≥7) = Brain Fog (enemies +20% dmg).
// Fog starts at 0 each encounter.
// - Charge Correct: adjustAura(-1) — fog decreases
// - Charge Wrong:   adjustAura(+1) — fog increases
// - No charge played this turn (Quick Play only or no cards played): adjustAura(+1) at endPlayerTurn()

export type AuraState = 'brain_fog' | 'neutral' | 'flow_state';

export interface AuraSnapshot {
  /** Current fog level (0-10). */
  level: number;
  /** Current state derived from the fog level. */
  state: AuraState;
}

export const AURA_MIN = 0;
export const AURA_MAX = 10;
export const AURA_START = 0;  // Fog starts at 0 (clear)
export const BRAIN_FOG_THRESHOLD = 7;  // High fog = brain fog
export const FLOW_STATE_THRESHOLD = 2;  // Low fog = flow state

let _auraLevel: number = AURA_START;

/**
 * Resets the fog gauge to its starting value (AURA_START = 0).
 * Called at the beginning of each encounter.
 */
export function resetAura(): void {
  _auraLevel = AURA_START;  // Resets to 0 (clear fog)
}

/**
 * Adjusts the fog level by the given delta, clamping the result to [AURA_MIN, AURA_MAX].
 * Positive delta increases fog (wrong answers); negative delta clears fog (correct answers).
 *
 * @param delta - Amount to add (positive = more fog) or subtract (negative = less fog).
 */
export function adjustAura(delta: number): void {
  _auraLevel = Math.min(AURA_MAX, Math.max(AURA_MIN, _auraLevel + delta));
}

/**
 * Returns the current AuraState based on the fog level thresholds.
 * - 'brain_fog'  if level ≥ BRAIN_FOG_THRESHOLD (7)
 * - 'flow_state' if level ≤ FLOW_STATE_THRESHOLD (2)
 * - 'neutral'    otherwise (3-6)
 */
export function getAuraState(): AuraState {
  if (_auraLevel >= BRAIN_FOG_THRESHOLD) return 'brain_fog';  // High fog = brain fog
  if (_auraLevel <= FLOW_STATE_THRESHOLD) return 'flow_state';  // Low fog = flow state
  return 'neutral';
}

/**
 * Returns the raw numeric fog level (0-10).
 */
export function getAuraLevel(): number {
  return _auraLevel;
}

/**
 * Returns a snapshot of the current fog for UI consumption.
 */
export function getAuraSnapshot(): AuraSnapshot {
  return { level: _auraLevel, state: getAuraState() };
}
