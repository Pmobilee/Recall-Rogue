// === Card Type ===
// Combat role used by card effects.

export type CardType = 'attack' | 'shield' | 'heal' | 'utility' | 'buff' | 'debuff' | 'regen' | 'wild';

// === Fact Domain ===
// Normalized domain categories derived from the existing fact.category[] hierarchy

export type FactDomain = 'science' | 'history' | 'geography' | 'language' | 'math' | 'arts' | 'medicine' | 'technology';

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
  /** Multiplier from difficulty-proportional power (easy cards hit softer) */
  effectMultiplier: number;
  /** True if this is an Echo (ghost card injected from wrong answer) */
  isEcho?: boolean;
  /** True when this card is a Mastery Trial candidate. */
  isMasteryTrial?: boolean;
  /** Mechanic ID from the mechanics pool. */
  mechanicId?: string;
  /** Human-readable mechanic name. */
  mechanicName?: string;
  /** AP cost to play this card. */
  apCost?: number;
  /** Pre-echo base effect value used by Echo Chamber. */
  originalBaseEffectValue?: number;
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
  /** Current consecutive correct-answer combo count (resets on wrong) */
  comboCount: number;
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
