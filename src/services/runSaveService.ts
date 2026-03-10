/**
 * Save/resume system for active runs.
 * Persists run state to localStorage so players can quit mid-run and resume later.
 * Only ONE active run save at a time.
 */

import type { RunState } from './runManager';
import type { RoomOption } from './floorManager';

const SAVE_KEY = 'recall-rogue-active-run';

/** Serializable snapshot of an active run for save/resume. */
export interface RunSaveState {
  /** Schema version for future migration. */
  version: number;
  /** ISO timestamp of when this save was created. */
  savedAt: string;
  /** Full run state (serialized — Sets converted to arrays). */
  runState: SerializedRunState;
  /** Which screen to restore on resume. */
  currentScreen: string;
  /** Room options if paused at room selection. */
  roomOptions?: RoomOption[];
}

/** RunState with Sets replaced by arrays for JSON serialization. */
interface SerializedRunState extends Omit<
  RunState,
  'echoFactIds' | 'consumedRewardFactIds' | 'factsAnsweredCorrectly' | 'factsAnsweredIncorrectly'
> {
  echoFactIds: string[];
  consumedRewardFactIds: string[];
  factsAnsweredCorrectly: string[];
  factsAnsweredIncorrectly: string[];
}

/** Serialize RunState Sets to arrays for JSON storage. */
function serializeRunState(run: RunState): SerializedRunState {
  return {
    ...run,
    echoFactIds: [...run.echoFactIds],
    consumedRewardFactIds: [...run.consumedRewardFactIds],
    factsAnsweredCorrectly: [...run.factsAnsweredCorrectly],
    factsAnsweredIncorrectly: [...run.factsAnsweredIncorrectly],
  };
}

/** Deserialize arrays back to Sets for RunState. */
function deserializeRunState(saved: SerializedRunState): RunState {
  return {
    ...saved,
    echoFactIds: new Set(saved.echoFactIds),
    consumedRewardFactIds: new Set(saved.consumedRewardFactIds),
    factsAnsweredCorrectly: new Set(saved.factsAnsweredCorrectly),
    factsAnsweredIncorrectly: new Set(saved.factsAnsweredIncorrectly),
  };
}

/** Save the current active run to localStorage. */
export function saveActiveRun(state: {
  version: number;
  savedAt: string;
  runState: RunState;
  currentScreen: string;
  roomOptions?: RoomOption[];
}): void {
  const serialized: RunSaveState = {
    version: state.version,
    savedAt: state.savedAt,
    runState: serializeRunState(state.runState),
    currentScreen: state.currentScreen,
    roomOptions: state.roomOptions,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serialized));
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

/** Load the active run save from localStorage. Returns null if no save exists. */
export function loadActiveRun(): { runState: RunState; currentScreen: string; roomOptions?: RoomOption[] } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: RunSaveState = JSON.parse(raw);
    if (!parsed || typeof parsed.version !== 'number') return null;
    return {
      runState: deserializeRunState(parsed.runState),
      currentScreen: parsed.currentScreen,
      roomOptions: parsed.roomOptions,
    };
  } catch {
    return null;
  }
}

/** Clear the active run save from localStorage. */
export function clearActiveRun(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Silently fail
  }
}

/** Check if an active run save exists. */
export function hasActiveRun(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
