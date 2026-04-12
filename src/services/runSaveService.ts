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
import { getBackend } from './storageBackend';
import { InRunFactTracker, type InRunFactTrackerSnapshot } from './inRunFactTracker';

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
  runMode?: 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge' | 'multiplayer_race';
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

/**
 * RunState with Sets/Maps/class-instances replaced by serializable equivalents.
 *
 * CRITICAL: Every field on RunState whose runtime type is Set, Map, WeakSet, or
 * a class instance MUST be listed in the Omit<> union below and handled
 * explicitly in serializeRunState / deserializeRunState. Plain `...spread` is
 * NOT safe for these types — JSON.stringify converts Sets and Maps to `{}`,
 * causing `.has()` / `.get()` TypeErrors after resume (CRITICAL-2, 2026-04-10).
 *
 * Currently excluded (in-memory only, not persisted):
 *   - reviewStateSnapshot  (Map — rebuilt at startRun from FSRS state)
 *   - firstTimeFactIds     (Set — rebuilt at startRun)
 *   - tierAdvancedFactIds  (Set — rebuilt at startRun)
 *   - masteredThisRunFactIds (Set — rebuilt at startRun)
 *   - chainDistribution    (class instance)
 *
 * Currently serialized as arrays (re-wrapped to Set on load):
 *   - consumedRewardFactIds, factsAnsweredCorrectly, factsAnsweredIncorrectly,
 *     firstChargeFreeFactIds, offeredRelicIds, cursedFactIds, attemptedFactIds
 *
 * Currently serialized via class round-trip (toJSON / fromJSON):
 *   - inRunFactTracker (InRunFactTracker class instance)
 *
 * CardRunState embedded in encounterSnapshot.activeDeck:
 *   - currentEncounterSeenFacts (Set<string>) — explicitly serialized to array
 *     in saveActiveRun and re-wrapped on loadActiveRun (CRITICAL-3, 2026-04-12).
 */
interface SerializedRunState extends Omit<
  RunState,
  | 'consumedRewardFactIds'
  | 'factsAnsweredCorrectly'
  | 'factsAnsweredIncorrectly'
  | 'firstChargeFreeFactIds'
  | 'offeredRelicIds'
  | 'cursedFactIds'
  | 'attemptedFactIds'
  | 'chainDistribution'
  | 'inRunFactTracker'
  | 'reviewStateSnapshot'
  | 'firstTimeFactIds'
  | 'tierAdvancedFactIds'
  | 'masteredThisRunFactIds'
> {
  /** Legacy field — present in old saves, ignored on load. */
  echoFactIds?: string[];
  consumedRewardFactIds: string[];
  factsAnsweredCorrectly: string[];
  factsAnsweredIncorrectly: string[];
  firstChargeFreeFactIds: string[];
  offeredRelicIds: string[];
  cursedFactIds: string[];
  /** AR-223: Fact IDs attempted at least once this run — for new-fact protection. */
  attemptedFactIds: string[];
  /** Legacy field — present in old saves, ignored on load. */
  discoveredFactIds?: string[];
  /**
   * Plain-object snapshot of the per-run study mode tracker. Undefined for
   * trivia runs (which never instantiate one). The runtime field is a class
   * instance that JSON.stringify cannot represent natively, so we round-trip
   * it through `InRunFactTracker.toJSON` / `InRunFactTracker.fromJSON`.
   */
  inRunFactTracker?: InRunFactTrackerSnapshot;
  // NOTE: reviewStateSnapshot, firstTimeFactIds, tierAdvancedFactIds,
  // masteredThisRunFactIds are intentionally absent — they are in-memory only
  // and are rebuilt at startRun() / gameFlowController. On resume, these fields
  // will be undefined until the next startRun call (which is correct: the
  // player is resuming an in-progress run, not starting a new one, so tier
  // deltas accumulate from this point forward only).
}

/**
 * Wire type for the serialized encounter snapshot.
 * currentEncounterSeenFacts is stored as string[] (Set is not JSON-safe).
 */
interface SerializedEncounterSnapshot {
  activeDeck: CardRunState | null
  activeRunPool: Card[]
}

/** Serialize RunState Sets to arrays for JSON storage. */
function serializeRunState(run: RunState): SerializedRunState {
  // Destructure to explicitly exclude in-memory-only Set/Map/class fields.
  // DO NOT use `...run` alone — it would spread Sets/Maps into the output as
  // `{}` (JSON.stringify strips their contents), breaking `.has()` on resume.
  const {
    // excluded — serialized via explicit array fields below:
    consumedRewardFactIds: _c,
    factsAnsweredCorrectly: _fac,
    factsAnsweredIncorrectly: _fai,
    firstChargeFreeFactIds: _fc,
    offeredRelicIds: _or,
    cursedFactIds: _cf,
    attemptedFactIds: _af,
    // excluded — class instance serialized via toJSON below:
    inRunFactTracker: _irt,
    // excluded — in-memory only (NOT persisted, rebuilt at startRun):
    reviewStateSnapshot: _rss,
    firstTimeFactIds: _ftf,
    tierAdvancedFactIds: _taf,
    masteredThisRunFactIds: _mtr,
    // excluded — class instance, not persisted:
    chainDistribution: _cd,
    // everything else passes through:
    ...rest
  } = run;

  return {
    ...rest,
    consumedRewardFactIds: [...run.consumedRewardFactIds],
    factsAnsweredCorrectly: [...run.factsAnsweredCorrectly],
    factsAnsweredIncorrectly: [...run.factsAnsweredIncorrectly],
    firstChargeFreeFactIds: [...run.firstChargeFreeFactIds],
    offeredRelicIds: [...run.offeredRelicIds],
    cursedFactIds: [...run.cursedFactIds],
    attemptedFactIds: [...run.attemptedFactIds],
    // Flatten the InRunFactTracker class instance to a plain snapshot.
    // Without this, JSON.stringify would emit `{}` for the internal Maps and
    // strip every method, causing first-card-play hangs on resume in Study
    // Temple / custom_deck runs (selectFactForCharge would TypeError on
    // tracker.getTotalCharges).
    inRunFactTracker: run.inRunFactTracker ? run.inRunFactTracker.toJSON() : undefined,
  };
}

/**
 * Explicitly serialize all Set fields in a CardRunState to arrays.
 * This is necessary because JSON.stringify converts a Set to `{}` — the
 * rehydrator must receive arrays to re-wrap them correctly.
 *
 * CRITICAL-3 (2026-04-12): currentEncounterSeenFacts is the only Set/Map
 * currently on CardRunState. If new Set/Map fields are added, extend this
 * function AND the rehydration in rehydrateActiveDeckSets().
 */
function serializeActiveDeckSets(deck: CardRunState): CardRunState {
  return {
    ...deck,
    // Convert Set<string> → string[] so JSON.stringify round-trips cleanly.
    // A missing/undefined field stays undefined (first encounter of a new run
    // where drawHand hasn't fired yet).
    currentEncounterSeenFacts: deck.currentEncounterSeenFacts instanceof Set
      ? (Array.from(deck.currentEncounterSeenFacts) as unknown as Set<string>)
      : deck.currentEncounterSeenFacts,
  };
}

/**
 * Re-wrap Set fields in a CardRunState after JSON deserialization.
 * Called on the activeDeck from an encounterSnapshot before it is returned to
 * the caller. Companion to serializeActiveDeckSets().
 *
 * CRITICAL-3 (2026-04-12): fixes the continued-run softlock where
 * chargePlayCard threw because currentEncounterSeenFacts came back as a plain
 * array (or `{}`) instead of a Set after JSON round-trip.
 */
function rehydrateActiveDeckSets(deck: Record<string, unknown>): void {
  // Re-wrap currentEncounterSeenFacts: array → Set (serialized path),
  // or reset plain object → empty Set (legacy saves written before this fix
  // where JSON.stringify silently converted Set to `{}`).
  if (Array.isArray(deck['currentEncounterSeenFacts'])) {
    deck['currentEncounterSeenFacts'] = new Set(deck['currentEncounterSeenFacts'] as string[]);
  } else if (
    typeof deck['currentEncounterSeenFacts'] === 'object' &&
    deck['currentEncounterSeenFacts'] !== null &&
    !(deck['currentEncounterSeenFacts'] instanceof Set)
  ) {
    // Plain `{}` from an old save (pre-CRITICAL-3) — reset to empty Set.
    // The encounter will repopulate it on the next drawHand call.
    deck['currentEncounterSeenFacts'] = new Set<string>();
  }
  // undefined is valid (encounter not yet started) — leave as-is.
}

/** Migration: rename exhaustPile → forgetPile in a CardRunState (2026-04-11 exhaust→forget rename). */
function migrateExhaustPileToForgetPile(deck: Record<string, unknown>): void {
  if ('exhaustPile' in deck && !('forgetPile' in deck)) {
    // Migration 2026-04-11: exhaust → forget rename
    (deck as Record<string, unknown>)['forgetPile'] = deck['exhaustPile'];
    delete deck['exhaustPile'];
  }
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
    // AR-223: Default to empty set for saves created before new-fact protection was added.
    attemptedFactIds: new Set(Array.isArray(saved.attemptedFactIds) ? saved.attemptedFactIds : []),
    ascensionLevel,
    ascensionModifiers: savedModifiers ? { ...defaultModifiers, ...savedModifiers } : defaultModifiers,
    retreatRewardLocked: Boolean(savedAny['retreatRewardLocked']),
    // Default to 1 for saves created before AR-122 (globalTurnCounter didn't exist).
    globalTurnCounter: typeof savedAny['globalTurnCounter'] === 'number' ? savedAny['globalTurnCounter'] : 1,
    // Default to 0 for saves created before soul_jar was added.
    soulJarCharges: typeof savedAny['soulJarCharges'] === 'number' ? savedAny['soulJarCharges'] : 0,
    // AR-241: Default to empty object for saves created before per-fact variant progression was added.
    factVariantLevel: (typeof savedAny['factVariantLevel'] === 'object' && savedAny['factVariantLevel'] !== null && !Array.isArray(savedAny['factVariantLevel']))
      ? savedAny['factVariantLevel'] as Record<string, number>
      : {},
    // Rebuild the per-run study tracker from its serialized snapshot. Trivia
    // and pre-fix study saves have no field — leave it undefined so the
    // study-mode quiz path falls through to its existing guards.
    inRunFactTracker: saved.inRunFactTracker
      ? InRunFactTracker.fromJSON(saved.inRunFactTracker)
      : undefined,
    // In-memory-only tracking fields: always initialize to empty/undefined on
    // resume. These are rebuilt by gameFlowController.startRun() on a fresh
    // run, but after resume they remain undefined until the next run starts —
    // recordCardPlay() guards all access with `state.reviewStateSnapshot !== undefined`
    // so this is safe. (CRITICAL-2 fix: previously these fields leaked through
    // the `...run` spread as `{}` plain objects, causing .has() to throw.)
    reviewStateSnapshot: undefined,
    firstTimeFactIds: new Set<string>(),
    tierAdvancedFactIds: new Set<string>(),
    masteredThisRunFactIds: new Set<string>(),
  };
}

/** Save the current active run to localStorage. */
export function saveActiveRun(state: {
  version: number;
  savedAt: string;
  runState: RunState;
  currentScreen: string;
  runMode?: 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge' | 'multiplayer_race';
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
      // CRITICAL-3 (2026-04-12): explicitly serialize CardRunState Set fields
      // to arrays before the snapshot reaches JSON.stringify. Without this,
      // currentEncounterSeenFacts (Set<string>) becomes `{}` in the stored
      // JSON, and on resume deckManager.ts:327 throws
      // "deck.currentEncounterSeenFacts.add is not a function".
      activeDeck: state.encounterSnapshot.activeDeck
        ? serializeActiveDeckSets(state.encounterSnapshot.activeDeck)
        : null,
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
    getBackend().write(SAVE_KEY, JSON.stringify(serialized));
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

/** Load the active run save from localStorage. Returns null if no save exists. */
export function loadActiveRun(): {
  runState: RunState;
  currentScreen: string;
  runMode?: 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge' | 'multiplayer_race';
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
    const raw = getBackend().readSync(SAVE_KEY);
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
        ? (() => {
            const eDeck = parsed.encounterSnapshot!.activeDeck as (Record<string, unknown> | null);
            if (eDeck) {
              migrateExhaustPileToForgetPile(eDeck);
              // CRITICAL-3 (2026-04-12): re-wrap CardRunState Set fields after
              // JSON deserialization. currentEncounterSeenFacts arrives as a
              // string[] (new saves via serializeActiveDeckSets) or as `{}`
              // (legacy saves before this fix). Both cases are handled by
              // rehydrateActiveDeckSets() so that .add() never throws.
              rehydrateActiveDeckSets(eDeck);
            }
            return {
              activeDeck: parsed.encounterSnapshot!.activeDeck ?? null,
              activeRunPool: parsed.encounterSnapshot!.activeRunPool ?? [],
            };
          })()
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
    getBackend().remove(SAVE_KEY);
  } catch {
    // Silently fail
  }
}

/** Check if an active run save exists. */
export function hasActiveRun(): boolean {
  try {
    return getBackend().readSync(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
