// === Knowledge Aura System (AR-261) ===
// Per-encounter gauge (0-10) driven by Charge accuracy.
// Three states: Brain Fog (0-3), Neutral (4-6), Flow State (7-10).

export type AuraState = 'brain_fog' | 'neutral' | 'flow_state';

export interface AuraSnapshot {
  /** Current aura level (0-10). */
  level: number;
  /** Current aura state derived from the level. */
  state: AuraState;
}

export const AURA_MIN = 0;
export const AURA_MAX = 10;
export const AURA_START = 5;
export const BRAIN_FOG_THRESHOLD = 3;
export const FLOW_STATE_THRESHOLD = 7;

let _auraLevel: number = AURA_START;

/**
 * Resets the aura gauge to its starting value (AURA_START = 5).
 * Called at the beginning of each encounter.
 */
export function resetAura(): void {
  _auraLevel = AURA_START;
}

/**
 * Adjusts the aura level by the given delta, clamping the result to [AURA_MIN, AURA_MAX].
 * Positive delta rewards correct Charge answers; negative delta penalizes wrong ones.
 *
 * @param delta - Amount to add (positive) or subtract (negative) from the current level.
 */
export function adjustAura(delta: number): void {
  _auraLevel = Math.min(AURA_MAX, Math.max(AURA_MIN, _auraLevel + delta));
}

/**
 * Returns the current AuraState based on the aura level thresholds.
 * - 'brain_fog'  if level ≤ BRAIN_FOG_THRESHOLD (3)
 * - 'flow_state' if level ≥ FLOW_STATE_THRESHOLD (7)
 * - 'neutral'    otherwise (4-6)
 */
export function getAuraState(): AuraState {
  if (_auraLevel <= BRAIN_FOG_THRESHOLD) return 'brain_fog';
  if (_auraLevel >= FLOW_STATE_THRESHOLD) return 'flow_state';
  return 'neutral';
}

/**
 * Returns the raw numeric aura level (0-10).
 */
export function getAuraLevel(): number {
  return _auraLevel;
}

/**
 * Returns a snapshot of the current aura for UI consumption.
 */
export function getAuraSnapshot(): AuraSnapshot {
  return { level: _auraLevel, state: getAuraState() };
}
