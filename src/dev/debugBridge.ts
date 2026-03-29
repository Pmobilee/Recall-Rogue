/**
 * Debug bridge for AI agent (Claude) to query game state via Playwright's browser_evaluate.
 * Exposes window.__rrDebug() snapshot and window.__rrLog ring buffer.
 * DEV MODE ONLY — never included in production builds.
 */

import { initPlaytestAPI } from './playtestAPI'
import { initScenarioSimulator } from './scenarioSimulator'
import { initScreenshotHelper } from './screenshotHelper'

export interface RRDebugSnapshot {
  currentScreen: string;
  timestamp: number;
  phaser: {
    running: boolean;
    activeScene: string | null;
    inputHandlerCount: number;
    lastPointerPosition: { x: number; y: number } | null;
  } | null;
  stores: Record<string, unknown>;
  interactiveElements: Array<{
    testId: string;
    tagName: string;
    visible: boolean;
    disabled: boolean;
    pointerEvents: string;
    occluded: boolean;
    boundingRect: { x: number; y: number; w: number; h: number };
  }>;
  recentErrors: string[];
  recentLog: Array<{ ts: number; type: string; detail: string }>;
}

interface LogEntry {
  ts: number;
  type: string;
  detail: string;
}

const MAX_LOG = 100;
const MAX_ERRORS = 20;
const logBuffer: LogEntry[] = [];
const errorBuffer: string[] = [];

/** Push an event into the ring buffer log. */
export function rrLog(type: string, detail: string): void {
  logBuffer.push({ ts: Date.now(), type, detail });
  if (logBuffer.length > MAX_LOG) logBuffer.shift();
}

function readSymbolStore(key: string): unknown {
  const sym = Symbol.for(key);
  const store = (globalThis as Record<symbol, unknown>)[sym];
  if (!store || typeof store !== 'object') return undefined;
  let value: unknown;
  const s = store as { subscribe?: (cb: (v: unknown) => void) => () => void };
  if (typeof s.subscribe === 'function') {
    s.subscribe((v) => { value = v; })();
  }
  return value;
}

function getPhaserState(): RRDebugSnapshot['phaser'] {
  const gm = readSymbolStore('rr:gameManagerStore') as Record<string, unknown> | undefined;
  if (!gm) return null;
  try {
    const game = (gm as { game?: { scene?: unknown; input?: unknown } }).game;
    if (!game) return null;
    const scenePlugin = game.scene as { getScenes?: (active: boolean) => Array<{ sys: { settings: { key: string } } }> } | undefined;
    const scenes = scenePlugin?.getScenes?.(true) ?? [];
    const input = game.input as { pointers?: Array<{ x: number; y: number }> } | undefined;
    const pointer = input?.pointers?.[0];
    return {
      running: true,
      activeScene: scenes.length > 0 ? scenes[0].sys.settings.key : null,
      inputHandlerCount: scenes.length,
      lastPointerPosition: pointer ? { x: Math.round(pointer.x), y: Math.round(pointer.y) } : null,
    };
  } catch {
    return { running: false, activeScene: null, inputHandlerCount: 0, lastPointerPosition: null };
  }
}

function getInteractiveElements(): RRDebugSnapshot['interactiveElements'] {
  const els = document.querySelectorAll('[data-testid]');
  const result: RRDebugSnapshot['interactiveElements'] = [];
  els.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const rect = htmlEl.getBoundingClientRect();
    const style = getComputedStyle(htmlEl);
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && htmlEl.offsetParent !== null;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    let occluded = false;
    if (isVisible && rect.width > 0 && rect.height > 0) {
      const topEl = document.elementFromPoint(cx, cy);
      occluded = topEl !== null && topEl !== htmlEl && !htmlEl.contains(topEl);
    }
    result.push({
      testId: htmlEl.getAttribute('data-testid') ?? '',
      tagName: htmlEl.tagName.toLowerCase(),
      visible: isVisible,
      disabled: (htmlEl as HTMLButtonElement).disabled || htmlEl.getAttribute('aria-disabled') === 'true',
      pointerEvents: style.pointerEvents,
      occluded,
      boundingRect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    });
  });
  return result;
}

function buildSnapshot(): RRDebugSnapshot {
  const screen = readSymbolStore('rr:currentScreen');
  const knownKeys = ['rr:currentScreen', 'rr:gameManagerStore', 'rr:inventoryStore', 'rr:profileStore', 'rr:settingsStore'];
  const stores: Record<string, unknown> = {};
  for (const key of knownKeys) {
    const val = readSymbolStore(key);
    if (val !== undefined) stores[key.replace('rr:', '')] = val;
  }
  return {
    currentScreen: typeof screen === 'string' ? screen : 'unknown',
    timestamp: Date.now(),
    phaser: getPhaserState(),
    stores,
    interactiveElements: getInteractiveElements(),
    recentErrors: [...errorBuffer],
    recentLog: logBuffer.slice(-20),
  };
}

/** Initialize the debug bridge. Attaches __rrDebug and __rrLog to window. Only works in dev mode. */
export function initDebugBridge(): void {
  if (!import.meta.env.DEV) return;

  (window as unknown as Record<string, unknown>).__rrDebug = buildSnapshot;
  (window as unknown as Record<string, unknown>).__rrLog = logBuffer;

  // Register combat/run stores to globalThis so dev tools can read them
  registerStoresLazy();

  window.addEventListener('error', (e) => {
    errorBuffer.push(`${e.message} (${e.filename}:${e.lineno})`);
    if (errorBuffer.length > MAX_ERRORS) errorBuffer.shift();
    rrLog('error', e.message);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
    errorBuffer.push(`Unhandled rejection: ${msg}`);
    if (errorBuffer.length > MAX_ERRORS) errorBuffer.shift();
    rrLog('error', `Unhandled rejection: ${msg}`);
  });

  rrLog('state-change', 'Debug bridge initialized');

  // Auto-apply URL dev params (?giveDust=20000&setLevel=25)
  const devParams = new URLSearchParams(window.location.search);
  const giveDustParam = devParams.get('giveDust');
  const setLevelParam = devParams.get('setLevel');
  if (giveDustParam || setLevelParam) {
    // Defer to next tick so stores are initialized
    setTimeout(async () => {
      if (giveDustParam) {
        const amount = parseInt(giveDustParam, 10) || 20000;
        const { addMinerals } = await import('../ui/stores/playerData');
        addMinerals('greyMatter', amount);
        console.log(`[DEV] Auto-added ${amount} grey matter via URL param`);
      }
      if (setLevelParam) {
        const level = parseInt(setLevelParam, 10) || 1;
        const { cumulativeXpForLevel } = await import('../services/characterLevel');
        const { playerSave, persistPlayer } = await import('../ui/stores/playerData');
        const targetXP = cumulativeXpForLevel(level);
        playerSave.update(s => s ? { ...s, totalXP: targetXP, characterLevel: level } : s);
        persistPlayer();
        console.log(`[DEV] Auto-set level to ${level} via URL param`);
      }
    }, 500);
  }

  // Dev cheats
  (window as unknown as Record<string, unknown>).__rrGiveDust = async (amount: number = 20000) => {
    const { addMinerals } = await import('../ui/stores/playerData');
    addMinerals('greyMatter', amount);
    console.log(`[DEV] Added ${amount} grey matter`);
  };

  (window as unknown as Record<string, unknown>).__rrSetLevel = async (level: number) => {
    const { cumulativeXpForLevel } = await import('../services/characterLevel');
    const { playerSave, persistPlayer } = await import('../ui/stores/playerData');
    const targetXP = cumulativeXpForLevel(level);
    playerSave.update(s => s ? { ...s, totalXP: targetXP, characterLevel: level } : s);
    persistPlayer();
    console.log(`[DEV] Set level to ${level} (totalXP = ${targetXP}, characterLevel = ${level})`);
  };

  // Initialize the playtest gameplay API (window.__rrPlay)
  initPlaytestAPI();

  // Initialize the scenario simulator (window.__rrScenario)
  initScenarioSimulator();

  // Initialize the screenshot helper (window.__rrScreenshot)
  initScreenshotHelper();
  rrLog('state-change', 'Screenshot helper initialized');

  // Backward compat aliases — remove after 2026-06-01
  const win = window as unknown as Record<string, unknown>;
  win.__terraDebug = win.__rrDebug;
  win.__terraLog = win.__rrLog;
  win.__terraGiveDust = win.__rrGiveDust;
  win.__terraSetLevel = win.__rrSetLevel;
}

/**
 * Lazily registers key Svelte stores to globalThis[Symbol.for(...)] so that
 * readStore() in playtestAPI/scenarioSimulator can access them.
 * Uses dynamic import to avoid circular dependency issues.
 */
async function registerStoresLazy(): Promise<void> {
  try {
    const { activeTurnState } = await import('../services/encounterBridge');
    const { activeRunState } = await import('../services/runStateStore');
    const g = globalThis as Record<symbol, unknown>;
    g[Symbol.for('rr:activeTurnState')] = activeTurnState;
    g[Symbol.for('rr:activeRunState')] = activeRunState;
  } catch {
    // Silently ignore — stores may not be available yet
  }
}
