/**
 * Playtest perception system — text descriptions of game state.
 * Used by window.__rrPlay.look() and related methods.
 * Lets cheap AI models "see" the game without screenshots.
 * DEV MODE ONLY — never included in production builds.
 */

import { readStore } from './storeBridge'
import { factsDB } from '../services/factsDB'
import { RELIC_BY_ID } from '../data/relics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AllTextResult {
  screen: string;
  byTestId: Record<string, string>;
  byClass: Record<string, string>;
  raw: string[];
}

export interface QuizTextResult {
  question: string;
  choices: string[];
  gaiaReaction: string | null;
  memoryTip: string | null;
  resultText: string | null;
  consistencyWarning: string | null;
}

export interface StudyCardTextResult {
  question: string;
  answer: string | null;
  explanation: string | null;
  mnemonic: string | null;
  gaiaComment: string | null;
  progress: string | null;
  category: string | null;
}

export interface HUDTextResult {
  hp: string | null;
  currency: string | null;
  floor: string | null;
  streak: string | null;
  combo: string | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get trimmed textContent from a CSS selector, or null. */
function textOf(selector: string): string | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return null;
  return el.textContent?.trim() || null;
}

/** Get trimmed textContent from a data-testid, or null. */
function testIdText(id: string): string | null {
  return textOf(`[data-testid="${id}"]`);
}

/** Get the last N entries from the __rrLog ring buffer. */
function recentEvents(n: number): string[] {
  const log = (window as unknown as Record<string, unknown>).__rrLog as
    Array<{ ts: number; type: string; detail: string }> | undefined;
  if (!Array.isArray(log)) return [];
  return log.slice(-n).map(e => `[${e.type}] ${e.detail}`);
}

/** Collect all visible data-testid button/anchor labels as available actions. */
function collectActions(): string[] {
  const actions: string[] = [];
  document.querySelectorAll('[data-testid]').forEach(el => {
    const htmlEl = el as HTMLElement;
    const tag = htmlEl.tagName.toLowerCase();
    if (tag !== 'button' && tag !== 'a' && !htmlEl.getAttribute('role')?.includes('button')) return;
    const style = getComputedStyle(htmlEl);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    if ((htmlEl as HTMLButtonElement).disabled) return;
    const label = htmlEl.textContent?.trim() ?? htmlEl.getAttribute('data-testid') ?? '';
    if (label) actions.push(label);
  });
  return actions;
}


// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Returns a formatted text description of the current game screen.
 * Covers all major screens with meaningful context for AI decision-making.
 */
export function look(): string {
  const screen = readStore<string>('terra:currentScreen') ?? 'unknown';
  const lines: string[] = [];

  const hud = getHUDText();
  const events = recentEvents(5);
  const actions = collectActions();

  switch (screen) {
    case 'hub':
    case 'base': {
      const save = readStore<Record<string, unknown>>('terra:playerSave') as Record<string, unknown> | undefined;
      const currency = (save as any)?.minerals?.dust ?? '?';
      const streak = (save as any)?.stats?.currentStreak ?? 0;
      const runsCompleted = (save as any)?.stats?.totalRunsCompleted ?? 0;
      lines.push('SCREEN: hub');
      lines.push(`CURRENCY: ${currency}  STREAK: ${streak} days  RUNS: ${runsCompleted}`);
      lines.push('');
      break;
    }

    case 'domainSelection': {
      lines.push('SCREEN: domainSelection');
      lines.push('Select your primary knowledge domain for this run.');
      lines.push('');
      break;
    }

    case 'archetypeSelection': {
      lines.push('SCREEN: archetypeSelection');
      lines.push('Choose your combat archetype: Balanced, Aggressive, Defensive, Control, or Hybrid.');
      lines.push('');
      break;
    }

    case 'combat': {
      const turnState = readStore<any>('terra:activeTurnState');
      const runState = readStore<any>('terra:activeRunState');
      const playerHp = turnState?.playerHP ?? '?';
      const playerMaxHp = turnState?.playerState?.maxHP ?? '?';
      const playerBlock = turnState?.playerState?.shield ?? 0;
      const ap = turnState?.apCurrent ?? '?';
      const apMax = turnState?.apMax ?? '?';
      const enemy = turnState?.enemy;
      const enemyHp = enemy?.currentHP ?? enemy?.health ?? '?';
      const enemyMaxHp = enemy?.maxHP ?? enemy?.maxHealth ?? '?';
      const enemyName = enemy?.template?.name ?? enemy?.name ?? 'Unknown';
      const enemyBlock = enemy?.block ?? 0;
      const turn = turnState?.turn ?? '?';
      const floor = runState?.currentFloor ?? '?';
      const handSize = turnState?.deck?.hand?.length ?? 0;

      lines.push(`SCREEN: combat (Floor ${floor}, Turn ${turn})`);
      lines.push(`PLAYER: ${playerHp}/${playerMaxHp} HP${playerBlock > 0 ? `, ${playerBlock} Block` : ''}  AP: ${ap}/${apMax}`);

      // Player status effects
      const playerStatuses = turnState?.playerState?.statusEffects ?? [];
      if (playerStatuses.length > 0) {
        const statusStr = playerStatuses.map((s: any) => `${s.type}(${s.value}, ${s.turnsRemaining}t)`).join(', ');
        lines.push(`  Buffs/Debuffs: ${statusStr}`);
      }

      lines.push(`ENEMY: ${enemyName} — ${enemyHp}/${enemyMaxHp} HP${enemyBlock > 0 ? `, ${enemyBlock} Block` : ''}`);

      // Enemy intent
      if (enemy?.nextIntent) {
        const intent = enemy.nextIntent;
        const hitStr = intent.hitCount && intent.hitCount > 1 ? ` x${intent.hitCount}` : '';
        lines.push(`  Intent: ${intent.telegraph ?? intent.type} (${intent.type} ${intent.value}${hitStr})`);
      }

      // Enemy status effects
      const enemyStatuses = enemy?.statusEffects ?? [];
      if (enemyStatuses.length > 0) {
        const statusStr = enemyStatuses.map((s: any) => `${s.type}(${s.value}, ${s.turnsRemaining}t)`).join(', ');
        lines.push(`  Statuses: ${statusStr}`);
      }

      lines.push(`HAND: ${handSize} cards`);
      lines.push('');

      if (turnState?.deck?.hand) {
        lines.push('HAND:');
        (turnState.deck.hand as any[]).forEach((c: any, i: number) => {
          const fact = c.factId && factsDB.isReady() ? factsDB.getById(c.factId) : null;
          const q = fact?.quizQuestion?.slice(0, 60) ?? 'no fact';
          const mechLabel = c.mechanicName ?? c.cardType ?? '?';
          const apCost = c.apCost ?? 1;
          const domain = c.domain ?? '';
          const extras: string[] = [];
          if (c.isLocked) extras.push('LOCKED');
          if (c.isCursed) extras.push('CURSED');
          if (c.isUpgraded) extras.push('UP');
          const extrasStr = extras.length > 0 ? ` [${extras.join(',')}]` : '';
          lines.push(`  [${i}] ${mechLabel} (${domain}, ${apCost}AP)${extrasStr} — ${q}`);
        });
        lines.push('');
      }
      break;
    }

    case 'cardReward': {
      lines.push('SCREEN: cardReward');
      lines.push('Choose a card type to add to your deck.');
      // Read reward type buttons from DOM
      const rewardBtns = document.querySelectorAll('[data-testid^="reward-type-"]');
      if (rewardBtns.length > 0) {
        lines.push('REWARD TYPES:');
        rewardBtns.forEach((el) => {
          const htmlEl = el as HTMLButtonElement;
          const testId = htmlEl.getAttribute('data-testid') ?? '';
          const typeName = testId.replace('reward-type-', '');
          const disabled = htmlEl.disabled ? ' [DISABLED]' : '';
          lines.push(`  ${typeName}${disabled}`);
        });
      }
      // Check for reroll button
      const rerollBtn = document.querySelector('[data-testid="reward-reroll"]') as HTMLButtonElement | null;
      if (rerollBtn) {
        lines.push(`REROLL: ${rerollBtn.disabled ? 'DISABLED' : 'available'}`);
      }
      lines.push('');
      break;
    }

    case 'dungeonMap': {
      const rooms = readStore<any>('terra:activeRoomOptions');
      lines.push('SCREEN: dungeonMap');
      if (Array.isArray(rooms)) {
        lines.push('DOORS:');
        rooms.forEach((r: any, i: number) => {
          lines.push(`  [${i}] ${r.type ?? r.roomType ?? 'combat'}`);
        });
      }
      lines.push('');
      break;
    }

    case 'retreatOrDelve': {
      const runState = readStore<any>('terra:activeRunState');
      const currency = runState?.currency ?? '?';
      const segment = runState?.currentSegment ?? '?';
      const hp = runState?.playerHp ?? '?';
      lines.push(`SCREEN: retreatOrDelve (Segment ${segment})`);
      lines.push(`CURRENCY: ${currency}  HP: ${hp}`);
      lines.push('Retreat to keep rewards, or delve deeper for greater risk/reward.');
      lines.push('');
      break;
    }

    case 'shopRoom': {
      const runState = readStore<any>('terra:activeRunState');
      const gold = runState?.currency ?? '?';
      lines.push('SCREEN: shopRoom');
      lines.push(`GOLD: ${gold}`);

      // Read shop items from DOM
      const relicEls = document.querySelectorAll('[data-testid^="shop-relic-"]');
      if (relicEls.length > 0) {
        lines.push('RELICS:');
        relicEls.forEach((el, i) => {
          const text = (el as HTMLElement).textContent?.trim() ?? '';
          const sold = (el as HTMLButtonElement).disabled ? ' [SOLD/UNAVAILABLE]' : '';
          lines.push(`  [${i}] ${text}${sold}`);
        });
      }

      const cardEls = document.querySelectorAll('[data-testid^="shop-card-"]');
      if (cardEls.length > 0) {
        lines.push('CARDS:');
        cardEls.forEach((el, i) => {
          const text = (el as HTMLElement).textContent?.trim() ?? '';
          const sold = (el as HTMLButtonElement).disabled ? ' [SOLD/UNAVAILABLE]' : '';
          lines.push(`  [${i}] ${text}${sold}`);
        });
      }

      lines.push('');
      break;
    }

    case 'restRoom': {
      lines.push('SCREEN: restRoom');
      const healBtn = document.querySelector('[data-testid="rest-heal"]') as HTMLButtonElement | null;
      const upgradeBtn = document.querySelector('[data-testid="rest-upgrade"]') as HTMLButtonElement | null;
      const meditateBtn = document.querySelector('[data-testid="rest-meditate"]') as HTMLButtonElement | null;
      lines.push('OPTIONS:');
      if (healBtn) lines.push(`  Heal: ${healBtn.disabled ? 'DISABLED' : 'available'} — ${healBtn.textContent?.trim() ?? ''}`);
      if (upgradeBtn) lines.push(`  Upgrade: ${upgradeBtn.disabled ? 'DISABLED' : 'available'} — ${upgradeBtn.textContent?.trim() ?? ''}`);
      if (meditateBtn) lines.push(`  Meditate: ${meditateBtn.disabled ? 'DISABLED' : 'available'} — ${meditateBtn.textContent?.trim() ?? ''}`);
      if (!healBtn && !upgradeBtn && !meditateBtn) lines.push('  Choose to heal HP or upgrade a card.');
      lines.push('');
      break;
    }

    case 'mysteryEvent': {
      const event = readStore<any>('terra:activeMysteryEvent');
      lines.push('SCREEN: mysteryEvent');
      if (event) {
        lines.push(`EVENT: ${event.title ?? event.id ?? 'Unknown'}`);
        lines.push(`DESC: ${event.description ?? ''}`);
      }
      // Read choice buttons from DOM
      const choiceBtns: HTMLElement[] = [];
      for (let i = 0; i < 5; i++) {
        const btn = document.querySelector(`[data-testid="mystery-choice-${i}"]`) as HTMLElement | null;
        if (!btn) break;
        choiceBtns.push(btn);
      }
      if (choiceBtns.length > 0) {
        lines.push('CHOICES:');
        choiceBtns.forEach((btn, i) => {
          lines.push(`  [${i}] ${btn.textContent?.trim() ?? ''}`);
        });
      }
      lines.push('');
      break;
    }

    case 'masteryChallenge': {
      lines.push('SCREEN: masteryChallenge');
      lines.push('Timed quiz challenge for relic bonus.');
      lines.push('');
      break;
    }

    case 'runEnd': {
      const runState = readStore<any>('terra:activeRunState');
      lines.push('SCREEN: runEnd');
      if (runState) {
        lines.push(`FLOOR REACHED: ${runState.currentFloor ?? '?'}`);
        lines.push(`CURRENCY EARNED: ${runState.currency ?? '?'}`);
        lines.push(`ENCOUNTERS WON: ${runState.encountersCompleted ?? '?'}`);
      }
      lines.push('');
      break;
    }

    case 'library': {
      lines.push('SCREEN: library (Knowledge Library)');
      lines.push('Browse cards, build decks, study modes.');
      lines.push('');
      break;
    }

    case 'settings': {
      lines.push('SCREEN: settings');
      lines.push('');
      break;
    }

    case 'profile': {
      lines.push('SCREEN: profile');
      lines.push('');
      break;
    }

    case 'study':
    case 'studySession': {
      const studyCard = getStudyCardText();
      const progress = studyCard?.progress ?? testIdText('study-progress') ?? '?';
      lines.push(`SCREEN: study (${progress})`);
      lines.push('');
      if (studyCard) {
        lines.push('CURRENT CARD:');
        lines.push(`  Front: ${studyCard.question}`);
        if (studyCard.category) lines.push(`  Category: ${studyCard.category}`);
        if (studyCard.answer) lines.push(`  Answer: ${studyCard.answer}`);
        if (studyCard.explanation) lines.push(`  Explanation: ${studyCard.explanation}`);
      }
      lines.push('');
      break;
    }

    case 'quizOverlay': {
      const quiz = getQuizText();
      lines.push('SCREEN: quiz');
      if (quiz) {
        lines.push(`QUESTION: ${quiz.question}`);
        lines.push('CHOICES:');
        quiz.choices.forEach((c, i) => lines.push(`  [${i}] ${c}`));
        if (quiz.gaiaReaction) lines.push(`Keeper: ${quiz.gaiaReaction}`);
        if (quiz.resultText) lines.push(`RESULT: ${quiz.resultText}`);
      }
      lines.push('');
      break;
    }

    default: {
      lines.push(`SCREEN: ${screen}`);
      lines.push('');
      break;
    }
  }

  // Common tail for all screens
  if (actions.length > 0) {
    lines.push('AVAILABLE ACTIONS:');
    actions.forEach(a => lines.push(`  - ${a}`));
    lines.push('');
  }

  if (events.length > 0) {
    lines.push('RECENT EVENTS:');
    events.forEach(e => lines.push(`  - ${e}`));
  }

  return lines.join('\n');
}

/**
 * Walk the visible DOM and extract all text content, organized by
 * data-testid, key CSS classes, and raw text nodes.
 */
export function getAllText(): AllTextResult {
  const screen = readStore<string>('terra:currentScreen') ?? 'unknown';
  const byTestId: Record<string, string> = {};
  const byClass: Record<string, string> = {};
  const raw: string[] = [];

  // Scan data-testid elements
  document.querySelectorAll('[data-testid]').forEach(el => {
    const htmlEl = el as HTMLElement;
    const style = getComputedStyle(htmlEl);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const text = htmlEl.textContent?.trim() ?? '';
    if (text) {
      byTestId[htmlEl.getAttribute('data-testid')!] = text;
      raw.push(text);
    }
  });

  // Scan key CSS classes for important text
  const KEY_CLASSES = [
    '.question', '.card-question', '.card-answer', '.choice-text',
    '.bubble-text', '.gaia-text', '.result-text', '.consistency-penalty-warning',
    '.memory-tip-text', '.detail-explanation', '.detail-mnemonic', '.detail-gaia',
    '.progress-label', '.event-label', '.score-correct', '.score-total',
    '.gate-progress', '.layer-entrance-header', '.artifact-appraisal-header',
    '.pop-quiz-header', '.summary-message', '.selector-title',
  ];

  KEY_CLASSES.forEach(cls => {
    const el = document.querySelector(cls) as HTMLElement | null;
    if (!el) return;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const text = el.textContent?.trim() ?? '';
    if (text) byClass[cls] = text;
  });

  return { screen, byTestId, byClass, raw };
}

/**
 * Returns all quiz text if a quiz is currently visible, or null.
 */
export function getQuizText(): QuizTextResult | null {
  const question = testIdText('quiz-question');
  if (!question) return null;

  const choices: string[] = [];
  for (let i = 0; i < 3; i++) {
    choices.push(testIdText(`quiz-answer-${i}`) ?? '');
  }

  return {
    question,
    choices,
    gaiaReaction: testIdText('gaia-reaction-text'),
    memoryTip: testIdText('quiz-memory-tip'),
    resultText: testIdText('quiz-result-text'),
    consistencyWarning: testIdText('quiz-consistency-warning'),
  };
}

/**
 * Returns study card text if a study session is active, or null.
 */
export function getStudyCardText(): StudyCardTextResult | null {
  const question = testIdText('study-card-question');
  if (!question) return null;

  return {
    question,
    answer: testIdText('study-card-answer'),
    explanation: testIdText('study-explanation'),
    mnemonic: testIdText('study-mnemonic'),
    gaiaComment: testIdText('study-gaia-comment'),
    progress: testIdText('study-progress'),
    category: textOf('.top-category'),
  };
}

/**
 * Returns HUD values from DOM elements and stores.
 */
export function getHUDText(): HUDTextResult {
  return {
    hp: testIdText('hud-hp') ?? null,
    currency: testIdText('hud-currency') ?? null,
    floor: testIdText('hud-floor') ?? null,
    streak: testIdText('hud-streak') ?? null,
    combo: testIdText('combo-counter') ?? null,
  };
}

/**
 * Returns all visible toast/notification text.
 */
export function getNotifications(): string[] {
  const results: string[] = [];

  const selectors = [
    '[data-testid="gaia-bubble-text"]',
    '[data-testid="gaia-toast-text"]',
    '.event-label',
    '[role="status"]',
    '[role="alert"]',
    '.toast-message',
    '.notification-text',
  ];

  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const htmlEl = el as HTMLElement;
      const style = getComputedStyle(htmlEl);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const text = htmlEl.textContent?.trim();
      if (text) results.push(text);
    });
  });

  return results;
}

/**
 * Sanity-check the current screen for anomalies (bad text values,
 * missing quiz choices, empty card questions, etc.).
 */
export function validateScreen(): ValidationResult {
  const issues: string[] = [];
  const allText = getAllText();

  // Check for bad text values in data-testid elements
  const BAD_PATTERNS = ['undefined', 'null', 'NaN', '[object Object]'];
  for (const [key, text] of Object.entries(allText.byTestId)) {
    for (const bad of BAD_PATTERNS) {
      if (text === bad || text.includes(bad)) {
        issues.push(`Bad text in [data-testid="${key}"]: "${text}"`);
      }
    }
  }

  // Check for bad text in key CSS classes
  for (const [cls, text] of Object.entries(allText.byClass)) {
    for (const bad of BAD_PATTERNS) {
      if (text === bad || text.includes(bad)) {
        issues.push(`Bad text in ${cls}: "${text}"`);
      }
    }
  }

  // Quiz-specific checks
  const quiz = getQuizText();
  if (quiz) {
    if (!quiz.question) issues.push('Quiz question is empty');
    if (quiz.choices.length !== 3) {
      issues.push(`Expected 3 quiz choices, got ${quiz.choices.length}`);
    }
    const nonEmpty = quiz.choices.filter(c => c.length > 0);
    if (nonEmpty.length !== 3) {
      issues.push(`${3 - nonEmpty.length} quiz choice(s) are empty`);
    }
    const unique = new Set(quiz.choices);
    if (unique.size !== quiz.choices.length) {
      issues.push('Duplicate quiz choices detected');
    }
  }

  // Study-specific checks
  const study = getStudyCardText();
  if (study) {
    if (!study.question) issues.push('Study card question is empty');
  }

  // Check interactive elements for anomalies via __rrDebug
  try {
    const debugFn = (window as unknown as Record<string, unknown>).__rrDebug as
      (() => { interactiveElements?: Array<{ testId: string; visible: boolean; occluded: boolean }> }) | undefined;
    if (typeof debugFn === 'function') {
      const snap = debugFn();
      const visibleButOccluded = (snap.interactiveElements ?? [])
        .filter(e => e.visible && e.occluded);
      if (visibleButOccluded.length > 0) {
        issues.push(
          `Occluded interactive elements: ${visibleButOccluded.map(e => e.testId).join(', ')}`
        );
      }
    }
  } catch {
    // debug bridge may not be initialized
  }

  return { valid: issues.length === 0, issues };
}
