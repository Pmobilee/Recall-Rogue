/**
 * Playtest gameplay API — registers window.__terraPlay in dev mode.
 * Lets AI models play Recall Rogue programmatically via action and perception methods.
 * DEV MODE ONLY — never included in production builds.
 */

import {
  look, getAllText, getQuizText, getStudyCardText, getHUDText,
  getNotifications, validateScreen,
} from './playtestDescriber'
import { readStore } from './storeBridge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayResult {
  ok: boolean;
  message: string;
  state?: Record<string, unknown>;
}

/** Write a value to a Svelte store singleton. */
function writeStore<T>(key: string, value: T): void {
  const sym = Symbol.for(key);
  const store = (globalThis as Record<symbol, unknown>)[sym];
  if (!store || typeof store !== 'object') return;
  const s = store as { set?: (v: T) => void };
  if (typeof s.set === 'function') s.set(value);
}

/** Get the GameManager instance from the store. */
function getGM(): any {
  return readStore('terra:gameManagerStore');
}


/** Small async delay helper. */
function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Wrap an async action with try/catch, returning a PlayResult. */
async function safeAction(fn: () => Promise<PlayResult>): Promise<PlayResult> {
  try {
    return await fn();
  } catch (err: any) {
    return { ok: false, message: `Error: ${err?.message ?? String(err)}` };
  }
}


// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** Navigate to a screen by writing the currentScreen store. */
async function navigate(screen: string): Promise<PlayResult> {
  return safeAction(async () => {
    writeStore('terra:currentScreen', screen);
    await wait(300);
    const actual = readStore<string>('terra:currentScreen');
    if (actual === screen) {
      return { ok: true, message: `Navigated to ${screen}` };
    }
    return { ok: false, message: `Requested ${screen}, but current screen is ${actual}` };
  });
}

/** Get the current screen name. */
function getScreen(): string {
  return readStore<string>('terra:currentScreen') ?? 'unknown';
}

/** Get the list of available screens based on current state. */
function getAvailableScreens(): string[] {
  const always = ['hub', 'library', 'settings', 'profile', 'journal', 'leaderboards'];
  const screen = getScreen();
  const extras: string[] = [];

  const runState = readStore<any>('terra:activeRunState');
  if (runState) {
    extras.push('combat', 'dungeonMap', 'cardReward', 'retreatOrDelve');
  }

  return [...new Set([...always, ...extras])];
}

// ---------------------------------------------------------------------------
// Card Roguelite — Run Management
// ---------------------------------------------------------------------------

/** Start a new run by clicking the Start Run button. */
async function startRun(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="btn-start-run"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Start Run button not found' };
    btn.click();
    await wait(1500);
    return { ok: true, message: `Run started. Screen: ${getScreen()}` };
  });
}

/** Select a domain by clicking its card. */
async function selectDomain(domain: string): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="domain-card-${domain}"]`) as HTMLElement | null;
    if (!btn) return { ok: false, message: `Domain card '${domain}' not found` };
    btn.click();
    await wait(1000);
    return { ok: true, message: `Selected domain: ${domain}. Screen: ${getScreen()}` };
  });
}

/** Select an archetype by clicking its button. */
async function selectArchetype(archetype: string): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="archetype-${archetype}"]`) as HTMLElement | null;
    if (!btn) return { ok: false, message: `Archetype '${archetype}' not found` };
    btn.click();
    await wait(2000);
    return { ok: true, message: `Selected archetype: ${archetype}. Screen: ${getScreen()}` };
  });
}

// ---------------------------------------------------------------------------
// Card Roguelite — Combat
// ---------------------------------------------------------------------------

/** Get the current combat state. */
function getCombatState(): Record<string, unknown> | null {
  const turnState = readStore<any>('terra:activeTurnState');
  if (!turnState) return null;
  const runState = readStore<any>('terra:activeRunState');
  return {
    playerHp: turnState.playerHP,
    enemyHp: turnState.enemy?.health,
    enemyMaxHp: turnState.enemy?.maxHealth,
    enemyName: turnState.enemy?.name,
    enemyAction: turnState.enemy?.currentAction,
    handSize: turnState.deck?.hand?.length ?? 0,
    hand: (turnState.deck?.hand ?? []).map((c: any) => ({
      type: c.cardType,
      factQuestion: c.fact?.question,
      tier: c.tier,
    })),
    comboMultiplier: turnState.comboMultiplier,
    turn: turnState.turn,
    floor: runState?.currentFloor,
    segment: runState?.currentSegment,
    gold: runState?.currency,
  };
}

/** Play a card by clicking it in the hand. */
async function playCard(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="card-hand-${index}"]`) as HTMLElement | null;
    if (!btn) return { ok: false, message: `Card at index ${index} not found` };
    btn.click();
    await wait(800);
    return { ok: true, message: `Selected card ${index}. Screen: ${getScreen()}` };
  });
}

/** Quick Play a card at the given hand index (base damage, no quiz, 1 AP cost).
 *  Calls handlePlayCard with playMode='quick' — the same code path as a real quick play tap. */
async function quickPlayCard(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const { handlePlayCard, activeTurnState } = await import('../services/encounterBridge');
    const { get } = await import('svelte/store');
    const turnState = get(activeTurnState);
    if (!turnState) return { ok: false, message: 'No active turn state — are you in combat?' };

    const hand = turnState.deck?.hand;
    if (!Array.isArray(hand) || index < 0 || index >= hand.length) {
      return { ok: false, message: `Card index ${index} is out of range (hand size: ${hand?.length ?? 0})` };
    }

    const card = hand[index];
    if (!card) return { ok: false, message: `No card at index ${index}` };
    if ((card.apCost ?? 1) > (turnState.apCurrent ?? 0)) {
      return { ok: false, message: `Not enough AP to play card ${index} (needs ${card.apCost ?? 1}, have ${turnState.apCurrent ?? 0})` };
    }

    handlePlayCard(card.id, true, false, undefined, undefined, 'quick');
    await wait(600);
    return {
      ok: true,
      message: `Quick-played card ${index} (${card.cardType}, "${(card as any).fact?.question ?? card.id}")`,
      state: { cardId: card.id, cardType: card.cardType, playMode: 'quick' },
    };
  });
}

/** Charge a card and auto-answer the quiz (correct or incorrect based on parameter).
 *  Calls handlePlayCard with playMode='charge' — the same code path as a real charge play. */
async function chargePlayCard(index: number, answerCorrectly: boolean): Promise<PlayResult> {
  return safeAction(async () => {
    const { handlePlayCard, activeTurnState } = await import('../services/encounterBridge');
    const { get } = await import('svelte/store');
    const turnState = get(activeTurnState);
    if (!turnState) return { ok: false, message: 'No active turn state — are you in combat?' };

    const hand = turnState.deck?.hand;
    if (!Array.isArray(hand) || index < 0 || index >= hand.length) {
      return { ok: false, message: `Card index ${index} is out of range (hand size: ${hand?.length ?? 0})` };
    }

    const card = hand[index];
    if (!card) return { ok: false, message: `No card at index ${index}` };

    // Charge play costs +1 AP compared to quick play
    const chargeCost = (card.apCost ?? 1) + 1;
    if (chargeCost > (turnState.apCurrent ?? 0)) {
      return { ok: false, message: `Not enough AP to charge-play card ${index} (needs ${chargeCost}, have ${turnState.apCurrent ?? 0})` };
    }

    handlePlayCard(card.id, answerCorrectly, false, 1500, undefined, 'charge');
    await wait(800);
    return {
      ok: true,
      message: `Charge-played card ${index} (${card.cardType}) — answered ${answerCorrectly ? 'correctly' : 'incorrectly'}`,
      state: { cardId: card.id, cardType: card.cardType, playMode: 'charge', answerCorrectly },
    };
  });
}

/** End the current combat turn. */
async function endTurn(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="btn-end-turn"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'End Turn button not found' };
    btn.click();
    await wait(2000);
    return { ok: true, message: 'Turn ended' };
  });
}

// ---------------------------------------------------------------------------
// Card Roguelite — Room & Reward
// ---------------------------------------------------------------------------

/** Select a room choice door. */
async function selectRoom(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="room-choice-${index}"]`) as HTMLElement | null;
    if (!btn) return { ok: false, message: `Room choice ${index} not found` };
    btn.click();
    await wait(1500);
    return { ok: true, message: `Selected room ${index}. Screen: ${getScreen()}` };
  });
}

/** Accept a card reward (click the accept button). */
async function acceptReward(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="reward-accept"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Reward accept button not found' };
    btn.click();
    await wait(1000);
    return { ok: true, message: `Reward accepted. Screen: ${getScreen()}` };
  });
}

/** Select a card reward type option. */
async function selectRewardType(cardType: string): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="reward-type-${cardType}"]`) as HTMLElement | null;
    if (!btn) return { ok: false, message: `Reward type '${cardType}' not found` };
    btn.click();
    await wait(500);
    return { ok: true, message: `Selected reward type: ${cardType}` };
  });
}

/** Retreat at a checkpoint (cash out). */
async function retreat(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="btn-retreat"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Retreat button not found' };
    btn.click();
    await wait(2000);
    return { ok: true, message: `Retreated. Screen: ${getScreen()}` };
  });
}

/** Delve deeper at a checkpoint. */
async function delve(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="btn-delve"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Delve button not found' };
    btn.click();
    await wait(2000);
    return { ok: true, message: `Delving deeper. Screen: ${getScreen()}` };
  });
}

/** Get the current run state. */
function getRunState(): Record<string, unknown> | null {
  const runState = readStore<any>('terra:activeRunState');
  if (!runState) return null;
  return {
    floor: runState.currentFloor,
    segment: runState.currentSegment,
    currency: runState.currency,
    deckSize: runState.deck?.length,
    relics: runState.relics?.map((r: any) => r.id),
    playerHp: runState.playerHp,
    playerMaxHp: runState.playerMaxHp,
    encountersCompleted: runState.encountersCompleted,
  };
}

/** Click the heal option in a rest room. */
async function restHeal(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="rest-heal"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Rest heal button not found' };
    btn.click();
    await wait(1000);
    return { ok: true, message: 'Healed at rest room' };
  });
}

/** Click the upgrade option in a rest room. */
async function restUpgrade(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="rest-upgrade"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Rest upgrade button not found' };
    btn.click();
    await wait(1000);
    return { ok: true, message: 'Upgrading at rest room' };
  });
}

/** Continue past a mystery event. */
async function mysteryContinue(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="mystery-continue"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Mystery continue button not found' };
    btn.click();
    await wait(1000);
    return { ok: true, message: `Mystery resolved. Screen: ${getScreen()}` };
  });
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

/** Get the current active quiz data from the store. */
function getQuiz(): { question: string; choices: string[]; correctIndex: number; mode: string } | null {
  const quiz = readStore<any>('terra:activeQuiz');
  if (!quiz) return null;

  return {
    question: quiz.fact?.question ?? quiz.question ?? '',
    choices: Array.isArray(quiz.choices) ? quiz.choices : [],
    correctIndex: typeof quiz.correctIndex === 'number' ? quiz.correctIndex : -1,
    mode: quiz.mode ?? 'unknown',
  };
}

/** Answer a quiz by clicking the DOM button at the given choice index. */
async function answerQuiz(choiceIndex: number): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="quiz-answer-${choiceIndex}"]`) as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: `Quiz answer button ${choiceIndex} not found` };
    btn.click();
    await wait(1200);
    return { ok: true, message: `Answered choice ${choiceIndex}` };
  });
}

/** Answer the quiz correctly using the stored correct index. */
async function answerQuizCorrectly(): Promise<PlayResult> {
  const quiz = getQuiz();
  if (!quiz) return { ok: false, message: 'No active quiz' };
  if (quiz.correctIndex < 0) return { ok: false, message: 'Correct index unknown' };
  return answerQuiz(quiz.correctIndex);
}

/** Answer the quiz incorrectly by picking a wrong choice. */
async function answerQuizIncorrectly(): Promise<PlayResult> {
  const quiz = getQuiz();
  if (!quiz) return { ok: false, message: 'No active quiz' };
  if (quiz.correctIndex < 0) return { ok: false, message: 'Correct index unknown' };

  const wrongIndex = quiz.choices.findIndex((_: any, i: number) => i !== quiz.correctIndex);
  if (wrongIndex < 0) return { ok: false, message: 'Could not find wrong answer' };
  return answerQuiz(wrongIndex);
}

/** Force a quiz for a specific fact ID (for deterministic playtest targeting). */
async function forceQuizForFact(factId: string): Promise<PlayResult> {
  return safeAction(async () => {
    const save = getSave();
    if (!save) return { ok: false, message: 'No save data' };

    const fact = save.learnedFacts?.find((f: any) => f.id === factId);
    if (!fact) return { ok: false, message: `Fact '${factId}' not found in learnedFacts` };

    const { getQuizChoices } = await import('../services/quizService');
    const choices = getQuizChoices(fact);
    const correctIndex = choices.indexOf(fact.answer);

    const quiz = {
      fact,
      choices,
      correctIndex,
      mode: 'forced',
      quizType: 'random',
    };

    writeStore('terra:activeQuiz', quiz);
    await wait(300);
    return { ok: true, message: `Forced quiz for fact '${factId}': ${fact.question}`, state: { factId, question: fact.question } };
  });
}

// ---------------------------------------------------------------------------
// Study
// ---------------------------------------------------------------------------

/** Navigate to the study screen and optionally start a session. */
async function startStudy(size?: number): Promise<PlayResult> {
  return safeAction(async () => {
    writeStore('terra:currentScreen', 'study');
    await wait(500);

    if (size) {
      const sizeBtn = document.querySelector(`[data-testid="study-size-${size}"]`) as HTMLButtonElement | null;
      if (sizeBtn) {
        sizeBtn.click();
        await wait(500);
      }

      const startBtn = document.querySelector('[data-testid="btn-start-study"]') as HTMLButtonElement | null;
      if (startBtn) {
        startBtn.click();
        await wait(500);
      }
    }

    return { ok: true, message: `Study screen opened${size ? ` (size ${size})` : ''}` };
  });
}

/** Get the current study card from the DOM. */
function getStudyCard(): { question: string; answer: string | null; category: string | null } | null {
  const card = getStudyCardText();
  if (!card) return null;
  return {
    question: card.question,
    answer: card.answer,
    category: card.category,
  };
}

/** Grade a study card by clicking the rating button. */
async function gradeCard(button: 'again' | 'hard' | 'good' | 'easy'): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`.rating-btn--${button}`) as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: `Rating button '${button}' not found` };
    btn.click();
    await wait(800);
    return { ok: true, message: `Graded card as '${button}'` };
  });
}

/** End the study session by clicking the return button. */
async function endStudy(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn =
      (document.querySelector('[data-testid="btn-end-study"]') as HTMLButtonElement | null) ??
      (document.querySelector('.return-btn') as HTMLButtonElement | null) ??
      (document.querySelector('.back-link') as HTMLButtonElement | null);
    if (btn) {
      btn.click();
      await wait(500);
    } else {
      writeStore('terra:currentScreen', 'base');
      await wait(300);
    }
    return { ok: true, message: `Study ended. Screen: ${getScreen()}` };
  });
}

/** Get leech and suspended card details for playtest observability. */
function getLeechInfo(): { suspended: any[]; nearLeech: any[]; totalLeeches: number } {
  const save = getSave();
  if (!save) return { suspended: [], nearLeech: [], totalLeeches: 0 };

  const states: any[] = save.reviewStates ?? [];
  const suspended = states.filter((rs: any) => rs.cardState === 'suspended' || rs.isLeech);
  const nearLeech = states.filter((rs: any) => rs.lapseCount >= 6 && rs.cardState !== 'suspended');

  return {
    suspended: suspended.map((rs: any) => ({ factId: rs.factId, lapseCount: rs.lapseCount, ease: rs.easeFactor })),
    nearLeech: nearLeech.map((rs: any) => ({ factId: rs.factId, lapseCount: rs.lapseCount, ease: rs.easeFactor, cardState: rs.cardState })),
    totalLeeches: suspended.length,
  };
}

// ---------------------------------------------------------------------------
// Dome
// ---------------------------------------------------------------------------

/** Enter a specific dome room by navigating to it. */
async function enterRoom(roomId: string): Promise<PlayResult> {
  return safeAction(async () => {
    writeStore('terra:currentScreen', roomId);
    await wait(300);
    return { ok: true, message: `Entered room: ${roomId}`, state: { screen: getScreen() } };
  });
}

/** Exit the current room and return to base/dome. */
async function exitRoom(): Promise<PlayResult> {
  return safeAction(async () => {
    writeStore('terra:currentScreen', 'base');
    await wait(300);
    return { ok: true, message: 'Returned to base' };
  });
}

// ---------------------------------------------------------------------------
// Inventory / Economy
// ---------------------------------------------------------------------------

/** Get the current inventory from the store. */
function getInventory(): any[] {
  return readStore<any[]>('terra:inventory') ?? [];
}

/** Get the full player save state. */
function getSave(): any {
  return readStore<any>('terra:playerSave') ?? null;
}

/** Extract key stats from the save. */
function getStats(): Record<string, unknown> {
  const save = getSave();
  if (!save) return {};

  return {
    totalRunsCompleted: save.stats?.totalRunsCompleted ?? 0,
    totalEncountersWon: save.stats?.totalEncountersWon ?? 0,
    totalQuizCorrect: save.stats?.totalQuizCorrect ?? 0,
    totalQuizWrong: save.stats?.totalQuizWrong ?? 0,
    currentStreak: save.stats?.currentStreak ?? 0,
    bestStreak: save.stats?.bestStreak ?? 0,
    learnedFactCount: Array.isArray(save.learnedFacts) ? save.learnedFacts.length : 0,
    currency: save.minerals?.dust ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

/** Manipulate save timestamps to simulate time passing (for SM-2 testing). */
async function fastForward(hours: number): Promise<PlayResult> {
  return safeAction(async () => {
    const sym = Symbol.for('terra:playerSave');
    const store = (globalThis as Record<symbol, unknown>)[sym] as any;
    if (!store?.update) return { ok: false, message: 'playerSave store not found' };

    const msShift = hours * 60 * 60 * 1000;
    store.update((s: any) => {
      if (!s) return s;
      const updated = { ...s };

      // Shift review states' nextReview dates backward (simulating time passing)
      if (Array.isArray(updated.reviewStates)) {
        updated.reviewStates = updated.reviewStates.map((rs: any) => ({
          ...rs,
          nextReview: rs.nextReview ? rs.nextReview - msShift : rs.nextReview,
          lastReview: rs.lastReview ? rs.lastReview - msShift : rs.lastReview,
        }));
      }

      // Shift lastDiveTime backward
      if (updated.lastDiveTime) {
        updated.lastDiveTime -= msShift;
      }

      // Shift lastStreakDate backward
      if (updated.lastStreakDate) {
        updated.lastStreakDate = new Date(
          new Date(updated.lastStreakDate).getTime() - msShift
        ).toISOString().slice(0, 10);
      }

      // Shift study session timestamps backward
      if (Array.isArray(updated.lastStudySessionTimestamps)) {
        updated.lastStudySessionTimestamps = updated.lastStudySessionTimestamps.map(
          (t: number) => t - msShift
        );
      }

      return updated;
    });

    return { ok: true, message: `Fast-forwarded ${hours} hours` };
  });
}

/** Seed a dense review state fixture for 7-day drift testing. */
async function seedDriftFixture(factCount = 30, maxIntervalDays = 3): Promise<PlayResult> {
  return safeAction(async () => {
    const sym = Symbol.for('terra:playerSave');
    const store = (globalThis as Record<symbol, unknown>)[sym] as any;
    if (!store?.update) return { ok: false, message: 'playerSave store not found' };

    store.update((s: any) => {
      if (!s) return s;
      const updated = { ...s };
      const now = Date.now();
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      // Ensure we have enough learned facts
      if (!updated.learnedFacts || updated.learnedFacts.length < factCount) {
        return s; // Not enough facts to seed
      }

      // Set first N facts to short intervals with staggered due dates
      const states: any[] = [...(updated.reviewStates ?? [])];
      for (let i = 0; i < Math.min(factCount, updated.learnedFacts.length); i++) {
        const factId = updated.learnedFacts[i].id;
        const existingIdx = states.findIndex((rs: any) => rs.factId === factId);
        const interval = 1 + Math.floor(Math.random() * maxIntervalDays);
        const dueOffset = Math.floor(Math.random() * maxIntervalDays) * MS_PER_DAY;
        const rs = {
          factId,
          cardState: 'review' as const,
          easeFactor: 2.3 + Math.random() * 0.5,
          interval,
          repetitions: 2 + Math.floor(Math.random() * 3),
          nextReviewAt: now + dueOffset,
          lastReviewAt: now - interval * MS_PER_DAY,
          quality: 3,
          learningStep: 0,
          lapseCount: Math.floor(Math.random() * 3),
          isLeech: false,
        };
        if (existingIdx >= 0) {
          states[existingIdx] = rs;
        } else {
          states.push(rs);
        }
      }
      updated.reviewStates = states;
      return updated;
    });

    return { ok: true, message: `Seeded ${factCount} facts with intervals 1-${maxIntervalDays}d for drift testing` };
  });
}

/** Clear localStorage, inject a preset save, and reload. */
async function resetToPreset(presetId: string): Promise<PlayResult> {
  return safeAction(async () => {
    const mod = await import('./presets');
    const preset = mod.SCENARIO_PRESETS.find((p: any) => p.id === presetId);
    if (!preset) {
      const ids = mod.SCENARIO_PRESETS.map((p: any) => p.id);
      return { ok: false, message: `Unknown preset '${presetId}'. Available: ${ids.join(', ')}` };
    }

    const save = preset.buildSave(Date.now());
    localStorage.clear();
    localStorage.setItem('terra_save', JSON.stringify(save));
    localStorage.setItem('terra_onboarding_complete', 'true');
    // Ensure onboarding state marks runs as completed so explorer mode doesn't get stuck
    localStorage.setItem('card:onboardingState', JSON.stringify({
      hasCompletedOnboarding: true,
      hasSeenCardTapTooltip: true,
      hasSeenCastTooltip: true,
      hasSeenAnswerTooltip: true,
      hasSeenEndTurnTooltip: true,
      hasSeenAPTooltip: true,
      runsCompleted: 3,
    }));
    localStorage.setItem('card:difficultyMode', JSON.stringify('standard'));

    window.location.href = `${window.location.origin}?skipOnboarding=true`;
    return { ok: true, message: `Reset to preset '${presetId}'. Reloading...` };
  });
}

/** Get the last N entries from the __terraLog ring buffer. */
function getRecentEvents(n?: number): Array<{ ts: number; type: string; detail: string }> {
  const log = (window as any).__terraLog as Array<{ ts: number; type: string; detail: string }> | undefined;
  if (!Array.isArray(log)) return [];
  return log.slice(-(n ?? 20));
}

/** Aggregate __terraLog into a summary stats object. */
function getSessionSummary(): Record<string, unknown> {
  const log = (window as any).__terraLog as Array<{ ts: number; type: string; detail: string }> | undefined;
  if (!Array.isArray(log) || log.length === 0) {
    return { eventCount: 0 };
  }

  const typeCounts: Record<string, number> = {};
  for (const entry of log) {
    typeCounts[entry.type] = (typeCounts[entry.type] ?? 0) + 1;
  }

  const first = log[0];
  const last = log[log.length - 1];
  const durationMs = last.ts - first.ts;

  return {
    eventCount: log.length,
    typeCounts,
    durationMs,
    durationMin: Math.round(durationMs / 60_000 * 10) / 10,
    firstEvent: first.type,
    lastEvent: last.type,
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/** Initialize the playtest API on window.__terraPlay. Dev mode only. */
export function initPlaytestAPI(): void {
  if (!import.meta.env.DEV && !new URLSearchParams(window.location.search).has('playtest')) return;

  const api = {
    // Navigation
    navigate,
    getScreen,
    getAvailableScreens,
    // Card Roguelite — Run
    startRun,
    selectDomain,
    selectArchetype,
    // Card Roguelite — Combat
    getCombatState,
    playCard,
    quickPlayCard,
    chargePlayCard,
    endTurn,
    // Card Roguelite — Room & Reward
    selectRoom,
    acceptReward,
    selectRewardType,
    retreat,
    delve,
    getRunState,
    restHeal,
    restUpgrade,
    mysteryContinue,
    // Quiz
    getQuiz,
    answerQuiz,
    answerQuizCorrectly,
    answerQuizIncorrectly,
    forceQuizForFact,
    // Study
    startStudy,
    getStudyCard,
    gradeCard,
    endStudy,
    getLeechInfo,
    // Dome (legacy but still functional)
    enterRoom,
    exitRoom,
    // Inventory / Economy
    getInventory,
    getSave,
    getStats,
    // Meta
    fastForward,
    seedDriftFixture,
    resetToPreset,
    getRecentEvents,
    getSessionSummary,
    // Perception (from playtestDescriber)
    look,
    getAllText,
    getQuizText,
    getStudyCardText,
    getHUDText,
    getNotifications,
    validateScreen,
  };

  (window as any).__terraPlay = api;
}
