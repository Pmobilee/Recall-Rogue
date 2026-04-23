/**
 * Failsafe Watchdogs — runtime stuck-state detection and recovery.
 *
 * Every watchdog in this file emits rrLog('watchdog:<area>', ...) on detection
 * and rrLog('watchdog:<area>', 'repair', ...) on repair so the grep cheat sheet
 * in .claude/skills/steam-deploy/SKILL.md can surface them in debug.log.
 *
 * Watchdog taxonomy:
 *   watchdog:hand          — Class A: hand/deck/AP stuck states
 *   watchdog:enemy         — Class B: enemy state validation
 *   watchdog:coop          — Class C: coop sync validation / HP clamping
 *   watchdog:barrier       — Class C: coop barrier cancel handling
 *   watchdog:reconcile     — Class C: coop reconcile failure
 *   watchdog:cardPlay      — Class A: card committed stage stuck (service-side hook)
 *   watchdog:audio         — Class H: audio load failure detection (future hook)
 *
 * Lifecycle:
 *   initFailsafeWatchdogs()    — called by encounterBridge.startEncounterForRoom()
 *   destroyFailsafeWatchdogs() — called by encounterBridge.notifyEncounterComplete()
 *                                and resetEncounterBridge()
 *
 * Class coverage in this file:
 *   A — hand/deck/AP stuck (watchdog:hand)
 *       card committed stage stuck (watchdog:cardPlay — UI calls notifyCardCommitted /
 *       notifyCardResolved; cardPlayStage lives in CardCombatOverlay.svelte, not TurnState)
 *   B — enemy state validation (validateEnemyState / watchdog:enemy)
 *   C — coop sync watchdogs (validateCoopHpUpdate, monitorDeltaBucketSize,
 *         handleCoopReconcileFailure, handleCoopBarrierCancel)
 *   H — audio failure (watchdog:audio — placeholder; wired by ui-agent in CardAudioManager)
 *
 * Classes D–G and E–F are wired at the service boundary rather than here,
 * because they live in transport/lobby/save layers that are out-of-scope for
 * this module. See docs/mechanics/failsafes.md for the full map.
 */

import { get } from 'svelte/store';
import { rrLog } from './rrLog';
import type { TurnState } from './turnManager';

// ─── Constants ──────────────────────────────────────────────────────────────────

/**
 * How long (ms) the hand must stay empty while AP > 0 and turn not ended before
 * the watchdog fires a re-hydrate or coop resnapshot.
 *
 * 3 s gives the UI time to animate a reshuffle, a relic trigger, or any other
 * legitimate brief-empty state. Below this threshold is normal gameplay.
 */
const EMPTY_HAND_WATCHDOG_MS = 3_000;

/**
 * How long (ms) a card may remain in 'committed' stage (quiz open) before the
 * watchdog emits a diagnostic log. Allows 5 minutes for a slow quiz answer.
 * Does NOT auto-resolve — forcing quiz resolution would risk awarding credit
 * without a real answer.
 */
const CARD_PLAY_STAGE_STUCK_MS = 300_000; // 5 minutes

/**
 * Poll interval for the main watchdog loop (ms).
 * Kept low enough to catch the empty-hand window before it becomes annoying
 * but high enough to avoid meaningful CPU overhead.
 */
const WATCHDOG_POLL_MS = 1_000;

/**
 * Maximum delta bucket size before a warning is logged.
 * In a 2-player coop game the bucket should never exceed 2 entries.
 * Larger values indicate a leftover delta from a previous turn slipped through.
 */
const MAX_DELTA_BUCKET_SIZE = 8;

// ─── Module state ───────────────────────────────────────────────────────────────

/** Handle for the main poll interval. Null when no encounter is active. */
let _watchdogInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Timestamp (Date.now()) when the hand was first detected to be empty
 * while AP > 0 and turn not yet ended.
 * Null while the hand is not in that condition.
 */
let _emptyHandDetectedAt: number | null = null;

/**
 * Whether the watchdog already fired a repair for the current empty-hand
 * window. Reset when the hand recovers.
 */
let _emptyHandRepairFired = false;

/**
 * Timestamp when the UI signaled a card entered the 'committed' stage.
 * Set via notifyCardCommitted(); cleared via notifyCardResolved().
 */
let _cardCommittedAt: number | null = null;

// ─── Public lifecycle ────────────────────────────────────────────────────────────

/**
 * Start the failsafe watchdog loop for the current encounter.
 * Called by encounterBridge.startEncounterForRoom() after the turn state is set.
 *
 * Safe to call multiple times — destroys the previous interval first.
 */
export function initFailsafeWatchdogs(): void {
  destroyFailsafeWatchdogs();
  _emptyHandDetectedAt = null;
  _emptyHandRepairFired = false;
  _cardCommittedAt = null;

  _watchdogInterval = setInterval(_watchdogTick, WATCHDOG_POLL_MS);
  rrLog('watchdog:hand', 'init — encounter watchdogs started');
}

/**
 * Stop the failsafe watchdog loop. Called at encounter end and on bridge reset.
 * Safe to call multiple times.
 */
export function destroyFailsafeWatchdogs(): void {
  if (_watchdogInterval !== null) {
    clearInterval(_watchdogInterval);
    _watchdogInterval = null;
    rrLog('watchdog:hand', 'destroy — encounter watchdogs stopped');
  }
  _emptyHandDetectedAt = null;
  _emptyHandRepairFired = false;
  _cardCommittedAt = null;
}

// ─── Class A UI hook: card committed stage ───────────────────────────────────────

/**
 * Signal from the UI that a card entered the 'committed' stage (quiz opened).
 *
 * Called by CardCombatOverlay.svelte when `cardPlayStage` transitions to 'committed'.
 * This lets the service-layer watchdog track quiz-open duration without accessing
 * Svelte component state directly.
 */
export function notifyCardCommitted(cardId: string): void {
  _cardCommittedAt = Date.now();
  rrLog('watchdog:cardPlay', 'card committed — quiz open', { cardId });
}

/**
 * Signal from the UI that the committed card was resolved (quiz answered or End Turn).
 *
 * Called by CardCombatOverlay.svelte when `cardPlayStage` transitions away from 'committed'.
 */
export function notifyCardResolved(cardId: string, outcome: 'correct' | 'wrong' | 'endturn'): void {
  if (_cardCommittedAt !== null) {
    const committedMs = Date.now() - _cardCommittedAt;
    rrLog('watchdog:cardPlay', 'card resolved', { cardId, outcome, committedMs });
  }
  _cardCommittedAt = null;
}

// ─── Main watchdog tick ──────────────────────────────────────────────────────────

/**
 * Called once per WATCHDOG_POLL_MS while an encounter is active.
 * Checks all Class A stuck-state conditions that are visible from TurnState.
 */
async function _watchdogTick(): Promise<void> {
  // Lazy-import to avoid circular deps — encounterBridge imports us.
  const { activeTurnState } = await import('./encounterBridge');
  const ts = get(activeTurnState);

  if (!ts || ts.result !== null) {
    // No active encounter or encounter already resolved — nothing to watch.
    _emptyHandDetectedAt = null;
    _emptyHandRepairFired = false;
    _cardCommittedAt = null;
    return;
  }

  _checkEmptyHandStuck(ts);
  _checkCardPlayStageStuck();
}

// ─── Class A: Hand / deck / AP stuck states ──────────────────────────────────────

/**
 * Detect the "hand=0, AP>0, turn not ended" stuck state.
 *
 * Root cause of the 2026-04-23 coop bug: both players ended up with empty
 * hands mid-encounter. This watchdog detects the condition after EMPTY_HAND_WATCHDOG_MS
 * and triggers a repair:
 *   - Solo: force a re-draw via patchTurnState (discard → draw reshuffle).
 *   - Coop: request a state resnapshot from the host so authoritative hand state
 *     overwrites any local divergence.
 */
function _checkEmptyHandStuck(ts: TurnState): void {
  const handIsEmpty = ts.deck.hand.length === 0;
  const hasAP = ts.apCurrent > 0;
  const turnNotEnded = ts.phase === 'player_action';

  if (handIsEmpty && hasAP && turnNotEnded) {
    if (_emptyHandDetectedAt === null) {
      _emptyHandDetectedAt = Date.now();
      rrLog('watchdog:hand', 'empty hand detected — AP>0 and turn not ended, starting timer', {
        ap: ts.apCurrent,
        drawPile: ts.deck.drawPile.length,
        discardPile: ts.deck.discardPile.length,
        phase: ts.phase,
      });
    } else if (!_emptyHandRepairFired && Date.now() - _emptyHandDetectedAt >= EMPTY_HAND_WATCHDOG_MS) {
      _emptyHandRepairFired = true;
      rrLog('watchdog:hand', 'STUCK — hand empty for 3s while AP>0, triggering repair', {
        ap: ts.apCurrent,
        drawPile: ts.deck.drawPile.length,
        discardPile: ts.deck.discardPile.length,
        emptyHandMs: Date.now() - _emptyHandDetectedAt!,
      });
      void _repairEmptyHand(ts);
    }
  } else {
    // Hand recovered (either cards drawn or turn ended).
    if (_emptyHandDetectedAt !== null) {
      rrLog('watchdog:hand', 'hand recovered — resetting empty-hand timer', {
        handSize: ts.deck.hand.length,
        phase: ts.phase,
      });
    }
    _emptyHandDetectedAt = null;
    _emptyHandRepairFired = false;
  }
}

/**
 * Check whether a card has been stuck in the 'committed' stage for too long.
 * The committed timestamp is set/cleared via notifyCardCommitted/notifyCardResolved.
 * Logs a diagnostic warning but does NOT auto-resolve the quiz.
 */
function _checkCardPlayStageStuck(): void {
  if (_cardCommittedAt === null) return;

  const committedMs = Date.now() - _cardCommittedAt;
  if (committedMs >= CARD_PLAY_STAGE_STUCK_MS) {
    rrLog('watchdog:cardPlay', 'STUCK — card in committed stage for 5+ minutes', {
      committedMs,
      note: 'player may be AFK; End Turn will cancel the quiz without answering',
    });
    // Reset timer so we log at most once per CARD_PLAY_STAGE_STUCK_MS.
    _cardCommittedAt = Date.now();
  }
}

/**
 * Repair: attempt to draw cards into the empty hand.
 *
 * In coop mode: requests a full state resnapshot from the host so authoritative
 * hand state can correct any host/guest divergence that caused the empty hand.
 *
 * In solo/race mode: synthesises a new hand from drawPile (or discard reshuffle)
 * via patchTurnState so the Svelte store re-renders.
 */
async function _repairEmptyHand(ts: TurnState): Promise<void> {
  const { activeRunState } = await import('./runStateStore');
  const run = get(activeRunState);
  const isCoopRun = run?.multiplayerMode === 'coop';

  if (isCoopRun) {
    // Coop: request initial state resnapshot from host.
    rrLog('watchdog:hand', 'repair:coop — requesting state resnapshot from host');
    try {
      const { requestCoopEnemyStateRetry } = await import('./multiplayerCoopSync');
      requestCoopEnemyStateRetry();
      rrLog('watchdog:hand', 'repair:coop — resnapshot request sent');
    } catch (err) {
      rrLog('watchdog:hand', 'repair:coop — resnapshot request failed', { err: String(err) });
    }
    return;
  }

  // Solo/race: synthesise a new hand from whatever is available.
  rrLog('watchdog:hand', 'repair:solo — forcing re-draw');

  try {
    const { patchTurnState, getCombatScene } = await import('./encounterBridge');

    // Pull from drawPile first, then discardPile if needed (mimics drawHand reshuffle).
    const availableInDraw = [...ts.deck.drawPile];
    const availableInDiscard = [...ts.deck.discardPile];
    const cardsToGive = availableInDraw.splice(0, 5);

    if (cardsToGive.length < 5 && availableInDiscard.length > 0) {
      // Reshuffle discard into the draw pool for this recovery.
      const reshuffled = [...availableInDiscard];
      availableInDiscard.length = 0;
      cardsToGive.push(...reshuffled.splice(0, 5 - cardsToGive.length));
      availableInDraw.push(...reshuffled); // remainder back into draw
    }

    if (cardsToGive.length > 0) {
      const patched = patchTurnState({
        deck: {
          hand: cardsToGive,
          drawPile: availableInDraw,
          discardPile: availableInDiscard,
        },
      });
      rrLog('watchdog:hand', 'repair:solo — patched hand with cards', {
        handSize: cardsToGive.length,
        patchSuccess: patched,
      });
      // Trigger a card-draw sound so the player notices the recovery.
      const scene = getCombatScene();
      if (scene) {
        const { playCardAudio } = await import('./cardAudioManager');
        playCardAudio('card-draw');
      }
    } else {
      // Genuinely exhausted — draw pile and discard both empty.
      rrLog('watchdog:hand', 'repair:solo — deck is genuinely exhausted, no repair possible');
    }
  } catch (err) {
    rrLog('watchdog:hand', 'repair:solo — repair threw', { err: String(err) });
  }
}

// ─── Class B: Enemy state validation ─────────────────────────────────────────────

/**
 * Validate an enemy instance at encounter start.
 *
 * Catches Class B stuck states before the encounter becomes visible:
 *   - currentHP is NaN or negative
 *   - currentHP > maxHP (clamp)
 *   - maxHP <= 0
 *   - No intent pool (empty / all gated)
 *
 * Mutates the enemy in place where safe (HP clamping).
 *
 * @param enemy  The EnemyInstance produced by createEnemy() in encounterBridge.
 */
export function validateEnemyState(enemy: unknown): void {
  if (!enemy || typeof enemy !== 'object') {
    rrLog('watchdog:enemy', 'INVALID — enemy is null or non-object at encounter start', { enemy });
    return;
  }

  const e = enemy as {
    currentHP: number;
    maxHP: number;
    block?: number;
    template?: { id?: string; name?: string; intentPool?: unknown[] };
    nextIntent?: { type?: string };
    statusEffects?: unknown[];
  };

  const id = e.template?.id ?? 'unknown';

  // HP validation and clamping.
  if (typeof e.currentHP !== 'number' || isNaN(e.currentHP)) {
    rrLog('watchdog:enemy', 'INVALID — currentHP is NaN, clamping to maxHP', { id, currentHP: e.currentHP, maxHP: e.maxHP });
    e.currentHP = typeof e.maxHP === 'number' && !isNaN(e.maxHP) ? e.maxHP : 1;
  }

  if (typeof e.maxHP !== 'number' || isNaN(e.maxHP) || e.maxHP <= 0) {
    rrLog('watchdog:enemy', 'INVALID — maxHP is invalid, clamping to 1', { id, maxHP: e.maxHP });
    e.maxHP = 1;
  }

  if (e.currentHP < 0) {
    rrLog('watchdog:enemy', 'INVALID — currentHP is negative, clamping to 0', { id, currentHP: e.currentHP });
    e.currentHP = 0;
  }

  if (e.currentHP > e.maxHP) {
    rrLog('watchdog:enemy', 'WARN — currentHP exceeds maxHP, clamping', { id, currentHP: e.currentHP, maxHP: e.maxHP });
    e.currentHP = e.maxHP;
  }

  // Intent pool check (Class B: empty intent pool).
  const pool = e.template?.intentPool;
  if (!pool || !Array.isArray(pool) || pool.length === 0) {
    rrLog('watchdog:enemy', 'WARN — intent pool is empty or missing', { id });
    // No repair — the encounter proceeds with whatever rollNextIntent returns.
    // An enemy without intents uses the fallback no-op path in enemyManager.
  }

  rrLog('watchdog:enemy', 'validated', { id, currentHP: e.currentHP, maxHP: e.maxHP });
}

// ─── Class C: Coop sync watchdogs ────────────────────────────────────────────────

/**
 * Validate and clamp incoming coop enemy HP values.
 *
 * Guards against the wire delivering HP > maxHP, negative HP, or NaN values
 * that would produce invalid enemy state on the receiving client.
 *
 * Called from multiplayerCoopSync.ts on every mp:coop:enemy_hp_update receive.
 *
 * @param currentHP  Raw currentHP from the wire.
 * @param maxHP      Raw maxHP from the wire.
 * @param localMaxHP Local enemy maxHP as the authoritative cap.
 * @returns Clamped { currentHP, maxHP }.
 */
export function validateCoopHpUpdate(
  currentHP: number,
  maxHP: number,
  localMaxHP: number,
): { currentHP: number; maxHP: number } {
  const capHP = (typeof localMaxHP === 'number' && localMaxHP > 0)
    ? localMaxHP
    : (typeof maxHP === 'number' && maxHP > 0 ? maxHP : 1);

  let safeHP = (typeof currentHP === 'number' && !isNaN(currentHP)) ? currentHP : capHP;
  let safeMax = (typeof maxHP === 'number' && !isNaN(maxHP) && maxHP > 0) ? maxHP : capHP;

  if (safeHP > safeMax) {
    rrLog('watchdog:coop', 'clamp — currentHP > maxHP', { raw: currentHP, max: safeMax });
    safeHP = safeMax;
  }
  if (safeHP < 0) {
    rrLog('watchdog:coop', 'clamp — currentHP < 0', { raw: currentHP });
    safeHP = 0;
  }

  return { currentHP: safeHP, maxHP: safeMax };
}

/**
 * Monitor the delta bucket size for the M-047 regression (bucket overflow).
 *
 * In a 2-player coop game the bucket for a given turn should contain at most 2
 * entries (one per player). Larger buckets indicate a stale delta from a previous
 * turn has leaked into the current bucket — the 2026-04-22 M-047 fix bucketed by
 * turn number to prevent this, but this watchdog confirms the invariant holds.
 *
 * Called from multiplayerCoopSync.awaitCoopTurnEndWithDelta() after the local
 * delta is added.
 *
 * @param turnNumber    Current turn number (bucket key).
 * @param bucketSize    Current size of the bucket for this turn.
 * @param playerCount   Expected max entries (equals lobby player count).
 */
export function monitorDeltaBucketSize(
  turnNumber: number,
  bucketSize: number,
  playerCount: number,
): void {
  if (bucketSize > playerCount) {
    rrLog('watchdog:coop', 'delta bucket overflow — M-047 regression suspected', {
      turnNumber,
      bucketSize,
      playerCount,
      excess: bucketSize - playerCount,
    });
  } else if (bucketSize > MAX_DELTA_BUCKET_SIZE) {
    rrLog('watchdog:coop', 'delta bucket very large — possible runaway accumulation', {
      turnNumber,
      bucketSize,
    });
  }
}

/**
 * Handle a coop enemy-reconcile failure (both awaitCoopEnemyReconcile() calls timed out).
 *
 * Called from encounterBridge.startEncounterForRoom() when the guest cannot get
 * an authoritative initial enemy snapshot after two attempts.
 *
 * Strategy: log the failure with context, continue with local enemy state
 * (best available — may differ from host by variance). The shared-enemy
 * reconcile at each turn-end will resync HP on the first turn.
 *
 * @param attempt  How many reconcile attempts were made before giving up.
 */
export function handleCoopReconcileFailure(attempt: number): void {
  rrLog('watchdog:reconcile', 'FAILED — both reconcile attempts timed out, using local enemy state', {
    attempt,
    note: 'turn-end reconcile will resync HP on first turn-end',
  });
  // No throw — the encounter proceeds with local state.
}

/**
 * Handle a coop turn-end barrier cancellation (partner dropped or timed out).
 *
 * Called from encounterBridge.handleEndTurn() when awaitCoopTurnEndWithDelta()
 * resolves as 'cancelled'.
 *
 * Strategy:
 *   - Log the cancellation with reason.
 *   - Restore local turn control by resetting coopWaitingForPartner.
 *   - Do NOT run the enemy phase — the encounter is interrupted.
 *   - The player retains their hand and AP so they can choose to end-turn again
 *     (which will attempt a new barrier) or use the hub-exit control if available.
 *
 * @param reason  Why the barrier was cancelled ('timeout' | 'partner_left' | 'local_cancel').
 */
export function handleCoopBarrierCancel(reason: 'timeout' | 'partner_left' | 'local_cancel'): void {
  rrLog('watchdog:barrier', `barrier cancelled — reason=${reason}`, {
    reason,
    note: 'turn control restored; player may re-attempt end-turn or leave encounter',
  });

  // Restore the waiting state. Dynamic import to avoid circular deps.
  void (async () => {
    try {
      const { coopWaitingForPartner } = await import('./encounterBridge');
      coopWaitingForPartner.set(false);
    } catch {
      // Swallow — the store may already be in a clean state.
    }
  })();
}
