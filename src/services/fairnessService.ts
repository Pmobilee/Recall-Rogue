/**
 * Fairness mechanisms for competitive multiplayer.
 *
 * Handles asymmetric knowledge balancing through multiple opt-in modes:
 * - Fresh Facts Only: filter to FSRS state=new for all players
 * - Mastery Equalized: everyone starts at L0
 * - Handicap: damage reduction for the stronger player
 * - Deck Practice Period: pre-match fact browsing window
 * - FSRS Normalized Scoring: adjust credit by expected accuracy
 * - Chain Normalization: same chain types for all (enforced at lobby level)
 *
 * All core functions are pure — no side effects, fully unit-testable.
 *
 * See docs/architecture/services/index.md for catalog entry.
 * See docs/mechanics/combat.md for the damage pipeline these values feed into.
 */

import type { FairnessOptions } from '../data/multiplayerTypes';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Aggregated per-player data used to compute fairness adjustments. */
export interface FairnessProfile {
  playerId: string;
  /** What fraction of the selected deck this player has already mastered (0-100). */
  deckMasteryPercent: number;
  /** Average quiz accuracy across all facts, all time (0-1). */
  historicalAccuracy: number;
  /** Competitive ELO rating (higher = stronger). */
  elo: number;
  /** Total ranked games played (used for confidence weighting). */
  gamesPlayed: number;
}

/**
 * Resolved per-player adjustments to apply at match start.
 *
 * These values are consumed by:
 *  - The damage pipeline (damageMultiplier): see cardEffectResolver.ts
 *  - Fact selection (freshFactsOnly): see curatedFactSelector.ts
 *  - Mastery initialisation (startingMastery): see cardUpgradeService.ts
 *  - Score calculation (scoreNormalization): see turnManager.ts
 *  - Pre-match lobby timer (practiceTimeSecs): see lobby UI
 */
export interface FairnessAdjustments {
  /**
   * Damage multiplier for this player.
   * 1.0 = no handicap, 0.5 = 50% output reduction.
   * MUST be passed through the damage pipeline (GDD §15.5) — never bypass.
   */
  damageMultiplier: number;
  /** When true, curatedFactSelector should only offer FSRS state=new facts. */
  freshFactsOnly: boolean;
  /**
   * Starting mastery level override.
   * 0 = equalized (Mastery L0 for all cards).
   * -1 = use player's actual per-card mastery (no equalization).
   */
  startingMastery: number;
  /**
   * Score normalization factor (applied on top of base score).
   * >1.0 favours the weaker player; 1.0 = no adjustment.
   * See getFsrsScoreNormalization() for per-answer application.
   */
  scoreNormalization: number;
  /** Pre-match deck browsing window in seconds. 0 = disabled. */
  practiceTimeSecs: number;
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Calculate fairness adjustments for a single player given lobby options.
 *
 * Deterministic and pure — same inputs always produce the same output.
 *
 * @param player   - The player for whom adjustments are being calculated.
 * @param opponent - The opposing player (used for relative comparisons).
 * @param options  - Lobby-level fairness settings from HouseRules.fairness.
 * @returns Adjustments to apply for `player` in this match.
 */
export function calculateFairnessAdjustments(
  player: FairnessProfile,
  opponent: FairnessProfile,
  options: FairnessOptions,
): FairnessAdjustments {
  const adjustments: FairnessAdjustments = {
    damageMultiplier: 1.0,
    freshFactsOnly: options.freshFactsOnly,
    startingMastery: options.masteryEqualized ? 0 : -1,
    scoreNormalization: 1.0,
    practiceTimeSecs: options.deckPracticeSecs,
  };

  // Handicap — apply damage reduction to the stronger player.
  // "Stronger" = higher ELO; deck mastery breaks ELO ties.
  if (options.handicapPercent > 0) {
    const isStronger =
      player.elo > opponent.elo ||
      (player.elo === opponent.elo &&
        player.deckMasteryPercent > opponent.deckMasteryPercent);
    if (isStronger) {
      // Clamp reduction to [0, 50]% as defined by FairnessOptions.
      const clampedPct = Math.min(50, Math.max(0, options.handicapPercent));
      adjustments.damageMultiplier = 1.0 - clampedPct / 100;
    }
  }

  return adjustments;
}

/**
 * Calculate FSRS-normalised score credit for a single answered fact.
 *
 * Players who answer low-stability (hard) facts correctly receive extra credit;
 * those coasting on already-memorised facts receive less. Wrong answers are not
 * adjusted — the miss penalty is identical regardless of stability.
 *
 * Score bands:
 *  - stability < 1   → 1.5× (genuinely hard — student barely knows it)
 *  - stability 1-10  → 1.0× (normal working memory range)
 *  - stability ≥ 10  → 0.7× (well-cemented long-term memory)
 *
 * @param factStability - FSRS stability of the answered fact (higher = better known).
 * @param wasCorrect    - Whether the answer was correct.
 * @returns A score multiplier to apply to the base answer score.
 */
export function getFsrsScoreNormalization(
  factStability: number,
  wasCorrect: boolean,
): number {
  if (!wasCorrect) return 1.0;
  if (factStability < 1) return 1.5;
  if (factStability < 10) return 1.0;
  return 0.7;
}

/**
 * Filter a fact pool to only those facts that are FSRS-new for ALL players.
 *
 * Used in "Fresh Facts Only" mode to ensure no player has a prior advantage
 * from having studied the same deck. A fact is excluded if any player's
 * review state set contains it.
 *
 * @param factIds           - All candidate fact IDs from the selected deck.
 * @param playerReviewStates - Map of playerId → Set of fact IDs already reviewed.
 * @returns Subset of factIds that no player in the lobby has reviewed.
 */
export function filterFreshFacts(
  factIds: string[],
  playerReviewStates: Map<string, Set<string>>,
): string[] {
  return factIds.filter(id => {
    for (const reviewed of playerReviewStates.values()) {
      if (reviewed.has(id)) return false;
    }
    return true;
  });
}

/**
 * Calculate a 0-100 fairness rating for a lobby.
 *
 * Higher scores indicate a more balanced match. Displayed in the lobby UI
 * to help players decide whether to enable fairness options.
 *
 * Calculation:
 *  1. Start from ELO gap (500 gap → 0 base fairness).
 *  2. Subtract for deck mastery gap (30 pp gap → -9 points).
 *  3. Add bonuses for each active fairness option.
 *  4. Clamp to [0, 100].
 *
 * @param players - All players in the lobby (min 2 required for a meaningful score).
 * @param options - Active fairness settings.
 * @returns Integer fairness score (0-100).
 */
export function calculateFairnessRating(
  players: FairnessProfile[],
  options: FairnessOptions,
): number {
  if (players.length < 2) return 100;

  const elos = players.map(p => p.elo);
  const eloGap = Math.max(...elos) - Math.min(...elos);
  // 500 ELO gap → 0 base fairness.
  let fairness = Math.max(0, 100 - eloGap / 5);

  const masteries = players.map(p => p.deckMasteryPercent);
  const masteryGap = Math.max(...masteries) - Math.min(...masteries);
  // Each percentage point of mastery gap costs 0.3 fairness points.
  fairness -= masteryGap * 0.3;

  // Each active fairness option boosts the rating.
  if (options.freshFactsOnly) fairness += 20;
  if (options.masteryEqualized) fairness += 15;
  if (options.handicapPercent > 0) fairness += options.handicapPercent * 0.3;
  if (options.chainNormalized) fairness += 5;

  return Math.round(Math.max(0, Math.min(100, fairness)));
}

/**
 * Return a human-readable label and display colour for a fairness rating.
 *
 * Intended for lobby UI overlay — colours are tuned for dark backgrounds.
 *
 * @param rating - Output of calculateFairnessRating().
 * @returns `{ label, color }` for display.
 */
export function getFairnessLabel(rating: number): { label: string; color: string } {
  if (rating >= 80) return { label: 'Very Fair', color: '#44ff44' };
  if (rating >= 60) return { label: 'Fair', color: '#88ff44' };
  if (rating >= 40) return { label: 'Uneven', color: '#ffaa44' };
  if (rating >= 20) return { label: 'Lopsided', color: '#ff6644' };
  return { label: 'Heavily Favored', color: '#ff4444' };
}
