/**
 * Co-op exclusive card effects for multiplayer combat.
 *
 * Manages state and computes per-turn modifiers for the 6 co-op mechanics.
 * These effects only activate in 'coop' and 'duel' multiplayer modes and are
 * entirely additive on top of the solo damage pipeline (GDD §15.5).
 *
 * Effects:
 * 1. Synapse Link     — both charge same chain type = +0.5× chain multiplier
 * 2. Guardian Shield  — shield cards can protect partner instead of self
 * 3. Knowledge Share  — partner's correct answer = +0.25× buff for 1 turn
 * 4. Team Chain Bonus — both players have active chains = +0.5× bonus
 * 5. Fog Contagion    — wrong answers add fog for the whole team
 * 6. Shared Surge     — surge counter advances based on combined turn count
 *
 * Multiplier stacking:
 *   All three bonuses (Synapse Link, Knowledge Share, Team Chain) are ADDITIVE
 *   to avoid swing at max stack (max combined = +1.25×). Multiplicative stacking
 *   was considered but produced excessive variance and was rejected.
 *
 * Integration points:
 *   - Call `initCoopEffects()` when a coop/duel encounter starts.
 *   - Call `processTurnActions()` after both players submit their DuelTurnAction.
 *   - Call `tickEndOfTurn()` after all damage and effects resolve for the turn.
 *   - Call `queueGuardianShield()` from cardEffectResolver when a card tagged
 *     `guardian_shield` is played in charged mode.
 *   - Call `consumeGuardianShield()` to retrieve the pending block amount for
 *     the partner's playerCombatState.
 *   - Read `getCoopDamageMultiplier()` in the damage pipeline to apply co-op
 *     bonuses to the resolved damage value.
 *   - Read `isCoopSurgeTurn()` alongside `isSurgeTurn()` to grant free surge
 *     to the co-op surge window.
 *   - Read `getSharedFogIncrease()` in encounterBridge after turn resolution
 *     to apply fog contagion to both players.
 *
 * Source files:
 *   src/services/coopEffects.ts (this file)
 *   src/services/multiplayerGameService.ts — DuelTurnAction, hostResolveTurn
 *   src/services/turnManager.ts — isSurgeTurn, SURGE_INTERVAL, chain state
 *   src/data/balance.ts — SURGE_INTERVAL, SURGE_FIRST_TURN
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Active co-op effects state for the current encounter. Mutable internally; exposed as Readonly. */
export interface CoopEffectsState {
  /** Whether co-op effects are active (true only in coop/duel modes). */
  active: boolean;

  /** Synapse Link: chain type both players charged this turn (null if no match). */
  synapseLinkedChainType: number | null;
  /**
   * Additive multiplier bonus from Synapse Link.
   * 0.5 when linked, 0.0 otherwise (added to base 1.0 in getCoopDamageMultiplier).
   */
  synapseLinkBonus: number;

  /** Guardian Shield: block amount queued for partner this turn. Reset by consumeGuardianShield. */
  guardianShieldPending: number;

  /**
   * Knowledge Share: additive multiplier buff granted when partner answered correctly.
   * 0.25 while active, 0 otherwise.
   */
  knowledgeShareBuff: number;
  /** Turns remaining before knowledgeShareBuff decays to 0. */
  knowledgeShareTurnsRemaining: number;

  /** Team Chain Bonus: true if both players had active chains this turn. */
  teamChainActive: boolean;
  /**
   * Additive multiplier bonus from Team Chain.
   * 0.5 when both players have active chains, 0.0 otherwise.
   */
  teamChainBonus: number;

  /**
   * Fog Contagion: total fog increase from all players' wrong answers this turn.
   * Applied to both players via encounterBridge after turn resolution.
   * Reset by tickEndOfTurn.
   */
  sharedFogIncrease: number;

  /**
   * Shared Surge: combined turn counter used to trigger the co-op surge window.
   * Each simultaneous round increments this by 1, matching the solo pattern of
   * SURGE_INTERVAL=4 with SURGE_FIRST_TURN=2 (i.e. triggers on turns 2, 6, 10…).
   */
  combinedTurnCounter: number;
  /** True when combinedTurnCounter is on a shared surge turn. */
  isSurgeTurn: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Additive damage multiplier bonus when both players charge the same chain type.
 * Combined with base 1.0 this gives 1.5× total (i.e. +50%).
 */
export const SYNAPSE_LINK_MULTIPLIER = 0.5;

/**
 * Additive damage multiplier buff granted to local player for 1 turn
 * when partner answers a charge quiz correctly.
 */
export const KNOWLEDGE_SHARE_BUFF = 0.25;

/** Number of turns the Knowledge Share buff persists before decaying. */
export const KNOWLEDGE_SHARE_DURATION = 1;

/**
 * Additive damage multiplier bonus when both players have active knowledge chains.
 * Combined with base 1.0 this gives 1.5× total (i.e. +50%).
 */
export const TEAM_CHAIN_BONUS = 0.5;

/**
 * Combined-turn interval for co-op surge, mirroring the solo SURGE_INTERVAL.
 * Surge fires on turns where combinedTurnCounter % COOP_SURGE_INTERVAL === (COOP_SURGE_INTERVAL - 2),
 * producing the same 2, 6, 10, 14… pattern as the solo system.
 *
 * Must stay in sync with SURGE_INTERVAL from src/data/balance.ts (currently 4).
 */
export const COOP_SURGE_INTERVAL = 4;

/** Fog increase applied per wrong answer across all players in a single turn. */
export const FOG_PER_WRONG_ANSWER = 1;

// ── State ─────────────────────────────────────────────────────────────────────

let _state: CoopEffectsState = _createDefaultState();

function _createDefaultState(): CoopEffectsState {
  return {
    active: false,
    synapseLinkedChainType: null,
    synapseLinkBonus: 0,
    guardianShieldPending: 0,
    knowledgeShareBuff: 0,
    knowledgeShareTurnsRemaining: 0,
    teamChainActive: false,
    teamChainBonus: 0,
    sharedFogIncrease: 0,
    combinedTurnCounter: 0,
    isSurgeTurn: false,
  };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Initialize co-op effects for a new encounter.
 * Call at the start of any coop or duel encounter.
 * Resets all state and marks effects as active.
 */
export function initCoopEffects(): void {
  _state = _createDefaultState();
  _state.active = true;
}

/**
 * Destroy co-op effects and reset all state.
 * Call when the encounter ends or the player exits multiplayer.
 */
export function destroyCoopEffects(): void {
  _state = _createDefaultState();
  // active remains false (default)
}

/**
 * Return a read-only snapshot of the current co-op effects state.
 * Callers must not mutate the returned object.
 */
export function getCoopEffectsState(): Readonly<CoopEffectsState> {
  return _state;
}

// ── Turn Processing ───────────────────────────────────────────────────────────

/**
 * Process both players' turn actions to compute co-op effects for this turn.
 *
 * Called by multiplayerGameService (or encounterBridge in co-op mode) after
 * both players submit their DuelTurnAction and before damage is applied.
 * Returns a copy of the updated state.
 *
 * @param localAction  - Local player's aggregated turn result.
 * @param partnerAction - Partner's aggregated turn result.
 * @returns Snapshot of updated CoopEffectsState (independent copy, safe to store).
 */
export function processTurnActions(
  localAction: {
    /** Chain type index (0-5) the local player charged this turn, or undefined if not charged. */
    chargedChainType?: number;
    /** Whether the local player's charge quiz was answered correctly. */
    chargeCorrect?: boolean;
    /** Block gained by local player this turn (for Guardian Shield source). */
    blockGained: number;
    /** Current chain length for local player (0 = no active chain). */
    chainLength: number;
  },
  partnerAction: {
    /** Chain type index (0-5) the partner charged this turn, or undefined if not charged. */
    chargedChainType?: number;
    /** Whether the partner's charge quiz was answered correctly. */
    chargeCorrect?: boolean;
    /** Block gained by partner this turn. */
    blockGained: number;
    /** Current chain length for partner (0 = no active chain). */
    chainLength: number;
  },
): CoopEffectsState {
  if (!_state.active) return { ..._state };

  // ── 1. Synapse Link ───────────────────────────────────────────────────────
  // Both players must have charged (chargedChainType defined and ≥ 0) the same
  // chain type this turn. A chain type of -1 (sentinel for "no chain") never links.
  _state.synapseLinkedChainType = null;
  _state.synapseLinkBonus = 0;

  if (
    localAction.chargedChainType !== undefined &&
    partnerAction.chargedChainType !== undefined &&
    localAction.chargedChainType >= 0 &&
    localAction.chargedChainType === partnerAction.chargedChainType
  ) {
    _state.synapseLinkedChainType = localAction.chargedChainType;
    _state.synapseLinkBonus = SYNAPSE_LINK_MULTIPLIER;
  }

  // ── 2. Knowledge Share ────────────────────────────────────────────────────
  // Partner answered correctly → grant local player a +0.25× buff for 1 turn.
  // Refreshes if partner answers correctly again before the buff expires.
  if (partnerAction.chargeCorrect === true) {
    _state.knowledgeShareBuff = KNOWLEDGE_SHARE_BUFF;
    _state.knowledgeShareTurnsRemaining = KNOWLEDGE_SHARE_DURATION;
  }

  // ── 3. Team Chain Bonus ───────────────────────────────────────────────────
  // Both players must have an active chain (length > 0) this turn.
  _state.teamChainActive =
    localAction.chainLength > 0 && partnerAction.chainLength > 0;
  _state.teamChainBonus = _state.teamChainActive ? TEAM_CHAIN_BONUS : 0;

  // ── 4. Fog Contagion ──────────────────────────────────────────────────────
  // Each wrong answer from either player contributes fog applied to BOTH.
  // chargeCorrect === false means a charge was attempted and failed.
  // undefined means no charge was attempted — does not count as wrong.
  _state.sharedFogIncrease = 0;
  if (localAction.chargeCorrect === false) _state.sharedFogIncrease += FOG_PER_WRONG_ANSWER;
  if (partnerAction.chargeCorrect === false) _state.sharedFogIncrease += FOG_PER_WRONG_ANSWER;

  // ── 5. Shared Surge ───────────────────────────────────────────────────────
  // Each simultaneous round counts as 1 combined turn.
  // Surge fires on the same turn pattern as solo mode (2, 6, 10, 14...),
  // using combinedTurnCounter % COOP_SURGE_INTERVAL === COOP_SURGE_INTERVAL - 2.
  // Example: turn 1 → (1 % 4 === 2? no), turn 2 → (2 % 4 === 2? yes → surge).
  _state.combinedTurnCounter += 1;
  _state.isSurgeTurn =
    _state.combinedTurnCounter % COOP_SURGE_INTERVAL === COOP_SURGE_INTERVAL - 2;

  return { ..._state };
}

/**
 * Tick end-of-turn effects: decay time-limited buffs and reset per-turn accumulators.
 *
 * Call after all damage, block, and fog effects have been applied for the current turn.
 */
export function tickEndOfTurn(): void {
  if (!_state.active) return;

  // Decay Knowledge Share buff
  if (_state.knowledgeShareTurnsRemaining > 0) {
    _state.knowledgeShareTurnsRemaining--;
    if (_state.knowledgeShareTurnsRemaining <= 0) {
      _state.knowledgeShareBuff = 0;
    }
  }

  // Reset per-turn accumulators
  _state.sharedFogIncrease = 0;
  // Guardian shield resets each turn — any unconsumed pending shield is discarded.
  // The partner must apply it before tickEndOfTurn or it is lost.
  _state.guardianShieldPending = 0;
}

// ── Guardian Shield ───────────────────────────────────────────────────────────

/**
 * Queue block to be transferred to the partner instead of applied to self.
 *
 * Called by cardEffectResolver when a card tagged `guardian_shield` is played
 * in charged mode. The queued amount is retrieved by the partner via
 * consumeGuardianShield() and applied to their playerCombatState.
 *
 * Stacks additively if multiple guardian cards are played in the same turn.
 *
 * @param blockAmount - Block amount to redirect to partner.
 */
export function queueGuardianShield(blockAmount: number): void {
  if (!_state.active) return;
  _state.guardianShieldPending += blockAmount;
}

/**
 * Consume the pending guardian shield and return the block amount.
 *
 * Called by the partner's encounterBridge or playerCombatState integration
 * to retrieve and apply the transferred block. Resets pending to 0.
 *
 * @returns Block amount to apply to the partner's shield, or 0 if none pending.
 */
export function consumeGuardianShield(): number {
  const amount = _state.guardianShieldPending;
  _state.guardianShieldPending = 0;
  return amount;
}

// ── Multiplier Getters (damage pipeline integration) ─────────────────────────

/**
 * Get the total co-op damage multiplier to apply this turn.
 *
 * Returns the combined 1.0 base plus all active additive bonuses:
 *   - Synapse Link:    +0.5× when both players charged the same chain type
 *   - Knowledge Share: +0.25× when partner answered correctly last turn
 *   - Team Chain:      +0.5× when both players have active chains
 *
 * Maximum combined bonus: 1.0 + 0.5 + 0.25 + 0.5 = 2.25×
 *
 * All three bonuses are additive (not multiplicative) to prevent excessive
 * variance when all three trigger simultaneously.
 *
 * Call site: after resolving solo chain/buff/relic multipliers in the damage
 * pipeline, multiply the result by this value when in coop/duel mode.
 *
 * @returns Damage multiplier (≥ 1.0; exactly 1.0 when effects are inactive).
 */
export function getCoopDamageMultiplier(): number {
  if (!_state.active) return 1.0;
  return (
    1.0 +
    _state.synapseLinkBonus +     // Synapse Link bonus (0 or 0.5)
    _state.knowledgeShareBuff +   // Knowledge Share buff (0 or 0.25)
    _state.teamChainBonus         // Team Chain Bonus (0 or 0.5)
  );
}

/**
 * Check whether the current combined turn is a co-op surge turn.
 *
 * Co-op surge follows the same pattern as solo surge (every 4th turn starting
 * at turn 2: turns 2, 6, 10, 14...) but uses the shared combinedTurnCounter
 * rather than RunState.globalTurnCounter. This means both players benefit from
 * the AP surcharge waiver on the same turn regardless of their individual solo
 * turn counters.
 *
 * @returns true if this is a surge turn and co-op effects are active.
 */
export function isCoopSurgeTurn(): boolean {
  return _state.active && _state.isSurgeTurn;
}

/**
 * Get the total fog increase to apply to both players this turn from Fog Contagion.
 *
 * Returns 0 if co-op effects are inactive or no wrong answers occurred.
 * Each wrong answer from either player contributes FOG_PER_WRONG_ANSWER fog
 * units applied to all players in the session.
 *
 * Call site: encounterBridge after turn resolution, before drawHand.
 *
 * @returns Fog units to add via adjustAura() for each player.
 */
export function getSharedFogIncrease(): number {
  return _state.active ? _state.sharedFogIncrease : 0;
}
