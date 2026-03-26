/**
 * Run lifecycle management for the card roguelite.
 * Pure logic layer — no Phaser/Svelte/DOM imports.
 */

import type { FactDomain } from '../data/card-types';
import type { FloorState } from './floorManager';
import { createFloorState, getSegment } from './floorManager';
import { PLAYER_START_HP, PLAYER_MAX_HP, DEATH_PENALTY, DIFFICULTY_REWARD_MULTIPLIER } from '../data/balance';
import { difficultyMode } from './cardPreferences';
import { get } from 'svelte/store';
import type { ActiveBounty } from './bountyManager';
import { selectRunBounties } from './bountyManager';
import type { CanaryState } from './canaryService';
import { createCanaryState, recordCanaryAnswer } from './canaryService';
import { getAscensionModifiers, type AscensionModifiers } from './ascension';
import { getRewardMultiplier, isPracticeRun } from './masteryScalingService';
import type { DeckMode } from '../data/studyPreset';
import { InRunFactTracker } from './inRunFactTracker';
import { getCuratedDeckFacts } from '../data/curatedDeckStore';
import { playerSave } from '../ui/stores/playerData';

export type RewardArchetype = 'balanced' | 'aggressive' | 'defensive' | 'control' | 'hybrid';

export interface RunState {
  isActive: boolean;
  primaryDomain: FactDomain;
  secondaryDomain: FactDomain;
  selectedArchetype: RewardArchetype;
  starterDeckSize: number;
  startingAp: number;
  primaryDomainRunNumber: number;
  earlyBoostActive: boolean;
  floor: FloorState;
  playerHp: number;
  playerMaxHp: number;
  currency: number;
  cardsEarned: number;
  factsAnswered: number;
  factsCorrect: number;
  bestCombo: number;
  correctAnswers: number;
  newFactsLearned: number;
  factsMastered: number;
  encountersWon: number;
  encountersTotal: number;
  elitesDefeated: number;
  miniBossesDefeated: number;
  bossesDefeated: number;
  currentEncounterWrongAnswers: number;
  bounties: ActiveBounty[];
  canary: CanaryState;
  startedAt: number;
  /**
   * Fact IDs for which the player has already used their one free first Charge this run.
   * Once a factId is in this set, that fact costs the normal +1 AP Charge surcharge.
   * Per-run, not per-encounter. Cleared on new run.
   */
  firstChargeFreeFactIds: Set<string>;
  /**
   * Fact IDs attempted (correct or wrong Charge) at least once during this run.
   * Used by new-fact protection: on the first attempt at a given fact, mastery
   * downgrade and curse are skipped so the player is never punished for genuinely
   * not knowing a card they have never seen before.
   * Per-run, not per-encounter. Cleared on new run.
   */
  attemptedFactIds: Set<string>;
  /**
   * Fact IDs for which the player gave a wrong Charge on a mastery 0 card.
   * Any card assigned one of these facts is treated as Cursed.
   * Cured by correct Charge on the fact in combat.
   */
  cursedFactIds: Set<string>;
  consumedRewardFactIds: Set<string>;
  factsAnsweredCorrectly: Set<string>;
  factsAnsweredIncorrectly: Set<string>;
  runAccuracyBonusApplied: boolean;
  endlessEnemyDamageMultiplier: number;
  ascensionLevel: number;
  ascensionModifiers: AscensionModifiers;
  retreatRewardLocked: boolean;
  /** Relics collected during this run (no cap). */
  runRelics: Array<{ definitionId: string; acquiredAtFloor: number; acquiredAtEncounter: number; triggerCount: number }>;
  /** Relic IDs already offered during this run (prevents duplicates). */
  offeredRelicIds: Set<string>;
  /** Whether the first mini-boss relic choice has occurred. */
  firstMiniBossRelicAwarded: boolean;
  /**
   * Consecutive Common-only relic acquisitions since last Uncommon+ acquisition.
   * Resets to 0 whenever an Uncommon, Rare, or Legendary relic is acquired.
   * When this reaches RELIC_PITY_THRESHOLD (4), the next draw is forced Uncommon+.
   */
  relicPityCounter: number;
  /** Whether the phoenix feather (once-per-run lethal save) has been used. */
  phoenixFeatherUsed: boolean;
  /** Mastery percentage of the deck/pool at run start (0-1). */
  deckMasteryPct?: number;
  /** True when the selected pool is >75% mastered — rewards are disabled for this run. */
  practiceRunDetected?: boolean;
  /** Whether rewards are disabled (e.g. pool too small). */
  rewardsDisabled?: boolean;
  /** Active deck mode for this run (general/preset/language). */
  deckMode?: DeckMode;
  /** Anti-farm reward scale derived from selected pool size/novelty. */
  poolRewardScale?: number;
  /** Novel-fact ratio in the selected pool (0-1). */
  poolNoveltyPct?: number;
  /** Unique fact count in the selected pool. */
  poolFactCount?: number;
  /** Whether outside-due reviews were merged for this run. */
  includeOutsideDueReviews?: boolean;
  /** Per-domain answer tracking for auto-calibration. */
  domainAccuracy: Record<string, { answered: number; correct: number }>;
  /** Number of cards upgraded during this run. */
  cardsUpgraded: number;
  /** Cards removed via shop removal service this run. Affects removal price escalation. */
  cardsRemovedAtShop: number;
  /** Total haggle attempts this run (telemetry). */
  haggleAttempts: number;
  /** Successful haggle attempts this run (telemetry). */
  haggleSuccesses: number;
  /** Total questions answered this run (all tiers). */
  questionsAnswered: number;
  /** Total questions answered correctly this run (all tiers). */
  questionsCorrect: number;
  /** Novel (Tier 1) questions answered this run. */
  novelQuestionsAnswered: number;
  /** Novel (Tier 1) questions answered correctly this run. */
  novelQuestionsCorrect: number;
  /** Deterministic seed for this run (used in all modes for fair multiplayer/daily comparisons). */
  runSeed: number;
  /** In-run fact tracker for study mode (curated deck runs). Undefined for trivia runs. */
  inRunFactTracker?: InRunFactTracker;
  /**
   * Global turn counter that persists across encounters within a run.
   * Used by the Surge system so Surge timing varies per encounter rather than
   * always hitting on turn 2 of every fight. Initialized to 1 on new run.
   * Incremented each time the player ends their turn.
   */
  globalTurnCounter: number;
  /**
   * Soul Jar charges accumulated this run.
   * Gained when soul_jar relic is held and every 5th cumulative correct Charge is reached.
   * Spending 1 charge activates the GUARANTEED button — auto-succeeds the next quiz.
   */
  soulJarCharges: number;
  /**
   * AR-241: Per-fact variant progression level.
   * Maps factId → variant level (0=forward, 1=reverse, 2=synonym, 3=definition).
   * Incremented on correct Charge, decremented (min 0) on wrong Charge.
   * Independent of card tier — tracks mastery of the question format per fact.
   */
  factVariantLevel: Record<string, number>;
  /**
   * AR-273: Meditation Chamber — chain theme ID the player has meditated on.
   * When set, distractors for facts belonging to this chainThemeId are reduced by 1 (min 2).
   * Cleared on new run.
   */
  meditatedThemeId?: number;
}

export interface RunEndData {
  result: 'victory' | 'defeat' | 'retreat';
  floorReached: number;
  factsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  bestCombo: number;
  cardsEarned: number;
  newFactsLearned: number;
  factsMastered: number;
  encountersWon: number;
  encountersTotal: number;
  elitesDefeated: number;
  miniBossesDefeated: number;
  bossesDefeated: number;
  completedBounties: string[];
  duration: number;
  runDurationMs: number;
  rewardMultiplier: number;
  currencyEarned: number;
  /** Relics collected during the run. */
  relicsCollected?: number;
  /** Whether this was a practice run (player already mastered the material) — camp rewards disabled. */
  isPracticeRun: boolean;
}

export function createRunState(
  primary: FactDomain,
  secondary: FactDomain,
  options?: {
    selectedArchetype?: RewardArchetype;
    starterDeckSize?: number;
    startingAp?: number;
    primaryDomainRunNumber?: number;
    earlyBoostActive?: boolean;
    ascensionLevel?: number;
    deckMode?: DeckMode;
    deckMasteryPct?: number;
    rewardsDisabled?: boolean;
    poolRewardScale?: number;
    poolNoveltyPct?: number;
    poolFactCount?: number;
    includeOutsideDueReviews?: boolean;
  },
): RunState {
  const runSeed = crypto.getRandomValues(new Uint32Array(1))[0];
  const bountyCount = (crypto.getRandomValues(new Uint32Array(1))[0] % 2 === 0) ? 1 : 2;
  const ascensionLevel = options?.ascensionLevel ?? 0;
  const ascensionModifiers = getAscensionModifiers(ascensionLevel);
  const maxHp = ascensionModifiers.playerMaxHpOverride ?? PLAYER_MAX_HP;
  const starterDeckSize = ascensionModifiers.starterDeckSizeOverride ?? options?.starterDeckSize ?? 15;
  const runState: RunState = {
    isActive: true,
    primaryDomain: primary,
    secondaryDomain: secondary,
    selectedArchetype: options?.selectedArchetype ?? 'balanced',
    starterDeckSize,
    startingAp: options?.startingAp ?? 3,
    primaryDomainRunNumber: options?.primaryDomainRunNumber ?? 1,
    earlyBoostActive: options?.earlyBoostActive ?? true,
    floor: createFloorState(),
    playerHp: maxHp,
    playerMaxHp: maxHp,
    currency: 0,
    cardsEarned: 0,
    factsAnswered: 0,
    factsCorrect: 0,
    correctAnswers: 0,
    bestCombo: 0,
    newFactsLearned: 0,
    factsMastered: 0,
    encountersWon: 0,
    encountersTotal: 0,
    elitesDefeated: 0,
    miniBossesDefeated: 0,
    bossesDefeated: 0,
    currentEncounterWrongAnswers: 0,
    bounties: selectRunBounties(primary, secondary, bountyCount),
    canary: createCanaryState(),
    startedAt: Date.now(),
    firstChargeFreeFactIds: new Set<string>(),
    attemptedFactIds: new Set<string>(),
    cursedFactIds: new Set<string>(),
    consumedRewardFactIds: new Set<string>(),
    factsAnsweredCorrectly: new Set<string>(),
    factsAnsweredIncorrectly: new Set<string>(),
    runAccuracyBonusApplied: false,
    endlessEnemyDamageMultiplier: 1,
    ascensionLevel,
    ascensionModifiers,
    retreatRewardLocked: false,
    runRelics: [],
    offeredRelicIds: new Set<string>(),
    firstMiniBossRelicAwarded: false,
    relicPityCounter: 0,
    phoenixFeatherUsed: false,
    domainAccuracy: {},
    cardsUpgraded: 0,
    cardsRemovedAtShop: 0,
    haggleAttempts: 0,
    haggleSuccesses: 0,
    questionsAnswered: 0,
    questionsCorrect: 0,
    novelQuestionsAnswered: 0,
    novelQuestionsCorrect: 0,
    runSeed,
    globalTurnCounter: 1,
    soulJarCharges: 0,
    factVariantLevel: {},
    deckMode: options?.deckMode,
    deckMasteryPct: options?.deckMasteryPct,
    rewardsDisabled: options?.rewardsDisabled,
    poolRewardScale: options?.poolRewardScale ?? 1,
    poolNoveltyPct: options?.poolNoveltyPct,
    poolFactCount: options?.poolFactCount,
    includeOutsideDueReviews: options?.includeOutsideDueReviews ?? false,
  };

  // Study mode: initialize in-run fact tracker
  if (options?.deckMode?.type === 'study') {
    const tracker = new InRunFactTracker();
    const deckFacts = getCuratedDeckFacts(options.deckMode.deckId, options.deckMode.subDeckId, options.deckMode.examTags);
    const factIds = deckFacts.map(f => f.id);
    const reviewStates = get(playerSave)?.reviewStates ?? [];
    tracker.seedFromGlobalFSRS(factIds, (factId: string) => {
      const reviewState = reviewStates.find((rs) => rs.factId === factId);
      return reviewState?.stability;
    });
    runState.inRunFactTracker = tracker;
  }

  return runState;
}

export function recordCardPlay(
  state: RunState,
  correct: boolean,
  streakCount: number,
  factId?: string,
  domain?: string,
  isNovel?: boolean,
): void {
  state.factsAnswered += 1;
  state.questionsAnswered += 1;
  if (correct) {
    state.factsCorrect += 1;
    state.questionsCorrect += 1;
    state.cardsEarned += 1;
    if (factId) {
      state.factsAnsweredCorrectly.add(factId);
      state.factsAnsweredIncorrectly.delete(factId);
    }
  } else {
    state.currentEncounterWrongAnswers += 1;
    if (factId) {
      state.factsAnsweredIncorrectly.add(factId);
      state.factsAnsweredCorrectly.delete(factId);
    }
  }
  if (isNovel) {
    state.novelQuestionsAnswered += 1;
    if (correct) state.novelQuestionsCorrect += 1;
  }
  state.correctAnswers = state.factsCorrect;
  state.canary = recordCanaryAnswer(state.canary, correct);
  if (streakCount > state.bestCombo) state.bestCombo = streakCount;
  if (domain) {
    if (!state.domainAccuracy[domain]) {
      state.domainAccuracy[domain] = { answered: 0, correct: 0 };
    }
    state.domainAccuracy[domain].answered += 1;
    if (correct) state.domainAccuracy[domain].correct += 1;
  }
}

export function damagePlayer(state: RunState, amount: number): number {
  state.playerHp = Math.max(0, state.playerHp - amount);
  return state.playerHp;
}

export function healPlayer(state: RunState, amount: number): number {
  state.playerHp = Math.min(state.playerMaxHp, state.playerHp + amount);
  return state.playerHp;
}

export function isDefeated(state: RunState): boolean {
  return state.playerHp <= 0;
}

export function endRun(state: RunState, reason: 'victory' | 'defeat' | 'retreat'): RunEndData {
  state.isActive = false;

  const duration = Date.now() - state.startedAt;
  const accuracy = state.factsAnswered > 0
    ? Math.round((state.factsCorrect / state.factsAnswered) * 100)
    : 0;

  const segment = getSegment(state.floor.currentFloor);
  const deathPenalty = reason === 'defeat' ? DEATH_PENALTY[segment] : 1.0;
  const mode = get(difficultyMode);
  const difficultyBonus = DIFFICULTY_REWARD_MULTIPLIER[mode] ?? 1.0;
  const masteryRewardScale = (state.deckMasteryPct ?? 0) > 0
    ? getRewardMultiplier(state.deckMasteryPct ?? 0)
    : 1.0;
  const poolRewardScale = state.poolRewardScale ?? 1.0;
  const rewardMultiplier = deathPenalty * difficultyBonus * masteryRewardScale * poolRewardScale;
  const completedBounties = state.bounties.filter((bounty) => bounty.completed).map((bounty) => bounty.name);
  const rewardsSuppressed = (reason === 'retreat' && state.retreatRewardLocked) || state.rewardsDisabled;
  const practiceRun = isPracticeRun(state);
  const bountyBonusCurrency = (rewardsSuppressed || practiceRun) ? 0 : completedBounties.length * 20;
  const baseCurrency = (rewardsSuppressed || practiceRun) ? 0 : (state.currency + bountyBonusCurrency);
  const currencyEarned = Math.floor(baseCurrency * rewardMultiplier);

  return {
    result: reason,
    floorReached: state.floor.currentFloor,
    factsAnswered: state.factsAnswered,
    correctAnswers: state.factsCorrect,
    accuracy,
    bestCombo: state.bestCombo,
    cardsEarned: state.cardsEarned,
    newFactsLearned: state.newFactsLearned,
    factsMastered: state.factsMastered,
    encountersWon: state.encountersWon,
    encountersTotal: state.encountersTotal,
    elitesDefeated: state.elitesDefeated,
    miniBossesDefeated: state.miniBossesDefeated,
    bossesDefeated: state.bossesDefeated,
    completedBounties,
    duration,
    runDurationMs: duration,
    rewardMultiplier,
    currencyEarned,
    relicsCollected: state.runRelics.length,
    isPracticeRun: practiceRun,
  };
}
