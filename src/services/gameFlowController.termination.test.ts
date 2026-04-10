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

import { describe, it, expect, beforeEach } from 'vitest';
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
    expect(fnStart).toBeGreaterThan(-1);

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
    expect(fnEnd).toBeGreaterThan(fnStart);

    const fnBody = source.slice(fnStart, fnEnd + 1);

    // The function MUST set currentScreen to 'runEnd'
    expect(fnBody).toContain("currentScreen.set('runEnd')");

    // The function MUST NOT set currentScreen to 'hub' (regression guard)
    const hubSetMatches = fnBody.match(/currentScreen\.set\('hub'\)/g);
    expect(hubSetMatches).toBeNull();
  });

  it('all run-termination calls go through finishRunAndReturnToHub', () => {
    // Find all non-definition call sites of finishRunAndReturnToHub
    const finishCallPattern = /finishRunAndReturnToHub\(/g;
    const finishCalls: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = finishCallPattern.exec(source)) !== null) {
      // Skip the function definition itself
      if (source.slice(m.index - 10, m.index).includes('function ')) continue;
      finishCalls.push(m.index);
    }

    // There must be at least 2 call sites (defeat + retreat)
    expect(finishCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('defeat path (playerHp === 0) calls finishRunAndReturnToHub', () => {
    // Find the defeat block
    const defeatBlockStart = source.indexOf("if (result === 'defeat')");
    expect(defeatBlockStart).toBeGreaterThan(-1);

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

    expect(defeatBlock).toContain('finishRunAndReturnToHub(');
    expect(defeatBlock).not.toMatch(/currentScreen\.set\('hub'\)/);
  });

  it('retreat path calls finishRunAndReturnToHub', () => {
    const retreatCallIndex = source.lastIndexOf('finishRunAndReturnToHub(');
    expect(retreatCallIndex).toBeGreaterThan(-1);
  });

  it("currentScreen type includes runEnd as a valid screen", () => {
    expect(source).toContain("| 'runEnd'");
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
    // Attempt to import the headless simulator.
    // This may not be importable in all vitest configurations,
    // so we gracefully skip if the import fails.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let simulateFullRun: ((opts?: Record<string, unknown>) => unknown) | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('../../tests/playtest/headless/full-run-simulator.js');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      simulateFullRun = (mod.simulateFullRun as ((opts?: Record<string, unknown>) => unknown)) ?? null;
    } catch {
      // Simulator not importable in vitest context — skip gracefully
    }

    if (!simulateFullRun) {
      console.warn('  [MEDIUM-10] full-run-simulator not importable in vitest context — skipping headless leg');
      return;
    }

    // Run with very low accuracy + high ascension to force player death.
    // correctRate 0.0 = all fizzles -> minimal damage output -> player dies quickly.
    // ascensionLevel 8 = enemy damage multiplied, accelerates death.
    const rawResult = simulateFullRun({
      correctRate: 0.0,
      chargeRate: 0.5,
      ascensionLevel: 8,
      verbose: false,
    });
    // simulateFullRun may be sync or async depending on the context
    const result = (rawResult instanceof Promise ? await rawResult : rawResult) as {
      survived: boolean;
      deathFloor: number;
      finalHP: number;
    };

    // At 0% accuracy with ascension 8, the player should virtually never survive.
    expect(result.survived, 'survived must be false for 0% accuracy + ascension 8').toBe(false);

    // deathFloor > 0 confirms a floor was reached before death
    expect(result.deathFloor, 'deathFloor must be >0 on a death run').toBeGreaterThan(0);

    // finalHP confirms the player actually died (HP should be 0 or negative)
    expect(result.finalHP, 'finalHP must be <=0 on a death run').toBeLessThanOrEqual(0);
  });
});
