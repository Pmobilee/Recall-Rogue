/**
 * Playwright Game Bot — State Reader
 *
 * Reads game state from the browser using window.__terraDebug() and
 * window.__terraPlay (the playtestAPI).
 *
 * The __terraDebug() snapshot provides current screen and interactive elements.
 * The __terraPlay.getCombatState() / getRunState() give richer combat data.
 */

import type { Page } from 'playwright';
import type { GameState, QuizState } from './types.js';

/**
 * Reads the current game state from the browser.
 * Combines data from window.__terraDebug() (screen, phaser) and
 * window.__terraPlay (run/combat state).
 */
export async function readGameState(page: Page): Promise<GameState> {
  // Use string-based evaluate to avoid tsx __name decorator injection
  return page.evaluate(`(() => {
    var debug = window.__terraDebug && window.__terraDebug();
    var currentScreen = (debug && debug.currentScreen) || 'unknown';

    var readStoreValue = function(key) {
      var sym = Symbol.for(key);
      var store = globalThis[sym];
      if (!store || typeof store !== 'object') return null;
      if (typeof store.subscribe !== 'function') return null;
      var value = null;
      store.subscribe(function(v) { value = v; })();
      return value;
    };

    var turnState = readStoreValue('terra:activeTurnState');
    var runState = readStoreValue('terra:activeRunState');

    var playerState = turnState && turnState.playerState;
    var enemy = turnState && turnState.enemy;
    var deck = turnState && turnState.deck;

    var terminals = ['run_end', 'game_over', 'victory', 'defeat', 'runEnd', 'runSummary', 'runComplete'];

    return {
      currentScreen: currentScreen,
      playerHP: (playerState && playerState.hp) || (runState && runState.playerHp) || 0,
      playerMaxHP: (playerState && playerState.maxHp) || (runState && runState.playerMaxHp) || 0,
      playerGold: (runState && (runState.currency || runState.gold)) || 0,
      enemyHP: (enemy && enemy.currentHP) || 0,
      enemyMaxHP: (enemy && enemy.maxHP) || 0,
      enemyName: (enemy && (enemy.name || (enemy.template && enemy.template.name))) || '',
      handSize: (deck && deck.hand && deck.hand.length) || 0,
      apCurrent: (turnState && turnState.apCurrent) || 0,
      apMax: (turnState && turnState.apMax) || 3,
      turnNumber: (turnState && turnState.turnNumber) || 0,
      comboCount: (turnState && turnState.comboCount) || 0,
      relicCount: (runState && runState.relics && runState.relics.length) || 0,
      floor: Number((runState && (runState.currentFloor || runState.floor)) || 0) || 0,
      isGameOver: terminals.indexOf(currentScreen) >= 0,
      runResult: currentScreen === 'victory' ? 'victory' :
                 (currentScreen === 'defeat' || currentScreen === 'game_over' || currentScreen === 'run_end' || currentScreen === 'runEnd') ? 'defeat' :
                 null,
    };
  })()`) as Promise<GameState>;
}

/**
 * Reads quiz state from window.__terraPlay.getQuiz().
 * Returns null if no active quiz.
 */
export async function readQuizState(page: Page): Promise<QuizState | null> {
  return page.evaluate((): QuizState | null => {
    const play = (window as any).__terraPlay;
    const quiz = play?.getQuiz?.();
    if (!quiz) return null;
    return {
      question: quiz.question ?? '',
      choices: Array.isArray(quiz.choices) ? quiz.choices : [],
      correctIndex: typeof quiz.correctIndex === 'number' ? quiz.correctIndex : -1,
      mode: quiz.mode ?? 'unknown',
    };
  });
}

/**
 * Waits for the game to reach a specific screen.
 * Throws if timeout is exceeded.
 */
export async function waitForScreen(page: Page, screen: string, timeoutMs = 10000): Promise<GameState> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readGameState(page);
    if (state.currentScreen === screen) return state;
    await page.waitForTimeout(200);
  }
  throw new Error(`Timeout waiting for screen: ${screen}`);
}

/**
 * Waits for the current screen to change away from the given screen.
 * Throws if timeout is exceeded.
 */
export async function waitForScreenChange(page: Page, fromScreen: string, timeoutMs = 10000): Promise<GameState> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readGameState(page);
    if (state.currentScreen !== fromScreen) return state;
    await page.waitForTimeout(200);
  }
  throw new Error(`Timeout waiting for screen change from: ${fromScreen}`);
}

/**
 * Checks if a DOM element with the given data-testid exists and is visible.
 */
export async function isElementVisible(page: Page, testId: string): Promise<boolean> {
  try {
    const el = page.locator(`[data-testid="${testId}"]`);
    return await el.isVisible({ timeout: 500 });
  } catch {
    return false;
  }
}

/**
 * Returns all currently visible data-testid values from the debug snapshot.
 * Useful for diagnosing stuck states.
 */
export async function getVisibleTestIds(page: Page): Promise<string[]> {
  return page.evaluate((): string[] => {
    const debug = (window as any).__terraDebug?.();
    if (!debug?.interactiveElements) return [];
    return (debug.interactiveElements as Array<{ testId: string; visible: boolean }>)
      .filter((el) => el.visible)
      .map((el) => el.testId);
  });
}
