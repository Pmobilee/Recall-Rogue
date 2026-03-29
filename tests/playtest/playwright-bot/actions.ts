/**
 * Playwright Game Bot — Actions
 *
 * All DOM interactions the bot can perform. Prefers window.__rrPlay API
 * calls (which are more reliable than raw DOM clicks) when available, but
 * falls back to direct data-testid clicks for elements not covered by the API.
 */

import type { Page } from 'playwright';
import type { BotProfile, GameState, QuizState } from './types.js';
import { isElementVisible } from './state-reader.js';

// ---------------------------------------------------------------------------
// RNG
// ---------------------------------------------------------------------------

/** Seeded pseudo-random number generator (mulberry32). Returns values in [0, 1). */
export function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/**
 * Clicks a DOM element by data-testid.
 * Returns true if the element was found and clicked.
 */
export async function clickTestId(page: Page, testId: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const el = page.locator(`[data-testid="${testId}"]`);
    await el.click({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Calls a window.__rrPlay method by name and returns the result.
 * Returns null if the API or method is unavailable.
 */
async function callPlayAPI(page: Page, method: string, ...args: unknown[]): Promise<unknown> {
  return page.evaluate(
    ([m, a]: [string, unknown[]]) => {
      const play = (window as any).__rrPlay;
      if (!play || typeof play[m] !== 'function') return null;
      return play[m](...a);
    },
    [method, args] as [string, unknown[]]
  );
}

// ---------------------------------------------------------------------------
// Run management
// ---------------------------------------------------------------------------

/**
 * Starts a new run from the hub screen using __rrPlay.startRun().
 */
export async function startRun(page: Page): Promise<boolean> {
  const result = await callPlayAPI(page, 'startRun') as { ok: boolean } | null;
  if (result?.ok) return true;
  // Fallback: direct DOM click
  return clickTestId(page, 'btn-start-run');
}

/**
 * Selects a domain by name using __rrPlay.selectDomain().
 * Falls back to clicking the first visible domain card.
 */
export async function selectDomain(page: Page, domain: string): Promise<boolean> {
  const result = await callPlayAPI(page, 'selectDomain', domain) as { ok: boolean } | null;
  if (result?.ok) return true;

  // Fallback: click first visible domain card
  for (const d of ['science', 'history', 'geography', 'literature', 'arts', 'nature']) {
    if (await isElementVisible(page, `domain-card-${d}`)) {
      return clickTestId(page, `domain-card-${d}`);
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

/**
 * Plays a card from the hand. Iterates through hand slots to find a visible card.
 * Returns the card index played, or -1 if no card could be played.
 */
export async function playCard(page: Page, _profile: BotProfile, state: GameState, rng: () => number): Promise<number> {
  const handSize = Math.max(state.handSize, 5); // Check up to 5 slots

  // Collect visible card indices
  const visibleIndices: number[] = [];
  for (let i = 0; i < handSize; i++) {
    if (await isElementVisible(page, `card-hand-${i}`)) {
      visibleIndices.push(i);
    }
  }

  if (visibleIndices.length === 0) return -1;

  // Pick a card index to play (random selection for now — strategy improvements can be layered)
  const pickIdx = Math.floor(rng() * visibleIndices.length);
  const cardIndex = visibleIndices[pickIdx];

  // Use __rrPlay.playCard which handles the click and waits for state update
  const result = await callPlayAPI(page, 'playCard', cardIndex) as { ok: boolean } | null;
  if (result?.ok) return cardIndex;

  // Fallback
  const clicked = await clickTestId(page, `card-hand-${cardIndex}`);
  return clicked ? cardIndex : -1;
}

/**
 * Ends the current combat turn using __rrPlay.endTurn().
 */
export async function endTurn(page: Page): Promise<boolean> {
  const result = await callPlayAPI(page, 'endTurn') as { ok: boolean } | null;
  if (result?.ok) return true;
  return clickTestId(page, 'btn-end-turn');
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

/**
 * Answers a quiz question based on profile accuracy.
 *
 * If rng() < quizAccuracy AND the correct index is known, picks the correct answer.
 * Otherwise picks a random wrong answer (or any answer if correct index is unknown).
 *
 * Returns whether the bot picked the correct answer.
 */
export async function answerQuiz(page: Page, profile: BotProfile, quiz: QuizState | null, rng: () => number): Promise<boolean> {
  await page.waitForTimeout(50); // Let quiz render fully

  const answerCount = quiz?.choices.length ?? 3;
  const correctIndex = quiz?.correctIndex ?? -1;
  const shouldAnswerCorrectly = rng() < profile.quizAccuracy;

  let targetIndex: number;

  if (shouldAnswerCorrectly && correctIndex >= 0) {
    // Knows the correct answer
    targetIndex = correctIndex;
  } else if (!shouldAnswerCorrectly && correctIndex >= 0 && answerCount > 1) {
    // Deliberately pick a wrong answer
    const wrongOptions = Array.from({ length: answerCount }, (_, i) => i).filter((i) => i !== correctIndex);
    targetIndex = wrongOptions[Math.floor(rng() * wrongOptions.length)];
  } else {
    // Correct index unknown, or only one answer — pick randomly
    targetIndex = Math.floor(rng() * answerCount);
  }

  // Use __rrPlay.answerQuiz for reliability
  const result = await callPlayAPI(page, 'answerQuiz', targetIndex) as { ok: boolean } | null;
  if (result?.ok) return targetIndex === correctIndex;

  // Fallback
  await clickTestId(page, `quiz-answer-${targetIndex}`);
  return targetIndex === correctIndex;
}

// ---------------------------------------------------------------------------
// Room selection
// ---------------------------------------------------------------------------

/**
 * Chooses a room from the room selection screen.
 * Basic strategy: random. Intermediate/optimal: prefer combat rooms when healthy.
 */
export async function chooseRoom(page: Page, profile: BotProfile, state: GameState, rng: () => number): Promise<boolean> {
  await page.waitForTimeout(50);

  // Count available room choices
  let roomCount = 0;
  for (let i = 0; i < 4; i++) {
    if (await isElementVisible(page, `room-choice-${i}`)) roomCount = i + 1;
    else break;
  }
  if (roomCount === 0) {
    // Try generic approach — look for any room-choice element
    const count = await page.locator('[data-testid^="room-choice-"]').count();
    roomCount = count;
  }
  if (roomCount === 0) return false;

  let pick: number;
  if (profile.strategy === 'basic') {
    pick = Math.floor(rng() * roomCount);
  } else {
    // Intermediate/optimal: when low HP (<40%), prefer first room (often easier)
    const hpFrac = state.playerMaxHP > 0 ? state.playerHP / state.playerMaxHP : 1;
    if (hpFrac < 0.4 && roomCount > 1) {
      pick = 0; // Play it safe — pick first option
    } else {
      pick = Math.floor(rng() * roomCount);
    }
  }

  const result = await callPlayAPI(page, 'selectRoom', pick) as { ok: boolean } | null;
  if (result?.ok) return true;
  return clickTestId(page, `room-choice-${pick}`);
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

/**
 * Handles the card reward screen. Picks a reward card or skips.
 */
export async function handleCardReward(page: Page, profile: BotProfile, rng: () => number): Promise<boolean> {
  await page.waitForTimeout(50);

  // Try reward-type buttons first (the game's reward selection UI)
  const rewardTypes = ['attack', 'shield', 'utility', 'buff'];
  for (const t of rewardTypes) {
    if (await isElementVisible(page, `reward-type-${t}`)) {
      const result = await callPlayAPI(page, 'selectRewardType', t) as { ok: boolean } | null;
      if (result?.ok) {
        // Then accept
        const accepted = await callPlayAPI(page, 'acceptReward') as { ok: boolean } | null;
        if (accepted?.ok) return true;
        return clickTestId(page, 'reward-accept') || clickTestId(page, 'btn-accept-reward');
      }
    }
  }

  // Try acceptReward directly
  const accepted = await callPlayAPI(page, 'acceptReward') as { ok: boolean } | null;
  if (accepted?.ok) return true;

  // Try legacy card-reward-N test IDs
  for (let i = 0; i < 4; i++) {
    if (await isElementVisible(page, `card-reward-${i}`)) {
      const pick = profile.strategy === 'basic' ? 0 : Math.floor(rng() * 3);
      return clickTestId(page, `card-reward-${pick}`);
    }
  }

  // Skip the reward
  return (
    clickTestId(page, 'btn-skip-reward') ||
    clickTestId(page, 'btn-skip') ||
    clickTestId(page, 'btn-close')
  );
}

// ---------------------------------------------------------------------------
// Navigation / checkpoint
// ---------------------------------------------------------------------------

/**
 * Handles the delve/retreat decision. ALWAYS delves — never retreats.
 * Bots push until death or game-declared victory for maximum balance data.
 */
export async function handleDelveRetreat(page: Page, _profile: BotProfile, _state: GameState): Promise<boolean> {
  const result = await callPlayAPI(page, 'delve') as { ok: boolean } | null;
  if (result?.ok) return true;
  return clickTestId(page, 'btn-delve');
}

/**
 * Handles rest rooms — heal if low HP, upgrade if healthy (optimal strategy).
 */
export async function handleRest(page: Page, profile: BotProfile, state: GameState): Promise<boolean> {
  const hpFrac = state.playerMaxHP > 0 ? state.playerHP / state.playerMaxHP : 1;
  const shouldHeal = profile.strategy !== 'optimal' || hpFrac < 0.7;

  if (shouldHeal) {
    const result = await callPlayAPI(page, 'restHeal') as { ok: boolean } | null;
    if (result?.ok) return true;
    return clickTestId(page, 'rest-heal') || clickTestId(page, 'btn-rest-heal') || clickTestId(page, 'btn-heal');
  }

  const result = await callPlayAPI(page, 'restUpgrade') as { ok: boolean } | null;
  if (result?.ok) return true;
  return (
    clickTestId(page, 'rest-upgrade') ||
    clickTestId(page, 'btn-rest-upgrade') ||
    clickTestId(page, 'btn-upgrade') ||
    // Fallback to heal if upgrade not available
    clickTestId(page, 'rest-heal') ||
    clickTestId(page, 'btn-heal')
  );
}

/**
 * Handles mystery events by continuing past them.
 */
export async function handleMystery(page: Page): Promise<boolean> {
  const result = await callPlayAPI(page, 'mysteryContinue') as { ok: boolean } | null;
  if (result?.ok) return true;
  return clickTestId(page, 'mystery-continue') || clickTestId(page, 'btn-continue');
}

/**
 * Generic fallback action — tries common continue/proceed buttons.
 * Used when the bot encounters an unrecognized screen.
 */
export async function handleGenericAction(page: Page): Promise<boolean> {
  const candidates = [
    'btn-continue',
    'btn-proceed',
    'btn-next',
    'btn-ok',
    'btn-close',
    'btn-delve',
    'btn-skip',
    'btn-skip-reward',
    'btn-end-turn',
    'mystery-continue',
  ];

  for (const id of candidates) {
    if (await isElementVisible(page, id)) {
      return clickTestId(page, id);
    }
  }
  return false;
}
