/**
 * Debug bridge for AI agent (Claude) to query game state via Playwright's browser_evaluate.
 * Exposes window.__terraDebug() snapshot and window.__terraLog ring buffer.
 * DEV MODE ONLY — never included in production builds.
 */

export interface TerraDebugSnapshot {
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
export function terraLog(type: string, detail: string): void {
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

function getPhaserState(): TerraDebugSnapshot['phaser'] {
  const gm = readSymbolStore('terra:gameManagerStore') as Record<string, unknown> | undefined;
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

function getInteractiveElements(): TerraDebugSnapshot['interactiveElements'] {
  const els = document.querySelectorAll('[data-testid]');
  const result: TerraDebugSnapshot['interactiveElements'] = [];
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

function buildSnapshot(): TerraDebugSnapshot {
  const screen = readSymbolStore('terra:currentScreen');
  const knownKeys = ['terra:currentScreen', 'terra:gameManagerStore', 'terra:inventoryStore', 'terra:profileStore', 'terra:settingsStore'];
  const stores: Record<string, unknown> = {};
  for (const key of knownKeys) {
    const val = readSymbolStore(key);
    if (val !== undefined) stores[key.replace('terra:', '')] = val;
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

/** Initialize the debug bridge. Attaches __terraDebug and __terraLog to window. Only works in dev mode. */
export function initDebugBridge(): void {
  if (!import.meta.env.DEV) return;

  (window as unknown as Record<string, unknown>).__terraDebug = buildSnapshot;
  (window as unknown as Record<string, unknown>).__terraLog = logBuffer;

  window.addEventListener('error', (e) => {
    errorBuffer.push(`${e.message} (${e.filename}:${e.lineno})`);
    if (errorBuffer.length > MAX_ERRORS) errorBuffer.shift();
    terraLog('error', e.message);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
    errorBuffer.push(`Unhandled rejection: ${msg}`);
    if (errorBuffer.length > MAX_ERRORS) errorBuffer.shift();
    terraLog('error', `Unhandled rejection: ${msg}`);
  });

  terraLog('state-change', 'Debug bridge initialized');
}
