/**
 * Save/resume system for active runs.
 * Persists run state to localStorage so players can quit mid-run and resume later.
 * Only ONE active run save at a time.
 */

import type { RunState } from './runManager';
import type { RoomOption } from './floorManager';
import { getAscensionModifiers } from './ascension';
import type { Card, CardRunState } from '../data/card-types';
import type { RewardBundle, RewardRevealStep } from '../ui/stores/gameState';
import type { EncounterSnapshot } from './encounterBridge';
import { serializeRunRngState } from './seededRng';

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
  /** Active run mode for deterministic/resume behavior. */
  runMode?: 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge';
  /** Optional deterministic seed used by fixed-seed modes. */
  dailySeed?: number | null;
  /** Run seed for standard and endless_depths modes (for fair replay and multiplayer comparison). */
  runSeed?: number | null;
  /** Room options if paused at room selection. */
  roomOptions?: RoomOption[];
  /** Card reward options when paused on card reward screen. */
  cardRewardOptions?: Card[];
  /** Reward reveal metadata when paused on reward screen. */
  activeRewardBundle?: RewardBundle | null;
  rewardRevealStep?: RewardRevealStep;
  /** Serialized encounter bridge state required for exact resume. */
  encounterSnapshot?: SerializedEncounterSnapshot;
  /** Serialized RNG fork states for deterministic resume. */
  rngState?: { seed: number; forks: Record<string, number> } | null;
}

/** RunState with Sets replaced by arrays for JSON serialization. */
interface SerializedRunState extends Omit<
  RunState,
  'consumedRewardFactIds' | 'factsAnsweredCorrectly' | 'factsAnsweredIncorrectly' | 'firstChargeFreeFactIds' | 'offeredRelicIds' | 'cursedFactIds'
> {
  /** Legacy field — present in old saves, ignored on load. */
  echoFactIds?: string[];
  consumedRewardFactIds: string[];
  factsAnsweredCorrectly: string[];
  factsAnsweredIncorrectly: string[];
  firstChargeFreeFactIds: string[];
  offeredRelicIds: string[];
  cursedFactIds: string[];
  /** Legacy field — present in old saves, ignored on load. */
  discoveredFactIds?: string[];
}

interface SerializedEncounterSnapshot {
  activeDeck: CardRunState | null
  activeRunPool: Card[]
}

/** Serialize RunState Sets to arrays for JSON storage. */
function serializeRunState(run: RunState): SerializedRunState {
  return {
    ...run,
    consumedRewardFactIds: [...run.consumedRewardFactIds],
    factsAnsweredCorrectly: [...run.factsAnsweredCorrectly],
    factsAnsweredIncorrectly: [...run.factsAnsweredIncorrectly],
    firstChargeFreeFactIds: [...run.firstChargeFreeFactIds],
    offeredRelicIds: [...run.offeredRelicIds],
    cursedFactIds: [...run.cursedFactIds],
  };
}

/** Deserialize arrays back to Sets for RunState. */
function deserializeRunState(saved: SerializedRunState): RunState {
  const savedAny = saved as unknown as Record<string, unknown>;
  const rawLevel = typeof savedAny['ascensionLevel'] === 'number' ? Number(savedAny['ascensionLevel']) : 0;
  const ascensionLevel = Number.isFinite(rawLevel) ? Math.max(0, Math.floor(rawLevel)) : 0;
  const defaultModifiers = getAscensionModifiers(ascensionLevel);
  const savedModifiers = (
    typeof savedAny['ascensionModifiers'] === 'object' && savedAny['ascensionModifiers'] !== null
  ) ? savedAny['ascensionModifiers'] as Partial<RunState['ascensionModifiers']> : null;

  return {
    ...saved,
    consumedRewardFactIds: new Set(saved.consumedRewardFactIds),
    factsAnsweredCorrectly: new Set(saved.factsAnsweredCorrectly),
    factsAnsweredIncorrectly: new Set(saved.factsAnsweredIncorrectly),
    firstChargeFreeFactIds: new Set(saved.firstChargeFreeFactIds ?? []),
    offeredRelicIds: new Set(saved.offeredRelicIds ?? []),
    cursedFactIds: new Set(saved.cursedFactIds ?? []),
    ascensionLevel,
    ascensionModifiers: savedModifiers ? { ...defaultModifiers, ...savedModifiers } : defaultModifiers,
    retreatRewardLocked: Boolean(savedAny['retreatRewardLocked']),
    // Default to 1 for saves created before AR-122 (globalTurnCounter didn't exist).
    globalTurnCounter: typeof savedAny['globalTurnCounter'] === 'number' ? savedAny['globalTurnCounter'] : 1,
    // Default to 0 for saves created before soul_jar was added.
    soulJarCharges: typeof savedAny['soulJarCharges'] === 'number' ? savedAny['soulJarCharges'] : 0,
  };
}

/** Save the current active run to localStorage. */
export function saveActiveRun(state: {
  version: number;
  savedAt: string;
  runState: RunState;
  currentScreen: string;
  runMode?: 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge';
  dailySeed?: number | null;
  runSeed?: number | null;
  roomOptions?: RoomOption[];
  cardRewardOptions?: Card[];
  activeRewardBundle?: RewardBundle | null;
  rewardRevealStep?: RewardRevealStep;
  encounterSnapshot?: EncounterSnapshot | null;
  rngState?: { seed: number; forks: Record<string, number> } | null;
}): void {
  const encounterSnapshot: SerializedEncounterSnapshot | undefined = state.encounterSnapshot
    ? {
      activeDeck: state.encounterSnapshot.activeDeck,
      activeRunPool: state.encounterSnapshot.activeRunPool,
    }
    : undefined;
  const serialized: RunSaveState = {
    version: state.version,
    savedAt: state.savedAt,
    runState: serializeRunState(state.runState),
    currentScreen: state.currentScreen,
    runMode: state.runMode,
    dailySeed: state.dailySeed ?? null,
    runSeed: state.runSeed ?? null,
    roomOptions: state.roomOptions,
    cardRewardOptions: state.cardRewardOptions,
    activeRewardBundle: state.activeRewardBundle ?? null,
    rewardRevealStep: state.rewardRevealStep ?? 'gold',
    encounterSnapshot,
    rngState: serializeRunRngState(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serialized));
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

/** Load the active run save from localStorage. Returns null if no save exists. */
export function loadActiveRun(): {
  runState: RunState;
  currentScreen: string;
  runMode?: 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge';
  dailySeed?: number | null;
  runSeed?: number | null;
  roomOptions?: RoomOption[];
  cardRewardOptions?: Card[];
  activeRewardBundle?: RewardBundle | null;
  rewardRevealStep?: RewardRevealStep;
  encounterSnapshot?: EncounterSnapshot | null;
  rngState?: { seed: number; forks: Record<string, number> } | null;
} | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: RunSaveState = JSON.parse(raw);
    if (!parsed || typeof parsed.version !== 'number') return null;
    return {
      runState: deserializeRunState(parsed.runState),
      currentScreen: parsed.currentScreen,
      runMode: parsed.runMode,
      dailySeed: parsed.dailySeed ?? null,
      runSeed: parsed.runSeed ?? null,
      roomOptions: parsed.roomOptions,
      cardRewardOptions: parsed.cardRewardOptions ?? [],
      activeRewardBundle: parsed.activeRewardBundle ?? null,
      rewardRevealStep: parsed.rewardRevealStep ?? 'gold',
      encounterSnapshot: parsed.encounterSnapshot
        ? {
          activeDeck: parsed.encounterSnapshot.activeDeck ?? null,
          activeRunPool: parsed.encounterSnapshot.activeRunPool ?? [],
        }
        : null,
      rngState: parsed.rngState ?? null,
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
