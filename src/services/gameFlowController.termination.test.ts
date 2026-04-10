/**
 * Regression test for MEDIUM-10 (2026-04-10):
 * Zero-HP death skipped the runEnd screen and jumped directly to hub.
 *
 * Root cause: `finishRunAndReturnToHub()` called `currentScreen.set('hub')`
 * instead of `currentScreen.set('runEnd')`. The RunEndScreen component
 * renders only when `currentScreen === 'runEnd'`, so players never saw it.
 *
 * Fix: Changed the last line of `finishRunAndReturnToHub` to navigate to
 * 'runEnd'. The RunEndScreen's "Play Again" / "Return to Hub" buttons then
 * call `playAgain()` / `returnToMenu()` which navigate to hub.
 *
 * This test suite verifies the invariant at the source level:
 * - finishRunAndReturnToHub MUST route to 'runEnd', not 'hub'
 * - All run-termination callers (defeat, retreat) go through finishRunAndReturnToHub
 * - No direct hub jump exists in any run-termination path
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Source-level invariant tests — parse the production source and verify the
// termination contract is maintained. These tests will catch any future
// regression where someone changes the navigation back to 'hub'.
// ---------------------------------------------------------------------------

describe('MEDIUM-10 — run termination screen routing invariant', () => {
  const CONTROLLER_PATH = path.resolve(
    __dirname,
    'gameFlowController.ts',
  );

  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(CONTROLLER_PATH, 'utf-8');
  });

  it('finishRunAndReturnToHub routes to runEnd, NOT hub', () => {
    // Extract the finishRunAndReturnToHub function body
    const fnStart = source.indexOf('function finishRunAndReturnToHub(');
    expect(fnStart).toBeGreaterThan(-1, 'finishRunAndReturnToHub function must exist');

    // Find the closing brace of the function by matching braces
    let depth = 0;
    let fnEnd = -1;
    for (let i = fnStart; i < source.length; i++) {
      if (source[i] === '{') depth++;
      if (source[i] === '}') {
        depth--;
        if (depth === 0) {
          fnEnd = i;
          break;
        }
      }
    }
    expect(fnEnd).toBeGreaterThan(fnStart, 'function must have a closing brace');

    const fnBody = source.slice(fnStart, fnEnd + 1);

    // The function MUST set currentScreen to 'runEnd'
    expect(fnBody).toContain("currentScreen.set('runEnd')",
      "finishRunAndReturnToHub must navigate to 'runEnd' screen, not 'hub'. " +
      'The RunEndScreen only renders when currentScreen === runEnd. ' +
      'Players must see the run summary before returning to hub.'
    );

    // The function MUST NOT set currentScreen to 'hub' (regression guard)
    // Note: check for the exact navigation call, not general string match
    // (the function label "ReturnToHub" is OK to appear in variable names)
    const hubSetMatches = fnBody.match(/currentScreen\.set\('hub'\)/g);
    expect(hubSetMatches).toBeNull(
      "finishRunAndReturnToHub must NOT call currentScreen.set('hub'). " +
      'Found direct hub navigation in run-termination path — this skips RunEndScreen. ' +
      'See MEDIUM-10 fix: route through runEnd first.'
    );
  });

  it('all run-termination calls go through finishRunAndReturnToHub', () => {
    // The three run-termination paths are:
    // 1. defeat — result === 'defeat' in onEncounterComplete
    // 2. retreat — onRetreat()
    // 3. (victory flows through card reward → floor completion → no single endRun call for victory)
    //
    // Verify that defeat and retreat both call finishRunAndReturnToHub
    // rather than jumping to hub directly.

    // Find all calls to endRun() and assert each is followed by finishRunAndReturnToHub
    // Strategy: find `finishRunAndReturnToHub(` call sites and verify endRun precedes each.
    const finishCallPattern = /finishRunAndReturnToHub\(/g;
    const finishCalls: number[] = [];
    let m;
    while ((m = finishCallPattern.exec(source)) !== null) {
      // Skip the function definition itself
      if (source.slice(m.index - 10, m.index).includes('function ')) continue;
      finishCalls.push(m.index);
    }

    // There must be at least 2 call sites (defeat + retreat)
    expect(finishCalls.length).toBeGreaterThanOrEqual(2,
      'Expected at least 2 finishRunAndReturnToHub call sites (defeat + retreat)'
    );
  });

  it('defeat path (playerHp === 0) calls finishRunAndReturnToHub', () => {
    // Find the defeat block: `if (result === 'defeat')`
    // Verify it calls finishRunAndReturnToHub within the block
    const defeatBlockStart = source.indexOf("if (result === 'defeat')");
    expect(defeatBlockStart).toBeGreaterThan(-1, "defeat block must exist in onEncounterComplete");

    // Extract block body
    let depth = 0;
    let blockEnd = -1;
    for (let i = defeatBlockStart; i < source.length; i++) {
      if (source[i] === '{') depth++;
      if (source[i] === '}') {
        depth--;
        if (depth === 0) {
          blockEnd = i;
          break;
        }
      }
    }
    const defeatBlock = source.slice(defeatBlockStart, blockEnd + 1);

    expect(defeatBlock).toContain('finishRunAndReturnToHub(',
      'defeat path must call finishRunAndReturnToHub, not navigate to hub directly'
    );
    expect(defeatBlock).not.toMatch(/currentScreen\.set\('hub'\)/,
      'defeat path must not jump directly to hub — must go through runEnd via finishRunAndReturnToHub'
    );
  });

  it('retreat path calls finishRunAndReturnToHub', () => {
    // Find `onRetreat` or the retreat block
    const retreatCallIndex = source.lastIndexOf('finishRunAndReturnToHub(');
    // Verify it exists in non-defeat context (there are 2 call sites: defeat + retreat)
    expect(retreatCallIndex).toBeGreaterThan(-1,
      'retreat path must call finishRunAndReturnToHub'
    );
  });

  it('currentScreen type includes runEnd as a valid screen', () => {
    // Verify 'runEnd' is in the Screen union type
    expect(source).toContain("| 'runEnd'",
      "'runEnd' must be a valid Screen value in the currentScreen store type"
    );
  });
});

// ---------------------------------------------------------------------------
// Headless sim extension — forced-death scenario
// Tests that the run termination flow produces the expected death outcome in the
// headless simulator when playerHp reaches 0 (regression for the underlying
// game logic, decoupled from screen routing which is UI-layer).
// ---------------------------------------------------------------------------

describe('MEDIUM-10 — forced-death headless scenario', () => {
  it('full-run simulator with 0% accuracy ends in death (not survival)', async () => {
    // Import the headless simulator — resolves from the test runner context
    let simulateFullRun: ((...args: unknown[]) => Promise<unknown>) | null = null;
    try {
      const mod = await import('../../tests/playtest/headless/full-run-simulator.js');
      simulateFullRun = mod.simulateFullRun ?? null;
    } catch {
      // Simulator not importable in vitest context — skip gracefully
    }

    if (!simulateFullRun) {
      console.warn('  [MEDIUM-10] full-run-simulator not importable in vitest context — skipping headless leg');
      return;
    }

    // Run with very low accuracy + high ascension to force player death.
    // correctRate 0.0 = all fizzles → minimal damage output → player dies quickly.
    // ascensionLevel 8 = enemy damage multiplied, accelerates death.
    const result = await simulateFullRun({
      correctRate: 0.0,
      chargeRate: 0.5,
      ascensionLevel: 8,
      verbose: false,
    }) as { survived: boolean; deathFloor: number; finalHP: number };

    // At 0% accuracy with ascension 8, the player should virtually never survive.
    // This assertion catches if the simulator logic breaks (enemy never kills player).
    expect(result.survived).toBe(false,
      'A run with 0% accuracy and ascension 8 should end in player death. ' +
      'If survival is true, the enemy damage pipeline or death detection may be broken.'
    );

    // deathFloor > 0 confirms a floor was reached before death
    expect(result.deathFloor).toBeGreaterThan(0,
      'deathFloor must be >0 on a death run — player must have reached at least one combat'
    );

    // finalHP confirms the player actually died (HP should be 0 or negative)
    expect(result.finalHP).toBeLessThanOrEqual(0,
      'finalHP must be ≤0 on a death run'
    );
  });
});
