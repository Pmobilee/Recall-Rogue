/**
 * Chain Distribution Engine — assigns deck sub-topics across 3 run chain colors.
 *
 * Uses FSRS-weighted LPT (Longest Processing Time) bin-packing so the player's
 * weakest material is spread evenly across all three chains rather than clumped
 * into one.
 *
 * Entry points:
 *   extractTopicGroups()          — single deck → TopicGroup[]
 *   extractTopicGroupsMultiDeck() — playlist of decks → TopicGroup[]
 *   distributeTopicGroups()       — TopicGroup[] → ChainDistribution
 *   precomputeChainDistribution() — full pipeline for a study-mode DeckMode
 */

import type { CuratedDeck } from '../data/curatedDeckTypes';
import type { ReviewState } from '../data/types';
import type { DeckMode } from '../data/studyPreset';
import { getCuratedDeck, getAllLoadedDecks, getCuratedDeckFacts } from '../data/curatedDeckStore';
import { selectRunChainTypes } from '../data/chainTypes';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A thematic grouping of facts (sub-deck, POS bucket, or chainThemeId group). */
export interface TopicGroup {
  /** Sub-deck ID or synthetic group ID like "pos_noun". */
  id: string;
  /** Display name: "Ancient Wonders", "Nouns", etc. */
  label: string;
  /** Parent deck ID. */
  deckId: string;
  /** Fact IDs in this group (filtered to run pool). */
  factIds: string[];
  /** FSRS summary of facts in this group. */
  fsrs: {
    new: number;
    learning: number;
    review: number;
    mastered: number;
  };
}

/** Result of distributing topic groups across 3 chain slots. */
export interface ChainDistribution {
  /** 3 chain type indices selected for this run (e.g. [0, 2, 4]). */
  runChainTypes: number[];
  /** Topics assigned to each chain slot (index 0/1/2). */
  assignments: [TopicGroup[], TopicGroup[], TopicGroup[]];
  /** factId → chain type index lookup (fast path for card assignment). */
  factToChain: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fast LCG seeded RNG — same algorithm as selectRunChainTypes() in chainTypes.ts.
 * Returns a pseudo-random integer in [0, range).
 */
function seededRandInt(state: { s: number }, range: number): number {
  state.s = (state.s * 1664525 + 1013904223) & 0xFFFFFFFF;
  return (state.s >>> 0) % range;
}

/**
 * Compute FSRS category for a single ReviewState entry.
 * Returns 'new' | 'learning' | 'review' | 'mastered'.
 */
function classifyReviewState(rs: ReviewState): 'new' | 'learning' | 'review' | 'mastered' {
  if (rs.masteredAt != null || (rs.stability != null && rs.stability > 30)) {
    return 'mastered';
  }
  const s = rs.state ?? rs.cardState;
  if (s === 'learning' || s === 'relearning') return 'learning';
  if (s === 'review') return 'review';
  return 'new';
}

/**
 * Build FSRS summary for an array of factIds against a reviewState lookup Map.
 */
function buildFsrsSummary(
  factIds: string[],
  reviewMap: Map<string, ReviewState>,
): TopicGroup['fsrs'] {
  const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
  for (const fid of factIds) {
    const rs = reviewMap.get(fid);
    if (!rs) {
      counts.new++;
    } else {
      counts[classifyReviewState(rs)]++;
    }
  }
  return counts;
}

/**
 * Compute a load score for a TopicGroup.
 * Higher score = more demanding study load = should be distributed first (LPT).
 */
function loadScore(g: TopicGroup): number {
  return g.fsrs.new * 3 + g.fsrs.learning * 2 + g.fsrs.review * 1 + g.fsrs.mastered * 0.5;
}

/**
 * Deterministically split a TopicGroup's facts into N sub-groups by round-robin index.
 * Uses index-based (not hash-based) assignment to guarantee min(n, factIds.length)
 * non-empty buckets regardless of factId content — prevents infinite loops.
 * Used when there are fewer groups than chains (edge case).
 */
function splitGroup(group: TopicGroup, n: number): TopicGroup[] {
  if (n <= 1) return [group];
  // Cap n to number of facts — can't split 2 facts into 3 non-empty groups
  const actualN = Math.min(n, group.factIds.length);
  if (actualN <= 1) return [group];
  const buckets: string[][] = Array.from({ length: actualN }, () => []);
  // Round-robin assignment guarantees every bucket gets at least one fact
  for (let i = 0; i < group.factIds.length; i++) {
    buckets[i % actualN].push(group.factIds[i]);
  }
  return buckets.map((fids, i) => ({
    id: `${group.id}_split${i}`,
    label: `${group.label} (${i + 1})`,
    deckId: group.deckId,
    factIds: fids,
    fsrs: { new: 0, learning: 0, review: 0, mastered: 0 }, // re-filled by caller
  }));
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Extract TopicGroups from a single curated deck.
 *
 * Waterfall priority:
 * 1. deck has `subDecks[]` array  → one TopicGroup per sub-deck.
 *    Sub-decks with explicit `factIds` use them; sub-decks with only `chainThemeId`
 *    fall back to matching facts by their `chainThemeId` field (e.g. ancient_greece).
 * 2. facts have `partOfSpeech`    → group by POS; merge groups below the proportional
 *    threshold (max(5, 3% of pool) facts) into "Other" to avoid visual noise from
 *    tiny groups in large multi-deck pools (~7000 facts for All Chinese).
 *    Facts WITHOUT a `partOfSpeech` field are distributed round-robin into
 *    existing POS groups so no facts are silently dropped.
 * 3. fallback                      → group by `chainThemeId`
 *
 * All groups are filtered to `factIds` (the active run pool subset).
 *
 * IMPORTANT: `factIds` must only contain IDs from THIS deck. When calling from
 * `extractTopicGroupsMultiDeck`, pass per-deck fact IDs, not the cross-deck pool —
 * otherwise the ungrouped-facts safety net absorbs fact IDs from other decks.
 *
 * @param deck         - Loaded CuratedDeck.
 * @param factIds      - Fact IDs in the run pool (must be from this deck only).
 * @param reviewStates - All ReviewStates for the player (used for FSRS summary).
 */
export function extractTopicGroups(
  deck: CuratedDeck,
  factIds: string[],
  reviewStates: ReviewState[],
): TopicGroup[] {
  const runPool = new Set(factIds);
  const reviewMap = new Map(reviewStates.map(rs => [rs.factId, rs]));

  // Cast to access runtime-extended subDecks field (matches curatedDeckStore.ts pattern).
  // chainThemeId is optional — decks like ancient_greece use it instead of factIds.
  const deckWithSubs = deck as CuratedDeck & {
    subDecks?: Array<{ id: string; name: string; factIds?: string[]; chainThemeId?: number }>;
  };

  // ── Priority 1: sub-decks ──────────────────────────────────────────────
  if (deckWithSubs.subDecks && deckWithSubs.subDecks.length > 0) {
    const groups: TopicGroup[] = [];
    for (const sd of deckWithSubs.subDecks) {
      let sdFactIds: string[];
      if (sd.factIds && sd.factIds.length > 0) {
        // Sub-deck has an explicit factIds list — use it.
        sdFactIds = sd.factIds.filter(fid => runPool.has(fid));
      } else if (sd.chainThemeId != null) {
        // Sub-deck only has chainThemeId (e.g. ancient_greece) — match facts by
        // their chainThemeId field so real sub-deck names are used instead of
        // falling through to the generic "Group 1 / Group 2 / ..." fallback.
        sdFactIds = deck.facts
          .filter(f => runPool.has(f.id) && f.chainThemeId === sd.chainThemeId)
          .map(f => f.id);
      } else {
        sdFactIds = [];
      }
      if (sdFactIds.length === 0) continue;
      groups.push({
        id: sd.id,
        label: sd.name,
        deckId: deck.id,
        factIds: sdFactIds,
        fsrs: buildFsrsSummary(sdFactIds, reviewMap),
      });
    }
    if (groups.length > 0) return groups;
  }

  // ── Priority 2: part of speech ──────────────────────────────────────────
  const posBuckets = new Map<string, string[]>();
  for (const fact of deck.facts) {
    if (!runPool.has(fact.id)) continue;
    if (fact.partOfSpeech) {
      const pos = fact.partOfSpeech.toLowerCase();
      if (!posBuckets.has(pos)) posBuckets.set(pos, []);
      posBuckets.get(pos)!.push(fact.id);
    }
  }

  if (posBuckets.size > 0) {
    // Merge small POS groups into "Other". The threshold is proportional to pool
    // size — at least 3% of total facts, minimum 5. This prevents dozens of tiny
    // groups (e.g. "Pronouns (14)", "Particles (8)") when the pool is large
    // (all-Chinese ~7000 facts), while keeping the fixed minimum for small decks.
    const MIN_POS_GROUP = Math.max(5, Math.floor(runPool.size * 0.03));
    const otherFacts: string[] = [];
    const groups: TopicGroup[] = [];
    for (const [pos, fids] of posBuckets) {
      if (fids.length < MIN_POS_GROUP) {
        otherFacts.push(...fids);
      } else {
        const label = pos.charAt(0).toUpperCase() + pos.slice(1) + 's';
        groups.push({
          id: `pos_${pos}`,
          label,
          deckId: deck.id,
          factIds: fids,
          fsrs: buildFsrsSummary(fids, reviewMap),
        });
      }
    }
    if (otherFacts.length > 0) {
      groups.push({
        id: 'pos_other',
        label: 'Other',
        deckId: deck.id,
        factIds: otherFacts,
        fsrs: buildFsrsSummary(otherFacts, reviewMap),
      });
    }

    // Safety net: distribute facts without partOfSpeech proportionally across
    // existing groups. Without this, mixed decks (e.g. Chinese/Spanish with
    // some facts missing the partOfSpeech field) silently lose those facts —
    // causing 70 visible facts instead of 466.
    // Round-robin keeps chains balanced (no giant "Other" catchall group).
    // NOTE: factIds must be scoped to this deck only (see extractTopicGroupsMultiDeck).
    if (groups.length > 0) {
      const groupedIds = new Set(groups.flatMap(g => g.factIds));
      const ungrouped = [...runPool].filter(fid => !groupedIds.has(fid));

      if (ungrouped.length > 0) {
        for (let i = 0; i < ungrouped.length; i++) {
          groups[i % groups.length].factIds.push(ungrouped[i]);
        }
        // Recompute FSRS summaries since factIds changed
        for (const g of groups) {
          g.fsrs = buildFsrsSummary(g.factIds, reviewMap);
        }
      }

      return groups;
    }
  }

  // ── Priority 3: chainThemeId fallback ──────────────────────────────────
  const themeBuckets = new Map<number, string[]>();
  for (const fact of deck.facts) {
    if (!runPool.has(fact.id)) continue;
    const tid = fact.chainThemeId ?? 0;
    if (!themeBuckets.has(tid)) themeBuckets.set(tid, []);
    themeBuckets.get(tid)!.push(fact.id);
  }

  const themeGroups: TopicGroup[] = [];
  let groupNum = 1;
  for (const [tid, fids] of themeBuckets) {
    themeGroups.push({
      id: `theme_${tid}`,
      label: `Group ${groupNum++}`,
      deckId: deck.id,
      factIds: fids,
      fsrs: buildFsrsSummary(fids, reviewMap),
    });
  }

  return themeGroups;
}

/**
 * Extract TopicGroups from multiple decks (mixed playlist).
 * Calls extractTopicGroups per deck, passing ONLY that deck's own fact IDs
 * as the run pool. This prevents the ungrouped-facts safety net from absorbing
 * fact IDs from other decks, which would inflate group sizes incorrectly.
 *
 * The global `factIds` parameter acts as an additional filter — only fact IDs
 * present in both `factIds` AND the deck's own facts are included.
 *
 * @param decks        - Array of loaded CuratedDecks.
 * @param factIds      - Fact IDs in the run pool across ALL decks (used as a filter).
 * @param reviewStates - All ReviewStates for the player.
 */
export function extractTopicGroupsMultiDeck(
  decks: CuratedDeck[],
  factIds: string[],
  reviewStates: ReviewState[],
): TopicGroup[] {
  const globalPool = new Set(factIds);
  const groups: TopicGroup[] = [];
  for (const deck of decks) {
    // Scope fact IDs to this deck only — prevents cross-deck contamination
    // in the POS ungrouped-facts safety net.
    const deckFactIds = deck.facts
      .map(f => f.id)
      .filter(fid => globalPool.has(fid));
    if (deckFactIds.length === 0) continue;
    groups.push(...extractTopicGroups(deck, deckFactIds, reviewStates));
  }
  return groups;
}

/**
 * Distribute topic groups across 3 chain slots using greedy LPT bin-packing.
 *
 * Algorithm:
 * 1. Score each group: new×3 + learning×2 + review×1 + mastered×0.5
 * 2. Sort descending by score (heaviest first)
 * 3. Shuffle ties with seeded RNG for variety between runs
 * 4. Greedily assign each group to the chain with the lowest cumulative load
 * 5. If < 3 groups, split largest group(s) to guarantee 3 chains
 *
 * @param groups        - TopicGroups from extractTopicGroups*.
 * @param runChainTypes - 3 chain type indices for this run (e.g. [0, 2, 4]).
 * @param seed          - Deterministic seed (use runSeed from RunState).
 */
export function distributeTopicGroups(
  groups: TopicGroup[],
  runChainTypes: number[],
  seed: number,
): ChainDistribution {
  const NUM_CHAINS = runChainTypes.length; // always 3
  const rngState = { s: seed };

  // ── Handle empty input ───────────────────────────────────────────────────
  if (groups.length === 0) {
    return {
      runChainTypes,
      assignments: [[], [], []],
      factToChain: new Map(),
    };
  }

  // ── Ensure at least NUM_CHAINS groups ────────────────────────────────────
  let workGroups = [...groups];
  // Total unique factIds across all groups — we cannot produce more groups than facts.
  const totalFacts = groups.reduce((s, g) => s + g.factIds.length, 0);
  const targetChains = Math.min(NUM_CHAINS, totalFacts);
  while (workGroups.length < targetChains) {
    // Find the group with the most facts and split it into 2
    workGroups.sort((a, b) => b.factIds.length - a.factIds.length);
    const biggest = workGroups.shift()!;
    const splits = splitGroup(biggest, 2);
    // If splitGroup can't actually split (1 fact), bail out early
    if (splits.length <= 1) {
      workGroups.push(biggest);
      break;
    }
    // Rebuild FSRS for splits proportionally by factId count
    for (const sg of splits) {
      const ratio = biggest.factIds.length > 0 ? sg.factIds.length / biggest.factIds.length : 0;
      sg.fsrs = {
        new: Math.round(biggest.fsrs.new * ratio),
        learning: Math.round(biggest.fsrs.learning * ratio),
        review: Math.round(biggest.fsrs.review * ratio),
        mastered: Math.round(biggest.fsrs.mastered * ratio),
      };
    }
    workGroups.push(...splits);
  }

  // ── Score and sort ────────────────────────────────────────────────────────
  const scored = workGroups.map(g => ({ group: g, score: loadScore(g) }));

  // Shuffle equal-score ties with seeded RNG (stable sort for different scores)
  // Fisher-Yates only on groups that tie in score: we do a full seeded shuffle
  // then stable-sort by score descending to keep ties in shuffled order.
  for (let i = scored.length - 1; i > 0; i--) {
    const j = seededRandInt(rngState, i + 1);
    [scored[i], scored[j]] = [scored[j], scored[i]];
  }
  scored.sort((a, b) => b.score - a.score);

  // ── LPT greedy bin-packing ────────────────────────────────────────────────
  const bins: TopicGroup[][] = Array.from({ length: NUM_CHAINS }, () => []);
  const binLoads: number[] = new Array(NUM_CHAINS).fill(0);

  for (const { group, score } of scored) {
    // Find bin with lowest cumulative load
    let minIdx = 0;
    for (let i = 1; i < NUM_CHAINS; i++) {
      if (binLoads[i] < binLoads[minIdx]) minIdx = i;
    }
    bins[minIdx].push(group);
    binLoads[minIdx] += score;
  }

  // ── Build factToChain Map ─────────────────────────────────────────────────
  const factToChain = new Map<string, number>();
  for (let i = 0; i < NUM_CHAINS; i++) {
    const chainTypeIdx = runChainTypes[i];
    for (const group of bins[i]) {
      for (const fid of group.factIds) {
        factToChain.set(fid, chainTypeIdx);
      }
    }
  }

  // Dev-mode invariant: warn if any input facts were lost in distribution.
  // This should never fire after the POS ungrouped-facts safety net is in place,
  // but keeps the contract visible during development.
  if (typeof window !== 'undefined' && (window as any).__rrDebug) {
    const inputFacts = groups.reduce((s, g) => s + g.factIds.length, 0);
    const outputFacts = factToChain.size;
    if (inputFacts !== outputFacts) {
      console.warn(
        `[ChainDistribution] Fact count mismatch: ${inputFacts} input, ${outputFacts} output`,
      );
    }
  }

  return {
    runChainTypes,
    assignments: bins as [TopicGroup[], TopicGroup[], TopicGroup[]],
    factToChain,
  };
}

/**
 * Full pipeline: compute a ChainDistribution for a study-mode DeckMode run.
 *
 * Handles two cases:
 * - Single deck (`deckMode.deckId` without `all:` prefix): loads the one deck,
 *   optionally filtered to a subDeckId.
 * - Multi-deck language aggregate (`deckMode.deckId` with `all:` prefix, e.g.
 *   `"all:chinese"`): loads ALL curated decks whose ID starts with the language
 *   key (e.g. `chinese_hsk1` through `chinese_hsk6`) and combines their topic
 *   groups. This gives "All Chinese" its full ~7000 facts instead of only HSK1.
 *
 * Returns `undefined` for trivia, general, preset, language, or any mode where
 * no curated decks are available.
 *
 * Call this at run-start (eager, before the preview screen) so the distribution
 * is available when the pool is first built by encounterBridge.
 *
 * @param deckMode     - The DeckMode for the new run.
 * @param reviewStates - All ReviewStates for the player.
 * @param seed         - Deterministic seed (use RunState.runSeed).
 */
export function precomputeChainDistribution(
  deckMode: DeckMode,
  reviewStates: ReviewState[],
  seed: number,
): ChainDistribution | undefined {
  // Only curated study runs and playlist runs get topic-aware chain distribution.
  if (deckMode.type !== 'study' && deckMode.type !== 'playlist') return undefined;

  // Playlist mode: merge topic groups from all deck items.
  if (deckMode.type === 'playlist') {
    const decks = deckMode.items
      .map(item => getCuratedDeck(item.deckId))
      .filter((d): d is NonNullable<typeof d> => d != null);
    if (decks.length === 0) return undefined;

    // Scope fact IDs per deck (respecting subDeckId/examTags filters).
    const allFactIds: string[] = [];
    for (const item of deckMode.items) {
      const deckFacts = getCuratedDeckFacts(item.deckId, item.subDeckId, item.examTags);
      allFactIds.push(...deckFacts.map(f => f.id));
    }
    if (allFactIds.length === 0) return undefined;

    const groups = extractTopicGroupsMultiDeck(decks, allFactIds, reviewStates);
    const runChainTypes = selectRunChainTypes(seed);
    return distributeTopicGroups(groups, runChainTypes, seed);
  }

  if (deckMode.deckId.startsWith('all:')) {
    // Multi-deck language aggregate: load ALL loaded decks whose ID starts with
    // the language key. e.g. 'all:chinese' → chinese_hsk1, chinese_hsk2, …, chinese_hsk6.
    const langKey = deckMode.deckId.slice(4); // e.g. 'chinese' from 'all:chinese'
    const prefix = langKey + '_';
    const allDecks = getAllLoadedDecks().filter(
      d => d.id.startsWith(prefix) || d.id === langKey,
    );
    if (allDecks.length === 0) return undefined;

    const allFactIds = allDecks.flatMap(d => d.facts.map(f => f.id));
    if (allFactIds.length === 0) return undefined;

    const groups = extractTopicGroupsMultiDeck(allDecks, allFactIds, reviewStates);
    const runChainTypes = selectRunChainTypes(seed);
    return distributeTopicGroups(groups, runChainTypes, seed);
  }

  // Single curated deck path (existing behavior).
  const deck = getCuratedDeck(deckMode.deckId);
  if (!deck) return undefined;

  // Get fact IDs to consider: filtered by subDeckId if specified.
  let factIds: string[];
  if (deckMode.subDeckId) {
    // Cast to access runtime-extended subDecks field (matches extractTopicGroups pattern).
    // chainThemeId is optional — sub-decks may use it instead of factIds.
    const deckWithSubs = deck as typeof deck & {
      subDecks?: Array<{ id: string; name: string; factIds?: string[]; chainThemeId?: number }>;
    };
    const subDeck = deckWithSubs.subDecks?.find(sd => sd.id === deckMode.subDeckId);
    if (subDeck) {
      if (subDeck.factIds && subDeck.factIds.length > 0) {
        factIds = subDeck.factIds;
      } else if (subDeck.chainThemeId != null) {
        // Sub-deck uses chainThemeId — resolve to actual fact IDs from the deck.
        factIds = deck.facts
          .filter(f => f.chainThemeId === subDeck.chainThemeId)
          .map(f => f.id);
      } else {
        factIds = deck.facts.map(f => f.id);
      }
    } else {
      factIds = deck.facts.map(f => f.id);
    }
  } else {
    factIds = deck.facts.map(f => f.id);
  }

  if (factIds.length === 0) return undefined;

  const groups = extractTopicGroups(deck, factIds, reviewStates);
  const runChainTypes = selectRunChainTypes(seed);
  return distributeTopicGroups(groups, runChainTypes, seed);
}
