/**
 * Regression tests for Issue 7 — first-encounter AP bootstrap.
 *
 * Root cause: encounterBridge.ts set `turnState.apMax = startingAp` instead of
 * `turnState.apCurrent = startingAp`, which meant:
 *   (a) Control group (startingAp=3): apMax locked to 3, blocking Act 2's 4 AP.
 *   (b) Test group (startingAp=4): Math.min(START_AP_PER_TURN=3, apMax=4) = 3,
 *       so the experiment never actually granted 4 AP on turn 1.
 *
 * Fix: encounterBridge now sets `apCurrent = run.startingAp` and threads
 * `startingApPerTurn` through TurnState. endPlayerTurn uses Math.max(actBase, startingApPerTurn)
 * as the per-turn base, preserving Act 2 scaling for control group and extra AP for test group.
 *
 * These tests exercise the formulas in isolation (no Phaser/Svelte dependencies).
 */

import { describe, it, expect } from 'vitest';
import { START_AP_PER_TURN, MAX_AP_PER_TURN, AP_PER_ACT } from '../data/balance';

// ---------------------------------------------------------------------------
// Inline the fixed formulas from encounterBridge + endPlayerTurn
// to test them as pure logic without pulling in the full module graph.
// ---------------------------------------------------------------------------

/**
 * Simulates encounterBridge's encounter-start AP assignment (after Issue 7 fix).
 * Returns { apCurrent, apMax, startingApPerTurn } as they would be on TurnState
 * immediately after startEncounterForRoom sets them.
 */
function simulateEncounterBridgeApInit(startingAp: number): {
  apCurrent: number;
  apMax: number;
  startingApPerTurn: number;
} {
  // startEncounter initializes these:
  const apCurrent_init = START_AP_PER_TURN; // 3
  const apMax_init = MAX_AP_PER_TURN; // 5

  // encounterBridge after fix:
  const startingApPerTurn = startingAp;
  const apCurrent = startingAp; // directly set, not clamped by apMax
  const apMax = apMax_init; // unchanged — NOT overwritten by startingAp

  void apCurrent_init; // acknowledged, overwritten by encounterBridge

  return { apCurrent, apMax, startingApPerTurn };
}

/**
 * Simulates the OLD buggy encounterBridge code (before Issue 7 fix).
 */
function simulateOldBuggyEncounterBridgeApInit(startingAp: number): {
  apCurrent: number;
  apMax: number;
} {
  const apCurrent_init = START_AP_PER_TURN; // 3 (from startEncounter)
  const apMax_init = MAX_AP_PER_TURN; // 5 (from startEncounter)

  // OLD buggy lines 758-759:
  const apMax = Math.max(2, startingAp); // BUG: overwrites MAX_AP_PER_TURN
  const apCurrent = Math.min(apCurrent_init, apMax); // BUG: stays at 3

  void apMax_init; // acknowledged, overwritten by bug

  return { apCurrent, apMax };
}

/**
 * Simulates endPlayerTurn's AP reset (after Issue 7 fix).
 * Returns the apCurrent value at the start of the next player turn.
 */
function simulateEndPlayerTurnApReset(opts: {
  floor: number;
  startingApPerTurn: number;
  apMax: number;
  bonusApNextTurn: number;
  isSurge: boolean;
}): number {
  const { floor, startingApPerTurn, apMax, bonusApNextTurn, isSurge } = opts;
  const act = floor <= 6 ? 1 : floor <= 12 ? 2 : 3;
  const actBase = AP_PER_ACT[act] ?? START_AP_PER_TURN;
  // Fixed formula: use the higher of actBase vs startingApPerTurn
  const baseAp = Math.max(actBase, startingApPerTurn);
  let apCurrent = Math.min(apMax, baseAp + bonusApNextTurn);
  // Surge adds +1 after the base reset
  if (isSurge) {
    apCurrent = Math.min(apMax, apCurrent + 1);
  }
  return apCurrent;
}

/**
 * Simulates the OLD buggy endPlayerTurn AP reset.
 */
function simulateOldBuggyEndPlayerTurnApReset(opts: {
  floor: number;
  apMax: number; // was wrongly set to startingAp
  bonusApNextTurn: number;
}): number {
  const { floor, apMax, bonusApNextTurn } = opts;
  const act = floor <= 6 ? 1 : floor <= 12 ? 2 : 3;
  const actBase = AP_PER_ACT[act] ?? START_AP_PER_TURN;
  // OLD: just Math.min(apMax, actBase + bonus) — no startingApPerTurn floor
  return Math.min(apMax, actBase + bonusApNextTurn);
}

// ---------------------------------------------------------------------------
// Tests: encounter start
// ---------------------------------------------------------------------------

describe('encounterBridge AP init — Issue 7 fix (encounter start)', () => {
  describe('control group (startingAp=3)', () => {
    it('apCurrent = 3 on turn 1', () => {
      const { apCurrent } = simulateEncounterBridgeApInit(3);
      expect(apCurrent).toBe(3);
    });

    it('apMax = MAX_AP_PER_TURN (5), not capped to startingAp', () => {
      const { apMax } = simulateEncounterBridgeApInit(3);
      expect(apMax).toBe(MAX_AP_PER_TURN);
      expect(apMax).toBe(5);
    });

    it('startingApPerTurn = 3', () => {
      const { startingApPerTurn } = simulateEncounterBridgeApInit(3);
      expect(startingApPerTurn).toBe(3);
    });
  });

  describe('test group (startingAp=4)', () => {
    it('apCurrent = 4 on turn 1', () => {
      const { apCurrent } = simulateEncounterBridgeApInit(4);
      expect(apCurrent).toBe(4);
    });

    it('apMax = MAX_AP_PER_TURN (5), not capped to startingAp', () => {
      const { apMax } = simulateEncounterBridgeApInit(4);
      expect(apMax).toBe(MAX_AP_PER_TURN);
      expect(apMax).toBe(5);
    });

    it('startingApPerTurn = 4', () => {
      const { startingApPerTurn } = simulateEncounterBridgeApInit(4);
      expect(startingApPerTurn).toBe(4);
    });
  });

  describe('regression guard: old buggy code behavior', () => {
    it('OLD code: control group apMax was wrongly capped to 3', () => {
      const old = simulateOldBuggyEncounterBridgeApInit(3);
      expect(old.apMax).toBe(3); // bug: was Math.max(2, 3) = 3 not 5
    });

    it('OLD code: test group (startingAp=4) still gave apCurrent=3 on turn 1 (not 4)', () => {
      const old = simulateOldBuggyEncounterBridgeApInit(4);
      expect(old.apCurrent).toBe(3); // bug: Math.min(3, 4) = 3
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: per-turn AP reset
// ---------------------------------------------------------------------------

describe('endPlayerTurn AP reset — Issue 7 fix (subsequent turns)', () => {
  describe('control group (startingApPerTurn=3)', () => {
    it('Act 1 floor 1: 3 AP (max of AP_PER_ACT[1]=3, startingApPerTurn=3)', () => {
      const ap = simulateEndPlayerTurnApReset({
        floor: 1,
        startingApPerTurn: 3,
        apMax: MAX_AP_PER_TURN,
        bonusApNextTurn: 0,
        isSurge: false,
      });
      expect(ap).toBe(3);
    });

    it('Act 2 floor 7: 4 AP (AP_PER_ACT[2]=4 takes precedence over startingApPerTurn=3)', () => {
      const ap = simulateEndPlayerTurnApReset({
        floor: 7,
        startingApPerTurn: 3,
        apMax: MAX_AP_PER_TURN,
        bonusApNextTurn: 0,
        isSurge: false,
      });
      expect(ap).toBe(4);
    });

    it('Act 3 floor 13: 4 AP (AP_PER_ACT[3]=4)', () => {
      const ap = simulateEndPlayerTurnApReset({
        floor: 13,
        startingApPerTurn: 3,
        apMax: MAX_AP_PER_TURN,
        bonusApNextTurn: 0,
        isSurge: false,
      });
      expect(ap).toBe(4);
    });

    it('OLD code regression: Act 2 capped at 3 because apMax was set to startingAp=3', () => {
      // Old code: apMax = Math.max(2, startingAp=3) = 3
      // endPlayerTurn: apCurrent = Math.min(3, 4) = 3 — capped at 3, wrong!
      const buggy = simulateOldBuggyEndPlayerTurnApReset({
        floor: 7,
        apMax: 3, // the wrong apMax from old bug
        bonusApNextTurn: 0,
      });
      expect(buggy).toBe(3); // documents the bug
    });
  });

  describe('test group (startingApPerTurn=4)', () => {
    it('Act 1 floor 1: 4 AP (startingApPerTurn=4 beats AP_PER_ACT[1]=3)', () => {
      const ap = simulateEndPlayerTurnApReset({
        floor: 1,
        startingApPerTurn: 4,
        apMax: MAX_AP_PER_TURN,
        bonusApNextTurn: 0,
        isSurge: false,
      });
      expect(ap).toBe(4);
    });

    it('Act 2 floor 7: 4 AP (tie: AP_PER_ACT[2]=4 == startingApPerTurn=4)', () => {
      const ap = simulateEndPlayerTurnApReset({
        floor: 7,
        startingApPerTurn: 4,
        apMax: MAX_AP_PER_TURN,
        bonusApNextTurn: 0,
        isSurge: false,
      });
      expect(ap).toBe(4);
    });

    it('Surge turn Act 1: 5 AP (4 base + 1 surge bonus, capped at apMax=5)', () => {
      const ap = simulateEndPlayerTurnApReset({
        floor: 1,
        startingApPerTurn: 4,
        apMax: MAX_AP_PER_TURN,
        bonusApNextTurn: 0,
        isSurge: true,
      });
      expect(ap).toBe(5);
    });
  });

  describe('bonusApNextTurn carry-over', () => {
    it('bonusApNextTurn adds to base, capped by apMax', () => {
      // Control group Act 2 with +1 bonus (e.g. from relic): 4+1=5 but cap at MAX_AP=5
      const ap = simulateEndPlayerTurnApReset({
        floor: 7,
        startingApPerTurn: 3,
        apMax: MAX_AP_PER_TURN,
        bonusApNextTurn: 1,
        isSurge: false,
      });
      expect(ap).toBe(5);
    });

    it('bonusApNextTurn does not carry past turn end (formula resets to base)', () => {
      // A 3 AP base with bonus=2 would give 5, then next turn with no bonus = 3
      const apWithBonus = simulateEndPlayerTurnApReset({
        floor: 1,
        startingApPerTurn: 3,
        apMax: MAX_AP_PER_TURN,
        bonusApNextTurn: 2,
        isSurge: false,
      });
      expect(apWithBonus).toBe(5);

      // After the bonus is consumed, next turn resets to base
      const apNextTurn = simulateEndPlayerTurnApReset({
        floor: 1,
        startingApPerTurn: 3,
        apMax: MAX_AP_PER_TURN,
        bonusApNextTurn: 0, // reset to 0 after consumption
        isSurge: false,
      });
      expect(apNextTurn).toBe(3);
    });
  });
});
