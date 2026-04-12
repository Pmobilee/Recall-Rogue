/**
 * Debug bridge for AI agent (Claude) to query game state via Playwright's browser_evaluate.
 * Exposes window.__rrDebug() snapshot and window.__rrLog ring buffer.
 * DEV MODE ONLY — never included in production builds.
 */

import { initPlaytestAPI } from './playtestAPI'
import { initScenarioSimulator } from './scenarioSimulator'
import { initScreenshotHelper } from './screenshotHelper'
import { initLayoutDump } from './layoutDump'

export interface FpsStats {
  current: number;
  min: number;
  avg: number;
}

/**
 * Phaser performance telemetry snapshot.
 * Added HIGH-4 (2026-04-10): extend __rrDebug with per-frame renderer metrics
 * so agents can profile CombatScene FPS regressions without a Chrome extension.
 */
export interface PhaserPerfSnapshot {
  /** Phaser game.loop.actualFps — live per-frame FPS from Phaser's TimeStep. */
  fps: number;
  /** 'Canvas' | 'WebGL' — which renderer is active. */
  renderer: 'Canvas' | 'WebGL' | 'unknown';
  /**
   * Number of WebGL draw calls in the last frame (game.renderer.drawCount).
   * Only meaningful when renderer === 'WebGL'. -1 if Canvas or unavailable.
   */
  drawCalls: number;
  /** Number of active tweens in the global tween manager. */
  activeTweens: number;
  /** Number of GameObjects in the active scene's display list. */
  gameObjectCount: number;
  /** Total number of texture keys loaded in the texture manager. */
  textureCount: number;
  /** Canvas pixel dimensions as 'WxH' string. */
  canvasSize: string;
  /**
   * JavaScript heap usage in MB (Chrome only via performance.memory).
   * -1 if the API is unavailable.
   */
  memoryMB: number;
}

export interface RRDebugSnapshot {
  currentScreen: string;
  timestamp: number;
  phaser: {
    running: boolean;
    activeScene: string | null;
    inputHandlerCount: number;
    lastPointerPosition: { x: number; y: number } | null;
  } | null;
  fps: FpsStats;
  /** Extended Phaser performance telemetry (HIGH-4). null when Phaser is not running. */
  phaserPerf: PhaserPerfSnapshot | null;
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

// ── FPS tracking state ────────────────────────────────────────────────────────

/** Rolling window of FPS samples — one sample per second, last 60 retained. */
const FPS_WINDOW_SIZE = 60;
const fpsWindow: number[] = [];

/** Count of consecutive seconds where FPS < 40. Resets when FPS recovers. */
let lowFpsStreak = 0;

/** Timestamp of the last low_fps_alert event to enforce 60s cooldown. */
let lastLowFpsAlertTs = 0;

/** The setInterval handle returned by startFpsMonitoring. */
let fpsIntervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Return current FPS statistics derived from the rolling sample window.
 * Returns zero values if no samples have been collected yet.
 */
export function getFpsStats(): FpsStats {
  if (fpsWindow.length === 0) return { current: 0, min: 0, avg: 0 };
  const current = fpsWindow[fpsWindow.length - 1];
  const min = Math.min(...fpsWindow);
  const avg = Math.round(fpsWindow.reduce((s, v) => s + v, 0) / fpsWindow.length);
  return { current, min, avg };
}

/**
 * Start sampling Phaser's actual FPS once per second.
 * Fires a low_fps_alert analytics event when FPS stays below 40 for 3+ seconds.
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * @param game - The live Phaser.Game instance.
 */
export function startFpsMonitoring(game: Phaser.Game): void {
  // Avoid duplicate intervals if boot() is called more than once
  if (fpsIntervalHandle !== null) return;

  fpsIntervalHandle = setInterval(() => {
    // game.loop.actualFps is updated every frame by Phaser's TimeStep
    const sample = Math.round(game.loop.actualFps);
    fpsWindow.push(sample);
    if (fpsWindow.length > FPS_WINDOW_SIZE) fpsWindow.shift();

    if (sample < 40) {
      lowFpsStreak++;
      if (lowFpsStreak >= 3) {
        const now = Date.now();
        const cooldownElapsed = now - lastLowFpsAlertTs >= 60_000;
        if (cooldownElapsed) {
          lastLowFpsAlertTs = now;
          // Resolve active scene name for context
          let sceneName = 'unknown';
          try {
            const scenes = game.scene.getScenes(true);
            if (scenes.length > 0) {
              sceneName = scenes[0].sys.settings.key;
            }
          } catch {
            // Ignore — scene manager may not be ready
          }
          // Dynamic import to avoid circular dep: debugBridge → analyticsService → playerData
          import('../services/analyticsService').then(({ analyticsService }) => {
            analyticsService.track({
              name: 'low_fps_alert',
              properties: {
                fps: sample,
                scene: sceneName,
                sustained_seconds: lowFpsStreak,
              },
            });
          }).catch(() => {
            // Silently ignore — analytics not critical
          });
          rrLog('fps', `Low FPS alert: ${sample} fps in ${sceneName} for ${lowFpsStreak}s`);
        }
      }
    } else {
      lowFpsStreak = 0;
    }
  }, 1000);
}

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

/**
 * Gather extended Phaser performance telemetry from the live game instance.
 * Reads draw calls, tween count, game object count, texture count, canvas size,
 * and memory usage. Returns null if the game instance is not accessible.
 *
 * HIGH-4 (2026-04-10): added to enable profiling combat FPS regressions.
 */
function getPhaserPerf(): PhaserPerfSnapshot | null {
  // CardGameManager is registered at Symbol.for('rr:cardGameManager'), not 'rr:gameManagerStore'.
  // It exposes getGame() returning Phaser.Game | null.
  const cardGM = (globalThis as Record<symbol, unknown>)[Symbol.for('rr:cardGameManager')] as
    { getGame?: () => Phaser.Game | null } | undefined;
  if (!cardGM) return null;
  try {
    const game = cardGM.getGame?.() ?? null;
    if (!game) return null;

    // Renderer type: Phaser.CANVAS = 1, Phaser.WEBGL = 2
    const renderType = (game.config as { renderType?: number }).renderType;
    let renderer: PhaserPerfSnapshot['renderer'] = 'unknown';
    if (renderType === 1) renderer = 'Canvas';
    else if (renderType === 2) renderer = 'WebGL';

    // Draw calls: only available on WebGL renderer
    // game.renderer is typed as Phaser.Renderer.WebGL.WebGLRenderer | Phaser.Renderer.Canvas.CanvasRenderer
    const webglRenderer = game.renderer as { drawCount?: number } | undefined;
    const drawCalls = (renderer === 'WebGL' && typeof webglRenderer?.drawCount === 'number')
      ? webglRenderer.drawCount
      : -1;

    // Active tweens and game object count — both live on scenes, not on game directly.
    // Tween managers are per-scene in Phaser 3: scene.tweens.getTweens().
    type SceneWithTweens = {
      sys?: { settings?: { key?: string } };
      children?: { list?: unknown[] };
      tweens?: { getTweens?: () => unknown[] };
    };
    let activeTweens = -1;
    let gameObjectCount = -1;
    try {
      const scenePlugin = game.scene as { getScenes?: (active: boolean) => SceneWithTweens[] } | undefined;
      const activeScenes = scenePlugin?.getScenes?.(true) ?? [];
      if (activeScenes.length > 0) {
        // Find the CombatScene specifically, or fall back to any active scene
        const combatOrFirst = activeScenes.find(s => s.sys?.settings?.key === 'CombatScene') ?? activeScenes[0];
        gameObjectCount = combatOrFirst?.children?.list?.length ?? -1;
        // Aggregate tweens across all active scenes (combat + UI)
        activeTweens = activeScenes.reduce((total, s) => {
          const count = s.tweens?.getTweens?.()?.length ?? 0;
          return total + count;
        }, 0);
      }
    } catch {
      activeTweens = -1;
      gameObjectCount = -1;
    }

    // Texture count
    let textureCount = -1;
    try {
      const textures = game.textures as { getTextureKeys?: () => string[] } | undefined;
      textureCount = textures?.getTextureKeys?.()?.length ?? -1;
    } catch {
      textureCount = -1;
    }

    // Canvas dimensions
    const canvas = game.canvas;
    const canvasSize = canvas ? `${canvas.width}x${canvas.height}` : 'unknown';

    // Memory (Chrome only)
    const mem = (performance as { memory?: { usedJSHeapSize?: number } }).memory;
    const memoryMB = mem?.usedJSHeapSize != null
      ? Math.round(mem.usedJSHeapSize / 1024 / 1024 * 10) / 10
      : -1;

    // Live FPS directly from Phaser's game loop
    const fps = Math.round(game.loop.actualFps);

    return { fps, renderer, drawCalls, activeTweens, gameObjectCount, textureCount, canvasSize, memoryMB };
  } catch {
    return null;
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
    phaserPerf: getPhaserPerf(),
    fps: getFpsStats(),
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

  // Initialize the layout dump (window.__rrLayoutDump)
  initLayoutDump();
  rrLog('state-change', 'Layout dump initialized');

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
    const { pendingTransformOptions, activeMysteryEvent } = await import('../services/gameFlowController');
    const g = globalThis as Record<symbol, unknown>;
    g[Symbol.for('rr:activeTurnState')] = activeTurnState;
    g[Symbol.for('rr:activeRunState')] = activeRunState;
    g[Symbol.for('rr:pendingTransformOptions')] = pendingTransformOptions;
    g[Symbol.for('rr:activeMysteryEvent')] = activeMysteryEvent;
  } catch {
    // Silently ignore — stores may not be available yet
  }
}
