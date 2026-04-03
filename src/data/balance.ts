import type { DifficultyMode } from '../services/cardPreferences'

/** All tunable game balance numbers. Change here, affects everything. */
export const BALANCE = {
  // === QUIZ ===
  QUIZ_DISTRACTORS_SHOWN: 3,         // 3 wrong + 1 correct = 4 choices
  QUIZ_GATE_MAX_FAILURES: 2,

  // === SM-2 DEFAULTS ===
  SM2_INITIAL_EASE: 2.5,
  SM2_MIN_EASE: 1.3,
  SM2_LEARNING_STEPS: [1, 10] as number[],
  SM2_RELEARNING_STEPS: [10] as number[],
  SM2_GRADUATING_INTERVAL: 1,
  SM2_EASY_INTERVAL: 4,
  SM2_LAPSE_NEW_INTERVAL_PCT: 0.70,
  SM2_LEECH_THRESHOLD: 8,

  // === REVIEW RITUALS ===
  MORNING_REVIEW_HOUR: 7,               // 7 AM - 11 AM
  MORNING_REVIEW_END: 11,
  EVENING_REVIEW_HOUR: 19,              // 7 PM - 11 PM
  EVENING_REVIEW_END: 23,
  RITUAL_BONUS_GREY_MATTER: 25,         // bonus grey matter for completing a ritual
  RITUAL_CARD_COUNT: 5,                 // cards per ritual session
  MORNING_REVIEW_FACT_COUNT: 5,       // Facts required to claim morning bonus
  EVENING_REVIEW_FACT_COUNT: 5,       // Facts required to claim evening bonus
  STRUGGLE_WRONG_THRESHOLD: 3,       // Wrong count before GAIA shows mnemonic

  // === STREAK SYSTEM ===
  STREAK_FREEZE_MAX: 3,

  // === GRACE PERIOD (DD-V2-158) ===
  GRACE_PERIOD_WINDOW_DAYS: 30,
  GRACE_PERIOD_MAX_PER_WINDOW: 1,

  // === GACHA ANIMATION TIERS (Phase 17.1) ===
  GACHA_TIERS: {
    common:   { durationMs: 400,  particleCount: 0,   screenFlash: false, screenShake: false, soundKey: 'reveal_common',    bgColor: '#1a1a2e', glowColor: '#888888', labelText: 'Common Find' },
    uncommon: { durationMs: 600,  particleCount: 8,   screenFlash: false, screenShake: false, soundKey: 'reveal_uncommon',  bgColor: '#1a2e1a', glowColor: '#4ec9a0', labelText: 'Uncommon Discovery' },
    rare:     { durationMs: 900,  particleCount: 20,  screenFlash: true,  screenShake: false, soundKey: 'reveal_rare',      bgColor: '#1a1a3e', glowColor: '#4a9eff', labelText: 'Rare Artifact!' },
    epic:     { durationMs: 1400, particleCount: 40,  screenFlash: true,  screenShake: false, soundKey: 'reveal_epic',      bgColor: '#2a1a3e', glowColor: '#cc44ff', labelText: 'EPIC ARTIFACT!!' },
    legendary:{ durationMs: 2200, particleCount: 80,  screenFlash: true,  screenShake: true,  soundKey: 'reveal_legendary', bgColor: '#2a1a00', glowColor: '#ffd700', labelText: 'LEGENDARY!!!' },
    mythic:   { durationMs: 3500, particleCount: 150, screenFlash: true,  screenShake: true,  soundKey: 'reveal_mythic',    bgColor: '#1a0a2e', glowColor: '#ff44aa', labelText: 'MYTHIC' },
  } as const,

  // === MASTERY CELEBRATIONS (DD-V2-108, DD-V2-119) ===
  MASTERY_CELEBRATION_THRESHOLDS: [
    { count: 1,   tier: 'fullscreen', greyMatterBonus: 0,    title: null,            gaiaKey: 'firstMastery' },
    { count: 5,   tier: 'mini',       greyMatterBonus: 15,   title: null,            gaiaKey: 'mastery5' },
    { count: 10,  tier: 'banner',     greyMatterBonus: 50,   title: null,            gaiaKey: 'mastery10' },
    { count: 25,  tier: 'medium',     greyMatterBonus: 100,  title: 'Scholar',       gaiaKey: 'mastery25' },
    { count: 50,  tier: 'medium',     greyMatterBonus: 200,  title: 'Researcher',    gaiaKey: 'mastery50' },
    { count: 100, tier: 'major',      greyMatterBonus: 500,  title: 'Archivist',     gaiaKey: 'mastery100' },
    { count: 250, tier: 'major',      greyMatterBonus: 1000, title: 'Encyclopedist', gaiaKey: 'mastery250' },
    { count: 500, tier: 'fullscreen', greyMatterBonus: 2500, title: 'Omniscient',    gaiaKey: 'mastery500' },
  ] as const,

  // === NEAR-MISS MESSAGES (Phase 17.1) ===
  NEAR_MISS_MESSAGES: {
    epic_nearLegendary: [
      'Almost Legendary! Epic is still incredible.',
      'So close to Legendary! An Epic find is a win.',
      'Just one tier away from Legendary. Epic it is!',
    ],
    legendary_nearMythic: [
      'Legendary! Mythic is rarer than this world deserves.',
      'Legendary -- you were this close to Mythic.',
      'A Legendary find. Mythic is out there somewhere...',
    ],
  } as const,

  // === SESSION DESIGN (Phase 17.3, DD-V2-135/137/141) ===
  SESSION_QUICK_TARGET_MS: 5 * 60 * 1000,
  SESSION_DEEP_TARGET_MS: 15 * 60 * 1000,
  SESSION_COZY_TARGET_MS: 3 * 60 * 1000,

  // === COMBAT SYSTEM (Phase 36) ===
  COMBAT_PLAYER_BASE_HP: 100,
  COMBAT_PLAYER_HP_PER_LAYER: 5,
  COMBAT_BASE_PLAYER_ATTACK: 20,
  COMBAT_BASE_PLAYER_DEFENSE: 10,
  COMBAT_QUIZ_ATTACK_MULTIPLIER: 1.5,
  COMBAT_DEFEND_DAMAGE_REDUCTION: 0.5,

  // === CHALLENGE MODE (DD-V2-052) ===
  CHALLENGE_SPEED_SECONDS: 8,
  CHALLENGE_GATE_LAYER_THRESHOLD: 15,
  CHALLENGE_STREAK_MILESTONES: [10, 25, 50, 100] as const,
  CHALLENGE_STREAK_PRESTIGE_POINTS: { 10: 5, 25: 15, 50: 40, 100: 100 } as Record<number, number>,

  // === ACTIVATION CAP ===
  ACTIVATION_CAP_BASE: 5,          // Starting max new+learning cards
  ACTIVATION_CAP_PER_MASTERED: 1,  // +1 cap per N mastered
  ACTIVATION_CAP_MASTERED_DIVISOR: 5,  // per 5 mastered cards
  ACTIVATION_CAP_MAX: 20,         // Hard ceiling

  // === WORKLOAD MANAGEMENT ===
  NEW_CARDS_PER_SESSION: 3,          // Max new cards introduced per study session
  NEW_CARD_THROTTLE_RATIO: 3,       // Suppress new cards if dueReviews > ratio × newCardsToday
} as const

/**
 * Compute adaptive new card limit based on review backlog.
 * Low backlog = more new cards (up to 5), high backlog = fewer (down to 2).
 * Replaces static NEW_CARDS_PER_SESSION in study flows.
 */
export function getAdaptiveNewCardLimit(dueReviewCount: number): number {
  const base = BALANCE.NEW_CARDS_PER_SESSION // 3
  if (dueReviewCount <= 5) return Math.min(base + 2, 5)   // low backlog: up to 5
  if (dueReviewCount >= 15) return Math.max(base - 1, 2)  // high backlog: down to 2
  return base                                               // normal: 3
}

// Anki-faithful learning step constants
export const SM2_LEARNING_STEPS = [1, 10]          // minutes (Anki default: 1m, 10m)
export const SM2_RELEARNING_STEPS = [10]            // minutes (Anki default: 10m)
export const SM2_GRADUATING_INTERVAL = 1            // days — interval when Good on final learning step
export const SM2_EASY_INTERVAL = 4                  // days — interval when Easy during learning
export const SM2_LAPSE_NEW_INTERVAL_PCT = 0.70      // 70% of old interval preserved after lapse
export const SM2_LEECH_THRESHOLD = 8                // lapses before leech flag
export const SM2_EASY_BONUS_MULTIPLIER = 1.3        // Good button: interval * ease * 1.3

export const ACTIVATION_CAP_BASE = BALANCE.ACTIVATION_CAP_BASE
export const ACTIVATION_CAP_PER_MASTERED = BALANCE.ACTIVATION_CAP_PER_MASTERED
export const ACTIVATION_CAP_MASTERED_DIVISOR = BALANCE.ACTIVATION_CAP_MASTERED_DIVISOR
export const ACTIVATION_CAP_MAX = BALANCE.ACTIVATION_CAP_MAX
export const NEW_CARDS_PER_SESSION = BALANCE.NEW_CARDS_PER_SESSION
export const NEW_CARD_THROTTLE_RATIO = BALANCE.NEW_CARD_THROTTLE_RATIO
export const SM2_STARTING_FACTS_COUNT = 5           // facts seeded for new players
export const SM2_DAILY_NEW_LIMIT = 10               // max new cards introduced per day/session

// ---- SM-2 Tuning Constants (DD-V2-085, DD-V2-095) ----
export const SM2_SECOND_INTERVAL_DAYS = 3          // second interval: 3 days (default SM-2 = 6)
export const SM2_CONSISTENCY_PENALTY_REPS_MIN = 4  // minimum reps before penalty applies
export const SM2_MASTERY_INTERVAL_GENERAL = 60     // days — general fact mastered threshold
export const SM2_MASTERY_INTERVAL_VOCAB = 40       // days — vocab fact mastered threshold (raised from 30, playtest 002)

// === PHASE 53: LEARNING SPARKS ===

export const LEARNING_SPARKS_PER_MILESTONE = {
  /** Fact reaches 'familiar' mastery. */
  fact_familiar: 1,
  /** Fact reaches 'known' mastery. */
  fact_known: 3,
  /** Fact reaches 'mastered' mastery. */
  fact_mastered: 5,
  /** Branch reaches 25% explored. */
  branch_25_pct: 10,
  /** Branch reaches 50% explored. */
  branch_50_pct: 20,
  /** Branch reaches 100% explored. */
  branch_100_pct: 25,
} as const

// === PHASE 42: ASO — REVIEW PROMPT TRIGGERS ===

/** Review prompt trigger thresholds. All must be met before the prompt fires. */
export const REVIEW_PROMPT_TRIGGERS = {
  /** Minimum dives completed before the review prompt is eligible. */
  minDives: 5,
  /** Minimum facts mastered before the review prompt is eligible. */
  minFactsMastered: 10,
  /** Cooldown in days between prompt appearances. */
  cooldownDays: 90,
} as const

// ============================================================
// STUDY PRESETS & DECK BUILDER
// ============================================================

/** Below this fact count: warn "no loot, no leaderboard" (soft limit). */
export const MIN_FAIR_POOL_SIZE = 40;
/** If fewer than this % of pool facts are unmastered: warn "mostly mastered". */
export const MIN_NOVEL_FACTS_PCT = 0.25;
/** Maximum number of saved study presets per player. */
export const MAX_PRESETS = 50;
/** Maximum character length for a preset name. */
export const MAX_PRESET_NAME_LENGTH = 30;
/** Reward multiplier tiers keyed by selected run-pool fact count. */
export const POOL_SIZE_REWARD_MULTIPLIERS = [
  { minFacts: 120, multiplier: 1.0 },
  { minFacts: 80, multiplier: 0.9 },
  { minFacts: 40, multiplier: 0.75 },
  { minFacts: 20, multiplier: 0.55 },
  { minFacts: 0, multiplier: 0.35 },
] as const;
/** Apply an extra modest reward reduction when novelty is very low. */
export const LOW_NOVELTY_THRESHOLD = 0.2;
/** Multiplier applied when novelty falls below LOW_NOVELTY_THRESHOLD. */
export const LOW_NOVELTY_REWARD_MULTIPLIER = 0.9;
/** Extremely tiny pools suppress rewards entirely to block farm loops. */
export const TINY_POOL_REWARD_SUPPRESSION_THRESHOLD = 8;

/** Mastery scaling thresholds and multipliers for anti-cheat. */
export const MASTERY_SCALING = {
  /** Mastery percentage thresholds (ascending). */
  thresholds: [0.40, 0.60, 0.80, 0.95] as const,
  /** Reward multipliers corresponding to each threshold band. */
  rewardMultipliers: [1.0, 0.85, 0.65, 0.40] as const,
  /** Extra virtual floors added to timer/difficulty at each band. */
  difficultyBoostFloors: [0, 1, 2, 4] as const,
};

// ============================================================
// CARD ROGUELITE BALANCE (CR-01)
// ============================================================

// Card Combat
export const HAND_SIZE = 5;
export const DEFAULT_POOL_SIZE = 120;
export const POOL_PRIMARY_PCT = 0.30;
export const POOL_SECONDARY_PCT = 0.25;
export const POOL_REVIEW_PCT = 0.30;
export const POOL_SUBCATEGORY_MAX_PCT = 0.35;

// Base effect values by card type
// Uses Record<string, number> instead of Record<CardType, number> to avoid
// circular imports (balance.ts should NOT import from card-types.ts).
export const BASE_EFFECT: Record<string, number> = {
  attack: 4,
  shield: 3,
  utility: 0,
  buff: 0,
  debuff: 0,
  wild: 0,
};

// Tier multipliers — Tier 3 is passive (no active effect value)
export const TIER_MULTIPLIER: Record<'1' | '2a' | '2b' | '3', number> = {
  '1': 1.0,
  '2a': 1.3,
  '2b': 1.6,
  '3': 0,
};

// Legacy compatibility for numeric-tier callers.
export const LEGACY_TIER_MULTIPLIER: Record<1 | 2 | 3, number> = {
  1: TIER_MULTIPLIER['1'],
  2: TIER_MULTIPLIER['2a'],
  3: TIER_MULTIPLIER['3'],
};

/**
 * Flat Charge Correct multiplier applied to quickPlayValue. The real power scaling
 * comes from mastery level bonuses (getMasteryBaseBonus) and tier multipliers (T1=1.0×,
 * T2a=1.3×, T2b=1.6×), NOT from increasing this multiplier. Nerfed to 1.75× (from 2.0×)
 * in 2026-04-01 balance pass to reduce expert player damage output (dedicated 100% → ~85-95% target).
 *
 * Runtime formula: CC damage = (quickPlayValue + masteryBonus) × 1.75 × tierMult × chainMult × ...
 *
 * Note: The `chargeCorrectValue` field in mechanics.ts is DEAD DATA — the resolver
 * always computes CC as quickPlayValue × this constant. Do not read chargeCorrectValue.
 */
export const CHARGE_CORRECT_MULTIPLIER = 1.75;

/** @deprecated Use CHARGE_CORRECT_MULTIPLIER instead. Kept for backward compat. */
export const CHARGE_CORRECT_MULTIPLIERS: Record<string, number> = {
  '1': 1.75,
  '2a': 1.75,
  '2b': 1.75,
  '3': 1.75,
};

/** Charge play multipliers for wrong answers, by tier. */
export const CHARGE_WRONG_MULTIPLIERS: Record<string, number> = {
  '1': 0.8,
  '2a': 0.85,
  '2b': 0.85,
  '3': 0.75,
};

// ─── Mastery Upgrade System (AR-113) ───────────────────────────────────────

/** Maximum mastery level a card can reach in a run. */
export const MASTERY_MAX_LEVEL = 5;

/** Number of distractors for cards at mastery level 0. */
export const MASTERY_BASE_DISTRACTORS = 2;

/** Number of distractors for cards at mastery level 1+. */
export const MASTERY_UPGRADED_DISTRACTORS = 3;

/** Mastery level colors for the upgrade icon. */
export const MASTERY_LEVEL_COLORS: Record<number, string> = {
  0: 'none',
  1: '#22c55e', // green
  2: '#3b82f6', // blue
  3: '#a855f7', // purple
  4: '#f97316', // orange
  5: '#eab308', // gold
};

/** Passive bonus values for Tier 3 mastered cards by card type. */
export const TIER3_PASSIVE_VALUE: Record<string, number> = {
  attack: 1,    // +1 flat damage to all attacks
  shield: 1,    // +1 flat block to all shields
  utility: 1,   // +1 extra card drawn at turn start (capped)
  buff: 2,      // +2% to next card buff baseline
  debuff: 1,    // +1 to debuff potency
  wild: 1,      // +1 to wild card effect
};

export const TIER3_PASSIVE = TIER3_PASSIVE_VALUE;

export const MASTERY_TRIAL = {
  TIMER_SECONDS: 4,
  ANSWER_OPTIONS: 5,
  REQUIRED_STABILITY: 30,
  REQUIRED_CONSECUTIVE_CORRECT: 7,
  USE_HARDEST_VARIANT: true,
  SLOW_READER_BONUS: false,
} as const;

export const TIER_QUESTION_FORMAT: Record<'1' | '2a' | '2b' | '3', {
  options: number;
  allowReverse: boolean;
  allowFillBlank: boolean;
  useCloseDistractors: boolean;
}> = {
  '1': { options: 3, allowReverse: false, allowFillBlank: false, useCloseDistractors: false },
  '2a': { options: 4, allowReverse: true, allowFillBlank: false, useCloseDistractors: false },
  '2b': { options: 5, allowReverse: true, allowFillBlank: true, useCloseDistractors: true },
  '3': { options: 0, allowReverse: false, allowFillBlank: false, useCloseDistractors: false },
};

// Knowledge Chain system (AR-59.3)
/**
 * Damage multipliers per chain length.
 * Index 0 = no card played yet (1.0×), 1 = first card (1.2×), 2 = second same-domain (1.5×), etc.
 * Rebalanced 2026-04-01: earlier bonus kick-in (1.2× at length 1 instead of 1.0×)
 * and stronger top-end (3.5× at max instead of 3.0×) to reward chain building more.
 */
export const CHAIN_MULTIPLIERS: number[] = [1.0, 1.2, 1.5, 2.0, 2.5, 3.5];
/** Maximum chain length (after which the multiplier stays at the last value). */
export const MAX_CHAIN_LENGTH = 5;

/**
 * How many chain length points are lost per turn instead of full reset.
 * 1 = chains decay by 1 each turn end (instead of resetting to 0).
 * This rewards building chains across turns rather than fully losing momentum.
 */
export const CHAIN_DECAY_PER_TURN = 1;

// Knowledge Surge system (AR-59.4)
/** Turn number of the first Surge turn per encounter. */
export const SURGE_FIRST_TURN = 2;
/** Number of turns between Surge turns. */
export const SURGE_INTERVAL = 4;
/**
 * On Surge turns, the Charge Correct multiplier is boosted by this factor.
 * 1.5 = 50% bonus on top of CHARGE_CORRECT_MULTIPLIER (e.g. 2.0 × 1.5 = 3.0× effective).
 */
export const SURGE_CC_BONUS_MULTIPLIER = 1.5;
/** Extra cards drawn at the start of a Surge turn. */
export const SURGE_DRAW_BONUS = 1;

// Chain Momentum system (AR-122)
/** When true, a correct Charge answer waives the AP surcharge on the NEXT Charge that turn. */
export const CHAIN_MOMENTUM_ENABLED = true;

/**
 * AP surcharge for Charge plays (added on top of card's base apCost).
 * Set to 0 — Charge plays cost the same AP as Quick Play.
 * The risk/reward comes from the accuracy check, not tempo loss.
 */
export const CHARGE_AP_SURCHARGE = 0;

// Free First Charge system (AR-59.23)
/** AP surcharge for the first Charge of a fact in a run. 0 = free. */
export const FIRST_CHARGE_FREE_AP_SURCHARGE = 0;
/**
 * Damage multiplier for a wrong answer on the first free Charge.
 * 0.0× — card fizzles completely. The cost of guessing wrong on an unknown fact.
 */
export const FIRST_CHARGE_FREE_WRONG_MULTIPLIER = 0.0;

// ─── AR-221: Quiz Panel Redesign — Auto-Resume Timing ──────────────────────

/** Delay (ms) before auto-resuming after a correct answer. */
export const CORRECT_ANSWER_RESUME_DELAY = 1000;
/** Base delay (ms) before auto-resuming after a wrong answer. */
export const WRONG_ANSWER_RESUME_BASE = 1500;
/** Additional ms per character in the correct answer string. */
export const WRONG_ANSWER_RESUME_PER_CHAR = 30;
/** Maximum auto-resume delay (ms) after a wrong answer. */
export const WRONG_ANSWER_RESUME_MAX = 5000;

// === CURSED CARD SYSTEM (AR-202) ===
/** QP multiplier when a card carries a cursed fact. */
export const CURSED_QP_MULTIPLIER = 0.7;
/** Charge Correct multiplier when a card carries a cursed fact (1.0 = normal — the reward IS the cure). */
export const CURSED_CHARGE_CORRECT_MULTIPLIER = 1.0;
/** Charge Wrong multiplier when a card carries a cursed fact. */
export const CURSED_CHARGE_WRONG_MULTIPLIER = 0.5;
/** FSRS repetition bonus applied on cure (correct Charge on a cursed fact). */
export const CURSED_FSRS_CURE_BONUS = 6.0;
/**
 * Auto-cure safety valve threshold. If the ratio of cursed cards in the drawn
 * hand meets or exceeds this value across 2 consecutive draws, auto-cure the
 * oldest cursed fact at encounter end (1 fact per trigger).
 */
export const CURSED_AUTO_CURE_THRESHOLD = 0.6;
/** Number of cursed facts auto-cured when the threshold is triggered. */
export const CURSED_AUTO_CURE_COUNT = 1;

// Player defaults
export const PLAYER_START_HP = 100;
export const PLAYER_MAX_HP = 100;
export const HINTS_PER_ENCOUNTER = 1;
export const START_AP_PER_TURN = 3;
export const MAX_AP_PER_TURN = 5;

// Post-encounter healing disabled — healing comes from potions only
/** Fraction of max HP healed after each non-defeat encounter. Set to 0: no auto-heal. */
export const POST_ENCOUNTER_HEAL_PCT = 0;
/** Extra healing fraction for Relaxed mode (additive with POST_ENCOUNTER_HEAL_PCT). Set to 0: no auto-heal. */
export const RELAXED_POST_ENCOUNTER_HEAL_BONUS = 0;
/** Extra healing fraction after defeating a boss or mini-boss (AR-32, additive). Set to 0: no auto-heal. */
export const POST_BOSS_ENCOUNTER_HEAL_BONUS = 0;
/** Maximum HP percentage players can heal TO via post-encounter healing, by segment.
 *  Players below this threshold heal normally; players above it gain nothing.
 *  This creates late-game attrition so winners don't cruise at 99% HP. */
export const POST_ENCOUNTER_HEAL_CAP: Record<number, number> = {
  1: 1.00,   // Segment 1 (floors 1-6): full heal allowed
  2: 0.80,   // Segment 2 (floors 7-12): cap at 80% (tightened from 0.90)
  3: 0.50,   // Segment 3 (floors 13-18): cap at 50%
  4: 0.30,   // Segment 4 (floors 19-24): cap at 30%
};
/** Global base HP multiplier for all enemies. Ensures early fights require 2+ turns. */
export const ENEMY_BASE_HP_MULTIPLIER = 4.0;
/**
 * HP scaling per floor above floor 1. Each floor adds this fraction to the base HP multiplier.
 * @deprecated Use ENEMY_HP_SCALING_PER_FLOOR_BY_SEGMENT for segment-aware scaling.
 */
export const ENEMY_HP_SCALING_PER_FLOOR = 0.18;
/** HP scaling per floor, by segment. Early floors gentle, late floors steep. */
export const ENEMY_HP_SCALING_PER_FLOOR_BY_SEGMENT: Record<number, number> = {
  1: 0.10,   // Segment 1 (floors 1-6): gentle — QP-able early enemies
  2: 0.25,   // Segment 2 (floors 7-12): moderate — charging starts to matter
  3: 0.60,   // Segment 3 (floors 13-18): steep — must charge + chain to win
  4: 0.80,   // Segment 4 (floors 19-24): wall — full mastery required
};
/** HP multiplier for mini-bosses on floors 1-3 (1.0 = no reduction, proper base HP handles early balance). */
export const EARLY_MINI_BOSS_HP_MULTIPLIER = 1.0;

// === AUTO-CALIBRATION (Difficulty Calibration System) ===
/** Maximum per-domain offset magnitude from auto-calibration. */
export const AUTO_CALIBRATE_MAX_OFFSET = 0.20;
/** Offset step per run when auto-calibration triggers. */
export const AUTO_CALIBRATE_STEP = 0.05;
/** Accuracy threshold above which difficulty shifts up. */
export const AUTO_CALIBRATE_ACCURACY_HIGH = 80;
/** Accuracy threshold below which difficulty shifts down. */
export const AUTO_CALIBRATE_ACCURACY_LOW = 50;
/** Minimum answers in a domain for auto-calibration to trigger. */
export const AUTO_CALIBRATE_MIN_ANSWERS = 5;

// === CANARY ADAPTIVE DIFFICULTY ===
/** Canary deep-assist enemy damage multiplier (severe struggling). */
export const CANARY_DEEP_ASSIST_ENEMY_DMG_MULT = 0.65;
/** Wrong answers on a floor to trigger deep assist. */
export const CANARY_DEEP_ASSIST_WRONG_THRESHOLD = 5;
/** Canary assist enemy damage multiplier (moderate struggling). */
export const CANARY_ASSIST_ENEMY_DMG_MULT = 0.80;
/** Wrong answers on a floor to trigger assist mode. */
export const CANARY_ASSIST_WRONG_THRESHOLD = 3;
/** Enemy damage multiplier for challenge mode (5+ correct streak). */
export const CANARY_CHALLENGE_ENEMY_DMG_MULT = 1.1;
/** Correct answer streak threshold to trigger challenge mode. */
export const CANARY_CHALLENGE_STREAK_THRESHOLD = 5;

/** Per-floor enemy damage scaling increment above floor 6. (AR-97b: 0.05→0.02, sweep r=+0.668; 2026-04-01: 0.02→0.06 to steepen late-game curve — floor 12 = +36%, floor 18 = +72%; reverted 2026-04-01: 0.06→0.03 — enemy HP scaling is the better lever; 2026-04-01: 0.03→0.06 — paired with FLOOR_DAMAGE_SCALE_MID 0.8→0.5 to keep early floors easy while steepening late-game pressure for experts) */
export const FLOOR_DAMAGE_SCALING_PER_FLOOR = 0.06;

/** Enemy damage multiplier for floors 1–6 (base). Reverted to 1.0 on 2026-04-01, raised to 1.2 on 2026-04-03 (balance pass #1), reduced to 1.0 on 2026-04-03 (balance pass #2 — Act 2/3 over-tuned; reducing flat multiplier gives more room under caps). Prior values: 0.5 (2026-04-01), 0.8, 1.0 (original), 1.2. */
export const FLOOR_DAMAGE_SCALE_MID = 1.0;

/** Per-turn enemy damage caps by segment. Applied in executeEnemyIntent(). */
export const ENEMY_TURN_DAMAGE_CAP: Record<1 | 2 | 3 | 4 | 'endless', number | null> = {
  1: 8,    // kept from pass #2 (2026-04-03): raised from original 6, feels better
  2: 12,   // reverted to original — balance pass #3 (2026-04-03): common HP reduction makes this sufficient
  3: 18,   // reverted to original — balance pass #3 (2026-04-03)
  4: 28,   // reverted to original — balance pass #3 (2026-04-03)
  endless: null,
};

// Speed scaling (timer in seconds by floor)
export const FLOOR_TIMER: Array<{ maxFloor: number; seconds: number }> = [
  { maxFloor: 6,        seconds: 12 },   // Segment 1: Shallow Depths
  { maxFloor: 12,       seconds: 9 },    // Segment 2: Deep Caverns
  { maxFloor: 18,       seconds: 7 },    // Segment 3: The Abyss
  { maxFloor: 24,       seconds: 5 },    // Segment 4: The Archive
  { maxFloor: Infinity, seconds: 4 },    // Endless
];

// Q&A brevity limits — enforced by generation prompts and validation pipeline
export const QA_LIMITS = {
  /** Max words for base quizQuestion */
  QUESTION_MAX_WORDS: 12,
  /** Max words for any answer option (correct or distractor) */
  ANSWER_MAX_WORDS: 5,
  /** Max characters for any answer option */
  ANSWER_MAX_CHARS: 30,
  /** Max characters for distractors specifically */
  DISTRACTOR_MAX_CHARS: 30,
  /** Minimum distractors per fact (top-level pool) */
  DISTRACTOR_MIN_COUNT: 8,
  /** Maximum distractors per fact (top-level pool) */
  DISTRACTOR_MAX_COUNT: 12,
  /** Minimum variants per knowledge fact */
  VARIANT_MIN_COUNT: 4,
  /** Target variants per knowledge fact */
  VARIANT_TARGET_COUNT: 5,
  /** Answer options must be within this tolerance of each other's char count */
  SIMILAR_LENGTH_TOLERANCE: 0.20,
  /** Per-variant-type question word limits */
  VARIANT_QUESTION_MAX_WORDS: {
    forward: 12,
    reverse: 15,
    negative: 10,
    fill_blank: 15,
    true_false: 15,
    context: 15,
  },
  /** Per-variant-type answer word limits */
  VARIANT_ANSWER_MAX_WORDS: {
    forward: 5,
    reverse: 4,
    negative: 5,
    fill_blank: 3,
    true_false: 1,
    context: 4,
  },
} as const;

/** Segment-based enrage turn budgets. Enrage starts earlier in deeper floors. */
export const ENRAGE_SEGMENTS: { maxFloor: number; startTurn: number }[] = [
  { maxFloor: 6, startTurn: 12 },       // Shallow Depths (extended from 10 on 2026-04-01: more breathing room at 100 HP)
  { maxFloor: 12, startTurn: 6 },       // Deep Caverns (earlier from 8: harder mid-late)
  { maxFloor: 18, startTurn: 5 },       // The Abyss (earlier from 7: harder late)
  { maxFloor: 24, startTurn: 4 },       // The Archive (earlier from 6: hardest late)
  { maxFloor: Infinity, startTurn: 5 }, // Endless
];

/** +1 damage per turn for the first 3 enrage turns. Reduced from 2 on 2026-04-01 — slower enrage ramp helps beginners at 100 HP. */
export const ENRAGE_PHASE1_BONUS = 1;
/** +2 damage per turn after 3 enrage turns. Reduced from 4 on 2026-04-01 — less punishing late enrage at 100 HP. */
export const ENRAGE_PHASE2_BONUS = 3;
/** Number of turns at phase 1 bonus before escalating to phase 2. */
export const ENRAGE_PHASE1_DURATION = 3;
/** Enemy HP threshold below which they gain bonus damage (desperate attack). */
export const ENRAGE_LOW_HP_THRESHOLD = 0.30;
/** Bonus damage per turn when enemy is below HP threshold. */
export const ENRAGE_LOW_HP_BONUS = 3;

/** @deprecated Use ENRAGE_SEGMENTS instead. Kept for headless sim compatibility. */
export const SOFT_ENRAGE_START_TURN = 10;
/** @deprecated Use ENRAGE_SEGMENTS instead. */
export const SOFT_ENRAGE_PHASE2_TURN = 15;
/** @deprecated Use ENRAGE_PHASE1_BONUS instead. */
export const SOFT_ENRAGE_PHASE1_BONUS = 2;
/** @deprecated Use ENRAGE_PHASE2_BONUS instead. */
export const SOFT_ENRAGE_PHASE2_BONUS = 5;

// Speed bonus
export const SPEED_BONUS_THRESHOLD = 0.25;    // answer in first 25% of timer
export const SPEED_BONUS_MULTIPLIER = 1.5;

/** Wrong answer still applies this fraction of card effect (0 = full fizzle, 1 = no penalty).
 * Reverted from 0.5 back to 0.25 — at 0.5× fizzle damage exceeded quick play, undermining
 * knowledge-as-power mechanic (BATCH-2026-04-02-004 H-2). */
export const FIZZLE_EFFECT_RATIO = 0.25;

// === BOSS QUIZ PHASE SYSTEM (AR-59.7) ===

/**
 * Configuration for a single boss quiz phase.
 */
export interface BossQuizPhaseConfig {
  /** HP fraction (0–1) at which this phase triggers. Lower = triggers when boss is lower HP. */
  hpThreshold: number;
  /** Number of quiz questions shown during this phase. */
  questionCount: number;
  /** True = rapid-fire: effects applied per-answer. False = effects applied at phase end. */
  rapidFire: boolean;
  /** True = draws from the player's weakest categoryL2 knowledge domain. */
  useWeakestDomain: boolean;
  /**
   * Optional per-answer timer override in milliseconds.
   * null = use the standard encounter timer. Rapid-fire phases often use 4000ms.
   */
  timerOverrideMs?: number | null;
  /** Rewards for correct answers during this phase. */
  rewards: {
    /** Fraction of boss's current HP to drain per correct answer. */
    correctHpDrainPct?: number;
    /** Flat damage per correct answer. */
    correctDirectDamage?: number;
    /** True = grant a random buff per correct answer. */
    correctRandomBuff?: boolean;
  };
  /** Penalties for wrong answers during this phase. */
  penalties: {
    /** Strength stacks to add to boss per wrong answer. */
    wrongStrengthGain?: number;
    /** HP to restore to boss per wrong answer. */
    wrongBossHeal?: number;
  };
}

/**
 * HP drain multiplier used in boss quiz phase reward calculations.
 * Applied to the boss's current HP for each correct answer.
 */
export const QUIZ_PHASE_CORRECT_HP_DRAIN = 0.05;

/**
 * Boss quiz phase configurations keyed by enemy template ID.
 * Each entry is an array of phases ordered by hpThreshold (descending).
 */
export const BOSS_QUIZ_PHASES: Record<string, BossQuizPhaseConfig[]> = {
  /** The Archivist: standard phase at 50% HP. */
  algorithm: [
    {
      hpThreshold: 0.50,
      questionCount: 5,
      rapidFire: false,
      useWeakestDomain: false,
      timerOverrideMs: null,
      rewards: { correctHpDrainPct: QUIZ_PHASE_CORRECT_HP_DRAIN },
      penalties: { wrongBossHeal: 5 },
    },
  ],
  /** The Curator: weakest-domain phase at 66%, then rapid-fire at 33%. */
  final_lesson: [
    {
      hpThreshold: 0.66,
      questionCount: 4,
      rapidFire: false,
      useWeakestDomain: true,
      timerOverrideMs: null,
      rewards: { correctHpDrainPct: QUIZ_PHASE_CORRECT_HP_DRAIN },
      penalties: { wrongStrengthGain: 1 },
    },
    {
      hpThreshold: 0.33,
      questionCount: 6,
      rapidFire: true,
      useWeakestDomain: false,
      timerOverrideMs: 4000,
      rewards: { correctDirectDamage: 8 },
      penalties: { wrongBossHeal: 5 },
    },
  ],
};

// === RELIC SYSTEM ===

/** Maximum number of relics a player can equip simultaneously. */
export const MAX_RELIC_SLOTS = 5;

/** Extra slot granted by Scholar's Gambit (total becomes 6). */
export const SCHOLARS_GAMBIT_EXTRA_SLOT = 1;

/** Fraction of rarity-based shop price refunded when selling an equipped relic mid-run. */
export const RELIC_SELL_REFUND_PCT = 0.40;

/** Gold cost to reroll all relic options at boss/mini-boss selection. */
export const RELIC_REROLL_COST = 50;

/** Maximum rerolls allowed per relic selection event. */
export const RELIC_REROLL_MAX = 1;

/** Chance of random relic drop after regular encounters. */
export const RELIC_DROP_CHANCE_REGULAR = 0.05;

/** Chance of a bonus relic appearing alongside card choices in reward rooms (per floor). */
export const RELIC_BONUS_CHANCE_REWARD_ROOM = 0.08;

/** Number of relic choices presented at bosses and first mini-boss. */
export const RELIC_BOSS_CHOICES = 3;

/** Rarity weights for random relic drops and mini-boss awards. */
export const RELIC_RARITY_WEIGHTS = {
  common: 0.50,
  uncommon: 0.30,
  rare: 0.15,
  legendary: 0.05,
} as const;

/** Rarity weights for boss relic choices (better quality). */
export const RELIC_BOSS_RARITY_WEIGHTS = {
  common: 0.20,    // AR-59.12: was 0.25
  uncommon: 0.35,
  rare: 0.30,      // AR-59.12: was 0.25
  legendary: 0.15,
} as const;

/** Floor-based probability of offering a pre-upgraded card in rewards. */
export const UPGRADED_REWARD_CHANCE_BY_FLOOR: {
  minFloor: number;
  maxFloor: number;
  chance: number;
}[] = [
  { minFloor: 1, maxFloor: 3, chance: 0 },
  { minFloor: 4, maxFloor: 6, chance: 0.10 },
  { minFloor: 7, maxFloor: 9, chance: 0.20 },
  { minFloor: 10, maxFloor: 12, chance: 0.30 },
  { minFloor: 13, maxFloor: Infinity, chance: 0.40 },
];

/** Consecutive Common-only acquisitions before pity guarantees Uncommon+. */
export const RELIC_PITY_THRESHOLD = 4;

/** Alias used by new v2 code — same value as RELIC_PITY_THRESHOLD. */
export const RELIC_PITY_TIMER_UNCOMMON_PLUS = 4;

/** Maximum relic slots with Scholar's Gambit equipped. */
export const RELIC_SLOT_MAX = 6;

/** Gold refund values when selling a held relic to make room for a new one. */
export const RELIC_SELL_VALUE_COMMON = 15;
export const RELIC_SELL_VALUE_UNCOMMON = 25;
export const RELIC_SELL_VALUE_RARE = 35;
export const RELIC_SELL_VALUE_LEGENDARY = 50;

/** Fraction of block retained between turns. 0.75 = 25% decay per turn.
 * At steady state, playing X block/turn converges to X/0.25 = 4X max block.
 * Rewards consistent shield investment without infinite stacking. */
export const BLOCK_DECAY_RETAIN_RATE = 0.75;

/** @deprecated Use BLOCK_DECAY_RETAIN_RATE instead. Decay naturally caps block. */
export const BLOCK_CARRY_CAP_MULTIPLIER = 2.0;

/** Maximum block that Aegis Stone can carry between turns. */
export const RELIC_AEGIS_STONE_MAX_CARRY = 15;

/** Maximum unused AP that Capacitor can store per turn. */
export const RELIC_CAPACITOR_MAX_STORED_AP = 3;

/** Answer time threshold in ms for Quicksilver Quill 1.5× multiplier. */
export const RELIC_QUICKSILVER_QUILL_FAST_MS = 2000;

/** Answer time threshold in ms for Adrenaline Shard AP refund. */
export const RELIC_ADRENALINE_SHARD_FAST_MS = 3000;

/** Currency multiplier per difficulty mode. Applied at end-of-run. */
export const DIFFICULTY_REWARD_MULTIPLIER: Record<DifficultyMode, number> = {
  relaxed: 1.00,
  normal: 1.00,
};

/** Reward retention on death, by segment. Retreat/victory keep 100%. */
export const DEATH_PENALTY: Record<1 | 2 | 3 | 4, number> = {
  1: 0.80,
  2: 0.65,
  3: 0.50,
  4: 0.35,
};

export const SEGMENT_BOSS_FLOORS = [3, 6, 9, 12, 15, 18, 21, 24] as const;
export const ENDLESS_BOSS_INTERVAL = 3;

/** Number of encounters per floor (2 regular + 1 mini-boss/boss). */
export const ENCOUNTERS_PER_FLOOR = 3;

/** Maximum floors in a standard run. */
export const MAX_FLOORS = 24;

/** Human-readable segment names. */
export const SEGMENT_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Shallow Depths',
  2: 'Deep Caverns',
  3: 'The Abyss',
  4: 'The Archive',
};

// === CARD UPGRADE SYSTEM ===
/** Number of upgrade candidates shown at rest sites. */
export const REST_UPGRADE_CANDIDATE_COUNT = 3;

/** Post-mini-boss rest heal percentage (15% of max HP). */
export const POST_MINI_BOSS_HEAL_PCT = 0.15;

// === SHOP SYSTEM ===
/** Number of relics available per shop visit. */
export const SHOP_RELIC_COUNT = 3;
/** Number of cards available per shop visit. */
export const SHOP_CARD_COUNT = 3;

/** Relic prices by rarity (v2 pricing — AR-59.15). */
export const SHOP_RELIC_PRICE: Record<string, number> = {
  common: 100,
  uncommon: 160,
  rare: 250,
  legendary: 400,
};

/**
 * Card prices by rarity (v2 pricing — AR-59.15).
 * Use with cardTierToRarity() in shopService.ts.
 * Tier 1 = common (50g), Tier 2a/2b = uncommon (80g), Tier 3 = rare (140g).
 */
export const SHOP_CARD_PRICE_V2: Record<string, number> = {
  common: 50,
  uncommon: 80,
  rare: 140,
};

/** @deprecated Use SHOP_CARD_PRICE_V2 with cardTierToRarity(). Kept for backward compatibility. */
export const SHOP_CARD_PRICE: Record<string, number> = {
  '1': 50,
  '2a': 80,
  '2b': 80,
  '3': 140,
};

/** Floor discount for shop prices (3% per floor, max 40%). */
export const SHOP_FLOOR_DISCOUNT_PER_FLOOR = 0.03;
export const SHOP_MAX_DISCOUNT = 0.40;

/** Base price for the shop card removal service — first removal in run. */
export const SHOP_REMOVAL_BASE_PRICE = 50;
/** Additional gold cost per subsequent card removal in the same run (+25g each). */
export const SHOP_REMOVAL_PRICE_INCREMENT = 25;
/** Base price for the shop card transformation service — first transform in run. */
export const SHOP_TRANSFORM_BASE_PRICE = 35;
/** Additional gold cost per subsequent card transformation in the same run (+25g each). */
export const SHOP_TRANSFORM_PRICE_INCREMENT = 25;
/** Haggle discount fraction (0.30 = 30% off — player pays 70% of base price). */
export const SHOP_HAGGLE_DISCOUNT = 0.30;
/** Sale discount fraction applied to one random card per shop visit (0.50 = 50% off). */
export const SHOP_SALE_DISCOUNT = 0.50;

/** Number of food/consumable items offered per shop visit. */
export const SHOP_FOOD_COUNT = 3;

/** Food item definitions: healing percentage and base price. */
export const SHOP_FOOD_ITEMS = {
  ration: { healPct: 0.25, basePrice: 25 },   // 25% max HP heal
  feast:  { healPct: 0.45, basePrice: 50 },    // 45% max HP heal
  elixir: { healPct: 1.00, basePrice: 90 },    // Full heal
} as const;

// === RELIC SYNERGIES ===
/** Perfect Storm synergy: minimum consecutive correct answers to activate. */
export const PERFECT_STORM_STREAK_THRESHOLD = 10;
/** Mastery Ascension synergy: minimum Tier 3 cards in deck to activate. */
export const MASTERY_ASCENSION_MIN_T3_CARDS = 5;
/** Mastery Ascension synergy: maximum flat damage bonus. */
export const MASTERY_ASCENSION_MAX_BONUS = 8;
/** Phoenix Rage synergy: turns of +50% damage after phoenix resurrect. */
export const PHOENIX_RAGE_DAMAGE_TURNS = 5;
/** Phoenix Rage synergy: turns of glass cannon penalty removal. */
export const PHOENIX_RAGE_PENALTY_REMOVAL_TURNS = 3;

// === DUNGEON MAP ===
export const MAP_CONFIG = {
  ROWS_PER_ACT: 8,
  MIN_NODES_PER_ROW: 2,
  MAX_NODES_PER_ROW: 4,
  START_PATHS: 3,
  BRANCH_CHANCE: 0.3,
  MERGE_CHANCE: 0.2,
  ELITE_MIN_ROW: 2,
  REST_MIN_ROW: 2,
  SHOP_MIN_ROW: 2,
  ELITE_MIN_COUNT: 1,
  ELITE_MAX_COUNT: 2,
  SHOP_MIN_COUNT: 1,
  SHOP_MAX_COUNT: 2,
  MYSTERY_MIN_COUNT: 2,
  MYSTERY_MAX_COUNT: 4,
  SHOP_MIN_SPACING: 2,     // minimum rows between two shops
  PRE_BOSS_ROW: 6,         // rest or shop, paths converge
  BOSS_ROW: 7,             // single boss node
  // StS-aligned weights: fewer combat/treasure, more mystery/shops in later segments
  ROOM_DISTRIBUTION: {
    1: { combat: 0.45, elite: 0.08, mystery: 0.22, rest: 0.12, treasure: 0.05, shop: 0.08 },
    2: { combat: 0.42, elite: 0.10, mystery: 0.22, rest: 0.12, treasure: 0.04, shop: 0.10 },
    3: { combat: 0.40, elite: 0.12, mystery: 0.22, rest: 0.12, treasure: 0.04, shop: 0.10 },
    4: { combat: 0.38, elite: 0.14, mystery: 0.22, rest: 0.12, treasure: 0.04, shop: 0.10 },
  } as Record<1 | 2 | 3 | 4, Record<string, number>>,
} as const

// === FEATURE FLAGS ===

/**
 * AR-224: When false, the 3-phase cinematic map reveal animation is skipped.
 * Progressive path view makes the cinematic feel out of place, so it is
 * disabled by default. Set to true to re-enable the classic full-map reveal.
 */
export const MAP_CINEMATIC_ENABLED = false

/** When true, phase 2 mechanics are included in the card pool. */
export const ENABLE_PHASE2_MECHANICS = true;

/** When true, language domains appear in the domain picker. */
export const ENABLE_LANGUAGE_DOMAINS = true;

/** Number of runs that force Relaxed difficulty. */
export const STORY_MODE_FORCED_RUNS = 0;

/** Number of completed runs before archetype selection unlocks (auto-balanced until then). */
export const ARCHETYPE_UNLOCK_RUNS = 3;

/** Minimum encounter cooldown applied to a fact after it is answered. */
export const FACT_COOLDOWN_MIN = 3;
/** Maximum encounter cooldown applied to a fact after it is answered. */
export const FACT_COOLDOWN_MAX = 5;


// === PARAMETER SWEEP: Balance Override System ===
// Module-level mutable context for runtime balance overrides.
// Used by the parameter sweep simulator to test different balance configurations
// without modifying source code. Single-threaded safe (Node.js is synchronous).
// When no overrides are set, all consumers fall back to their default constants.

/** Overridable combat balance parameters for simulation sweeps. */
export interface BalanceOverrides {
  // Player
  playerStartHP?: number;
  handSize?: number;
  startApPerTurn?: number;

  // Card base effects
  baseEffectAttack?: number;
  baseEffectShield?: number;

  // Combat
  fizzleEffectRatio?: number;

  // Healing
  postEncounterHealPct?: number;
  relaxedPostEncounterHealBonus?: number;
  postBossEncounterHealBonus?: number;
  postEncounterHealCap?: Record<number, number>;

  // Enemy scaling
  floorDamageScalingPerFloor?: number;
  enemyTurnDamageCap?: Record<number, number | null>;

  // Enemy HP overrides keyed by enemy template id
  enemyBaseHP?: Record<string, number>;

  // Speed / enrage
  speedBonusMultiplier?: number;
  enragePhase1Bonus?: number;
  enragePhase2Bonus?: number;
}

let _activeOverrides: BalanceOverrides | null = null;

/** Set active balance overrides for the current simulation run. Pass null to clear. */
export function setBalanceOverrides(overrides: BalanceOverrides | null): void {
  _activeOverrides = overrides;
}

/** Get the current active balance overrides (null if none set). */
export function getBalanceOverrides(): BalanceOverrides | null {
  return _activeOverrides;
}

// REMOVED AR-59.12: Starter relic selection screen removed. Relics are earned through encounters.
// export const STARTER_RELIC_CHOICES = ['scholars_hat', 'iron_buckler', 'war_drum'] as const

// === BURN STATUS EFFECT (AR-203) ===
/** When true, Burn triggers on every hit and halves after triggering. */
export const BURN_HALVE_ON_HIT = true;
/** When true, Burn halving rounds down (floor). */
export const BURN_ROUND_DOWN = true;

// === BLEED STATUS EFFECT (AR-203) ===
/** Flat bonus damage Bleed adds to incoming card-play damage, per stack. */
export const BLEED_BONUS_PER_STACK = 1;
/** How many Bleed stacks decay at the end of each enemy turn. */
export const BLEED_DECAY_PER_TURN = 1;

/** Total number of cards in the fixed starter deck (AR-59.6). */
export const STARTER_DECK_SIZE = 10;

/** Minimum deck size — Meditate (card removal at rest sites) is disabled when the player has this many or fewer non-Echo cards. */
export const MIN_DECK_SIZE = 5;

/**
 * Fixed starter deck composition (AR-59.6).
 * 5 Strike, 4 Block, 1 Surge (foresight mechanic: 0 AP, draw 2).
 * Cards are drawn from the run pool so they carry real fact IDs/domains.
 */
export const STARTER_DECK_COMPOSITION = [
  { mechanicId: 'strike', count: 5 },
  { mechanicId: 'block',  count: 4 },
  { mechanicId: 'foresight', count: 1 },
] as const;

/** Get an override value if set, otherwise return the default constant. */
export function getBalanceValue<K extends keyof BalanceOverrides>(
  key: K,
  defaultValue: NonNullable<BalanceOverrides[K]>,
): NonNullable<BalanceOverrides[K]> {
  if (_activeOverrides != null && _activeOverrides[key] !== undefined) {
    return _activeOverrides[key] as NonNullable<BalanceOverrides[K]>;
  }
  return defaultValue;
}
