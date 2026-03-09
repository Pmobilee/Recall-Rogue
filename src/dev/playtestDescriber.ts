/**
 * Playtest perception system — text descriptions of game state.
 * Used by window.__terraPlay.look() and related methods.
 * Lets cheap AI models "see" the game without screenshots.
 * DEV MODE ONLY — never included in production builds.
 */

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
  o2: string | null;
  dust: string | null;
  layer: string | null;
  streak: string | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

// ---------------------------------------------------------------------------
// Helpers
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

/** Get the last N entries from the __terraLog ring buffer. */
function recentEvents(n: number): string[] {
  const log = (window as unknown as Record<string, unknown>).__terraLog as
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

/** Try to access the Phaser CombatScene for grid data. */
function getCombatScene(): {
  grid: Array<Array<{ type: string }>> | null;
  playerX: number;
  playerY: number;
} | null {
  try {
    const game = (globalThis as Record<string, unknown>).__phaserGame as {
      scene?: { getScene?: (key: string) => unknown };
    } | undefined;
    if (!game?.scene?.getScene) return null;
    const scene = game.scene.getScene('CombatScene') as {
      grid?: Array<Array<{ type: string }>>;
      player?: { gridX: number; gridY: number };
    } | null;
    if (!scene?.grid || !scene.player) return null;
    return { grid: scene.grid, playerX: scene.player.gridX, playerY: scene.player.gridY };
  } catch {
    return null;
  }
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
    case 'combat':
    case 'combatActive': {
      const o2 = readStore<number>('terra:oxygenCurrent');
      const save = readStore<Record<string, unknown>>('terra:playerSave') as Record<string, unknown> | undefined;
      const dust = (save?.dust as number) ?? '?';
      const layer = (save?.currentLayer as number) ?? '?';
      const depth = (save?.currentDepth as number) ?? '?';

      lines.push(`SCREEN: combat (layer ${layer}, depth ${depth})`);
      lines.push(`O2: ${o2 ?? '?'}  DUST: ${dust}`);
      lines.push('');

      const ms = getCombatScene();
      if (ms?.grid) {
        const { grid, playerX, playerY } = ms;
        const radius = 2;
        lines.push('VISIBLE GRID (5x5 around player):');
        for (let dy = -radius; dy <= radius; dy++) {
          const row: string[] = [];
          for (let dx = -radius; dx <= radius; dx++) {
            const gy = playerY + dy;
            const gx = playerX + dx;
            if (dx === 0 && dy === 0) {
              row.push('[YOU]');
            } else if (gy >= 0 && gy < grid.length && gx >= 0 && gx < (grid[0]?.length ?? 0)) {
              row.push(`[${grid[gy][gx].type}]`);
            } else {
              row.push('[---]');
            }
          }
          lines.push('  ' + row.join(' '));
        }
        lines.push('');
      } else {
        lines.push('GRID: (not accessible — Phaser scene not reachable)');
        lines.push('');
      }

      break;
    }

    case 'base': {
      const save = readStore<Record<string, unknown>>('terra:playerSave') as Record<string, unknown> | undefined;
      const dust = (save?.dust as number) ?? '?';
      const streak = (save?.streakDays as number) ?? '?';
      lines.push('SCREEN: base (Hub)');
      lines.push(`O2: ${hud.o2 ?? '?'}  DUST: ${dust}  STREAK: ${streak} days`);
      lines.push('');

      const notifications: string[] = [];
      const reviewsDue = testIdText('reviews-due-badge');
      if (reviewsDue) notifications.push(`Reviews due: ${reviewsDue}`);
      const pendingArtifacts = testIdText('pending-artifacts-badge');
      if (pendingArtifacts) notifications.push(`Pending artifacts: ${pendingArtifacts}`);
      if (notifications.length > 0) {
        lines.push('NOTIFICATIONS:');
        notifications.forEach(n => lines.push(`  - ${n}`));
      } else {
        lines.push('NOTIFICATIONS: none');
      }
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
        if (studyCard.mnemonic) lines.push(`  Mnemonic: ${studyCard.mnemonic}`);
        if (studyCard.gaiaComment) lines.push(`  Keeper: ${studyCard.gaiaComment}`);
      } else {
        lines.push('CURRENT CARD: (not visible)');
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
        if (quiz.memoryTip) lines.push(`TIP: ${quiz.memoryTip}`);
        if (quiz.resultText) lines.push(`RESULT: ${quiz.resultText}`);
        if (quiz.consistencyWarning) lines.push(`WARNING: ${quiz.consistencyWarning}`);
      } else {
        lines.push('QUIZ: (DOM not populated)');
      }
      lines.push('');
      break;
    }

    case 'divePrep':
    case 'divePrepScreen': {
      lines.push('SCREEN: divePrep (Loadout Selection)');
      const loadout = readStore<Record<string, unknown>>('terra:selectedLoadout');
      if (loadout) {
        lines.push(`LOADOUT: ${JSON.stringify(loadout)}`);
      }
      lines.push('');
      break;
    }

    case 'diveResults': {
      lines.push('SCREEN: diveResults');
      const summary = textOf('.summary-message');
      if (summary) lines.push(`SUMMARY: ${summary}`);
      const correct = textOf('.score-correct');
      const total = textOf('.score-total');
      if (correct || total) lines.push(`SCORE: ${correct ?? '?'} / ${total ?? '?'}`);
      lines.push('');
      break;
    }

    case 'dome': {
      lines.push('SCREEN: dome (Hub Interior)');
      const selectorTitle = textOf('.selector-title');
      if (selectorTitle) lines.push(`ROOM: ${selectorTitle}`);
      lines.push('');
      break;
    }

    case 'knowledgeTree': {
      lines.push('SCREEN: knowledgeTree');
      const gateProgress = textOf('.gate-progress');
      if (gateProgress) lines.push(`GATE PROGRESS: ${gateProgress}`);
      lines.push('');
      break;
    }

    case 'inventory': {
      lines.push('SCREEN: inventory');
      const inv = readStore<unknown[]>('terra:inventoryStore');
      lines.push(`ITEMS: ${Array.isArray(inv) ? inv.length : '?'} total`);
      lines.push('');
      break;
    }

    case 'artifactLab': {
      lines.push('SCREEN: artifactLab (Appraisal)');
      const header = textOf('.artifact-appraisal-header');
      if (header) lines.push(`HEADER: ${header}`);
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
  for (let i = 0; i < 4; i++) {
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
    o2: testIdText('hud-o2-bar') ?? String(readStore<number>('terra:oxygenCurrent') ?? null),
    dust: testIdText('hud-dust') ?? null,
    layer: testIdText('hud-layer') ?? null,
    streak: testIdText('hud-streak') ?? null,
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
    if (quiz.choices.length !== 4) {
      issues.push(`Expected 4 quiz choices, got ${quiz.choices.length}`);
    }
    const nonEmpty = quiz.choices.filter(c => c.length > 0);
    if (nonEmpty.length !== 4) {
      issues.push(`${4 - nonEmpty.length} quiz choice(s) are empty`);
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

  // O2 sanity check
  const o2 = readStore<number>('terra:oxygenCurrent');
  if (o2 !== undefined) {
    if (Number.isNaN(o2)) issues.push('O2 value is NaN');
    if (o2 < 0) issues.push(`O2 value is negative: ${o2}`);
  }

  // Check interactive elements for anomalies via __terraDebug
  try {
    const debugFn = (window as unknown as Record<string, unknown>).__terraDebug as
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
