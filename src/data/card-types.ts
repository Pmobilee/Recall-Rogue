// === Card Type ===
// Combat role used by card effects.

export type CardType = 'attack' | 'shield' | 'utility' | 'buff' | 'debuff' | 'wild';

// === Fact Domain ===
// Normalized domain categories derived from the existing fact.category[] hierarchy

export const CANONICAL_FACT_DOMAINS = [
  'general_knowledge',
  'natural_sciences',
  'space_astronomy',
  'geography',
  'geography_drill',
  'history',
  'mythology_folklore',
  'animals_wildlife',
  'human_body_health',
  'food_cuisine',
  'art_architecture',
  'social_sciences',
  'language',
  'mathematics',   // Procedural math domain — generates problems algorithmically, no static facts
] as const;

export type CanonicalFactDomain = typeof CANONICAL_FACT_DOMAINS[number];

/**
 * Legacy domains retained for save compatibility and incremental migration.
 */
export type LegacyFactDomain = 'science' | 'math' | 'arts' | 'medicine' | 'technology';

export type FactDomain = CanonicalFactDomain | LegacyFactDomain;

export const FACT_DOMAINS = [
  ...CANONICAL_FACT_DOMAINS,
  'science',
  'math',
  'arts',
  'medicine',
  'technology',
] as const;

const LEGACY_DOMAIN_NORMALIZATION: Record<LegacyFactDomain, CanonicalFactDomain> = {
  science: 'natural_sciences',
  math: 'mathematics',
  arts: 'art_architecture',
  medicine: 'human_body_health',
  technology: 'general_knowledge',
};

export function normalizeFactDomain(domain: FactDomain): CanonicalFactDomain {
  return (LEGACY_DOMAIN_NORMALIZATION[domain as LegacyFactDomain] ?? domain) as CanonicalFactDomain;
}

// === Card Tier ===
// Derived from SM-2 review state progression

export type CardTier = '1' | '2a' | '2b' | '3';

// === Card Entity ===
// A single playable card in a run, linked to a Fact

export interface Card {
  /** Unique per-run card instance ID (e.g., `card_<nanoid>`) */
  id: string;
  /** Links to the source Fact in the facts DB */
  factId: string;
  /** Combat role, assigned from weighted distribution (independent of domain) */
  cardType: CardType;
  /** Knowledge domain, derived from fact.category */
  domain: FactDomain;
  /** Power tier: 1=new/learning, 2a/2b=active, 3=mastered passive */
  tier: CardTier;
  /** Base numeric effect (damage/block/heal amount before multipliers) */
  baseEffectValue: number;
  /** @deprecated Always 1.0 for active tiers. Tier-based damage scaling removed (2026-04-03).
   *  Kept on interface to avoid refactoring all card creation sites. Tier 3 = 0 (passive). */
  effectMultiplier: number;
  /** True when this card is a Mastery Trial candidate. */
  isMasteryTrial?: boolean;
  /** Mechanic ID from the mechanics pool. */
  mechanicId?: string;
  /** Human-readable mechanic name. */
  mechanicName?: string;
  /** AP cost to play this card. */
  apCost?: number;
  /** Pre-upgrade base effect value (preserved for reference). */
  originalBaseEffectValue?: number;
  /** True if this card has been upgraded at a rest site or post-mini-boss. */
  isUpgraded?: boolean;
  /** In-run mastery level (0-5). Cards upgrade on correct charge answers, downgrade on wrong. Resets each run. */
  masteryLevel?: number;
  /** True if this card has already upgraded or downgraded this encounter (max once per encounter). */
  masteryChangedThisEncounter?: boolean;
  /** Per-card secondary value override (set on upgrade for mechanics like multi_hit). */
  secondaryValue?: number;
  /** Knowledge sub-category level 2 (e.g. 'ancient_classical'). Used by chain system and boss quiz phases. */
  categoryL2?: string;
  /** Chain type index (0-5), assigned at run start. Runtime-only — not persisted to DB. */
  chainType?: number;
  /** @deprecated — facts shuffle per draw via FSRS, not permanently bound. Kept for save backward-compatibility only. */
  boundFactId?: string;
  /**
   * True when the fact assigned to this card is currently in the run's cursedFactIds set.
   * Set per-draw in drawHand(). Cleared when the fact is cured.
   */
  isCursed?: boolean;
  /**
   * True if this card is an Inscription — played once, persists for rest of combat,
   * exhausts on play and is permanently removed from game (cannot be Recollected).
   * Set at card creation time for inscription mechanic definitions.
   */
  isInscription?: boolean;
  /**
   * If true, this card was permanently removed from game (Inscription exhaust).
   * Cannot be Recollected by the Recollect mechanic (AR-208).
   */
  isRemovedFromGame?: boolean;
  /** When true, this card is a temporary transform (e.g., from Transmute) */
  isTransmuted?: boolean;
  /** Original card data to revert to at encounter end */
  originalCard?: Card;
  /**
   * AR-268: Trick Question — when true, this card was locked by The Trick Question enemy.
   * Quick Play is blocked; must be Charged with the matching fact to unlock with 2× power.
   */
  isLocked?: boolean;
  /**
   * AR-268: Trick Question — the factId this card is locked to.
   * Cleared when the card is successfully Charged with the matching fact.
   */
  lockedFactId?: string;
}

// === Card Run State ===
// Full state of the card deck during an active run.
// Named CardRunState to avoid collision with the existing RunState (mine/dive).

export interface CardRunState {
  /** Cards remaining to be drawn */
  drawPile: Card[];
  /** Cards played this turn cycle, waiting to be reshuffled */
  discardPile: Card[];
  /** Cards currently in the player's hand */
  hand: Card[];
  /** Cards permanently removed from this run */
  exhaustPile: Card[];
  /** Current floor number (1-indexed) */
  currentFloor: number;
  /** Current encounter index within the floor (0-indexed) */
  currentEncounter: number;
  /** Player's current hit points */
  playerHP: number;
  /** Player's maximum hit points */
  playerMaxHP: number;
  /** Player's current shield/block points */
  playerShield: number;
  /** Remaining hint uses for this run */
  hintsRemaining: number;
  /** Currency (dust) earned during this run */
  currency: number;
  /** Pool of fact IDs available for assignment to card slots this encounter */
  factPool: string[];
  /** Facts currently on cooldown (recently answered) — see encounter cooldown */
  factCooldown: { factId: string; encountersRemaining: number }[];
  /** All fact IDs that appeared in any hand during the current encounter (for cooldown on encounter end) */
  currentEncounterSeenFacts?: Set<string>;
  /**
   * Consecutive draw count where cursed-card ratio >= CURSED_AUTO_CURE_THRESHOLD.
   * When this reaches 2, auto-cure is scheduled at encounter end.
   */
  consecutiveCursedDraws: number;
  /**
   * When true, the oldest cursed fact will be auto-cured at encounter end.
   * Set when consecutiveCursedDraws >= 2. Reset after cure fires.
   */
  pendingAutoCure?: boolean;
}

// === Deck Stats ===
// Snapshot of deck pile sizes for HUD display

export interface DeckStats {
  drawRemaining: number;
  discardSize: number;
  exhaustedCount: number;
  handSize: number;
}

// === Passive Effect ===
// Tier 3 mastered cards become passive buffs instead of hand cards

/** A passive buff derived from a Tier 3 mastered card. */
export interface PassiveEffect {
  /** The factId of the source mastered card. */
  sourceFactId: string;
  /** The card type that determines the passive bonus. */
  cardType: CardType;
  /** The domain of the source card. */
  domain: FactDomain;
  /** The bonus value. */
  value: number;
}
