/**
 * Playtest gameplay API — registers window.__terraPlay in dev mode.
 * Lets AI models play Recall Rogue programmatically via action and perception methods.
 * DEV MODE ONLY — never included in production builds.
 */

import {
  look, getAllText, getQuizText, getStudyCardText, getHUDText,
  getNotifications, validateScreen,
} from './playtestDescriber'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayResult {
  ok: boolean;
  message: string;
  state?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Store helpers
// ---------------------------------------------------------------------------

/** Read a Svelte store value from globalThis Symbol singletons. */
function readStore<T>(key: string): T | undefined {
  const sym = Symbol.for(key);
  const store = (globalThis as Record<symbol, unknown>)[sym];
  if (!store || typeof store !== 'object') return undefined;
  const s = store as { subscribe?: (cb: (v: unknown) => void) => () => void };
  if (typeof s.subscribe !== 'function') return undefined;
  let v: T | undefined;
  s.subscribe((x: unknown) => { v = x as T; })();
  return v;
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

/** Get the active MineScene from Phaser, or null. */
function getMineScene(): any {
  const gm = getGM();
  const game = gm?.game;
  if (!game?.scene?.getScene) return null;
  const scene = game.scene.getScene('MineScene');
  return scene ?? null;
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

/** Compute target grid coordinates from player position + direction. */
function computeTarget(scene: any, dir: string): { x: number; y: number } | null {
  const px = scene.player?.gridX;
  const py = scene.player?.gridY;
  if (px == null || py == null) return null;
  switch (dir) {
    case 'up':    return { x: px, y: py - 1 };
    case 'down':  return { x: px, y: py + 1 };
    case 'left':  return { x: px - 1, y: py };
    case 'right': return { x: px + 1, y: py };
    default: return null;
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
  const always = ['base', 'inventory', 'knowledgeTree', 'settings', 'study'];
  const screen = getScreen();
  const extras: string[] = [];

  if (screen === 'mine' || screen === 'mineActive') {
    extras.push('mine');
  }

  const save = readStore<any>('terra:playerSave');
  if (save?.unlockedRooms?.length > 0) {
    extras.push('dome');
  }

  const diveResults = readStore<any>('terra:diveResults');
  if (diveResults) {
    extras.push('diveResults');
  }

  extras.push('divePrepScreen');
  extras.push('artifactLab');

  return [...new Set([...always, ...extras])];
}

// ---------------------------------------------------------------------------
// Mining
// ---------------------------------------------------------------------------

/** Mine or move in a cardinal direction. */
async function mineBlock(direction: 'up' | 'down' | 'left' | 'right'): Promise<PlayResult> {
  return safeAction(async () => {
    const scene = getMineScene();
    if (!scene) return { ok: false, message: 'MineScene not active' };

    const target = computeTarget(scene, direction);
    if (!target) return { ok: false, message: `Invalid direction: ${direction}` };

    const mod = await import('../game/scenes/MineBlockInteractor');
    mod.handleMoveOrMine(scene, target.x, target.y);
    await wait(400);

    const o2 = readStore<number>('terra:oxygenCurrent');
    const depth = readStore<number>('terra:currentDepth');
    return {
      ok: true,
      message: `Moved/mined ${direction}`,
      state: {
        playerX: scene.player?.gridX,
        playerY: scene.player?.gridY,
        o2,
        depth,
      },
    };
  });
}

/** Mine or move to specific grid coordinates. */
async function mineAt(x: number, y: number): Promise<PlayResult> {
  return safeAction(async () => {
    const scene = getMineScene();
    if (!scene) return { ok: false, message: 'MineScene not active' };

    const mod = await import('../game/scenes/MineBlockInteractor');
    mod.handleMoveOrMine(scene, x, y);
    await wait(400);

    const o2 = readStore<number>('terra:oxygenCurrent');
    return {
      ok: true,
      message: `Moved/mined to (${x}, ${y})`,
      state: {
        playerX: scene.player?.gridX,
        playerY: scene.player?.gridY,
        o2,
      },
    };
  });
}

/** Start a new dive with the given number of oxygen tanks. */
async function startDive(tanks?: number): Promise<PlayResult> {
  return safeAction(async () => {
    const gm = getGM();
    if (!gm) return { ok: false, message: 'GameManager not available' };
    if (typeof gm.startDive !== 'function') return { ok: false, message: 'startDive not found on GameManager' };

    gm.startDive(tanks ?? 1);
    await wait(1500);

    const screen = getScreen();
    return {
      ok: true,
      message: `Dive started with ${tanks ?? 1} tank(s). Screen: ${screen}`,
      state: { screen },
    };
  });
}

/** End the current dive — navigate to diveResults or base. */
async function endDive(): Promise<PlayResult> {
  return safeAction(async () => {
    const gm = getGM();
    if (gm && typeof gm.endDive === 'function') {
      gm.endDive();
      await wait(800);
    }

    const diveResults = readStore<any>('terra:diveResults');
    if (diveResults) {
      writeStore('terra:currentScreen', 'diveResults');
    } else {
      writeStore('terra:currentScreen', 'base');
    }
    await wait(300);

    return { ok: true, message: `Dive ended. Screen: ${getScreen()}` };
  });
}

/** Trigger bomb consumable usage in the mine. */
async function useBomb(): Promise<PlayResult> {
  return safeAction(async () => {
    const gm = getGM();
    if (!gm) return { ok: false, message: 'GameManager not available' };
    if (typeof gm.useBomb !== 'function') return { ok: false, message: 'useBomb not found on GameManager' };

    gm.useBomb();
    await wait(600);
    return { ok: true, message: 'Bomb used' };
  });
}

/** Check scanner upgrade tier on the active mine scene. */
function useScanner(): PlayResult {
  const scene = getMineScene();
  if (!scene) return { ok: false, message: 'MineScene not active' };

  const tier = scene.scannerTierIndex ?? 0;
  const hasScanner = scene.activeUpgrades?.has?.('scanner_boost');
  return {
    ok: true,
    message: hasScanner ? `Scanner active (tier ${tier})` : 'No scanner upgrade active',
    state: { scannerTier: tier, active: !!hasScanner },
  };
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
    dust: save.minerals?.dust ?? 0,
    shard: save.minerals?.shard ?? 0,
    crystal: save.minerals?.crystal ?? 0,
    geode: save.minerals?.geode ?? 0,
    essence: save.minerals?.essence ?? 0,
    oxygen: save.oxygen ?? 0,
    totalDives: save.totalDives ?? 0,
    deepestLayer: save.deepestLayerReached ?? 0,
    streakDays: save.streakDays ?? 0,
    learnedFactCount: Array.isArray(save.learnedFacts) ? save.learnedFacts.length : 0,
    unlockedRooms: save.unlockedRooms ?? [],
    pickaxeTier: save.pickaxeTier ?? 0,
    companions: save.companions?.length ?? 0,
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
    // Mining
    mineBlock,
    mineAt,
    startDive,
    endDive,
    useBomb,
    useScanner,
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
    // Dome
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
