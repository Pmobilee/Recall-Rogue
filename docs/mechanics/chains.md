# Chain System

> **Purpose:** How the Knowledge Chain system works — consecutive correct answers, multiplier scaling, chain types, break conditions, rotating chain color, and themed chain distribution.
> **Last verified:** 2026-04-09 (7.7 weighted rotation, 7.8 off-colour partial reset, mid-turn active color switch)
> **Source files:** `src/services/chainSystem.ts`, `src/data/chainTypes.ts`, `src/services/chainVisuals.ts`, `src/data/balance.ts`, `src/services/chainDistribution.ts`, `src/services/presetPoolBuilder.ts`, `src/services/gameFlowController.ts`, `src/services/encounterBridge.ts`, `src/ui/components/StudyTempleScreen.svelte`

---

## What Chains Are

A **Knowledge Chain** forms when a player plays cards via Charge Correct that match the **active chain color** for the current turn. Each matching card extends the chain and applies a higher damage multiplier. The chain decays at the end of each player turn (not a full reset — `decayChain()` reduces length by 1 each turn so momentum carries forward).

Chains only form through **Charge Correct** plays — Quick Play and Charge Wrong do not extend a chain. A card with no `chainType` (undefined/null) resets the chain to 0.

---

## Rotating Active Chain Color (AR-310)

Each turn, one of the 3 run chain types is deterministically selected as the **active chain color**. Only cards matching the active color extend the chain multiplier. Cards of non-active colors preserve the current chain length (the multiplier is NOT lost, just not extended).

This forces variety — players cannot hoard a single color to build chains indefinitely.

- **Active color rotates** every turn via `rotateActiveChainColor(turnNumber)`
- **Active color can switch mid-turn** via a correct off-colour Charge — see Mid-Turn Switch section below
- **Chain multiplier persists** across turns regardless of which color is active
- **Rotation is deterministic** — seeded from `RunState.runSeed` + turn number so it is predictable and reproducible
- `getActiveChainColor()` — returns the active chain type index for the current turn (used by `CardHand.svelte` to highlight matching cards)

### 

Must be called from `encounterBridge.ts` before `startEncounter()` for each new combat encounter. Stores the run chain types and rotation seed so `rotateActiveChainColor()` can compute the active color for each turn. For curated runs, uses `run.chainDistribution.runChainTypes`; for trivia runs uses `selectRunChainTypes(run.runSeed)`.

### 

Called at encounter start and at the end of each player turn (in `endPlayerTurn()` after `turnState.turnNumber += 1`). Returns the active chain type index for the next turn and sets `_activeChainColor`. Returns `null` if no run chain types are configured.

### Mid-Turn Active Color Switch (2026-04-09)

When a player correctly Charges a card whose `chainType` differs from the current active chain color, the active color **switches** to the new card's color for the remainder of the turn. This is a strategic pivot lever:

- **Trigger**: `playMode === 'charge'` AND `answeredCorrectly === true` AND `card.chainType !== getActiveChainColor()`
- **Effect**: `switchActiveChainColor(card.chainType)` is called before `extendOrResetChain()`
- **Chain length is preserved**: answering correctly earned the pivot — the player keeps their chain momentum
- **New color is immediately surcharge-free**: the on-colour waiver in `playCardAction` uses `getActiveChainColor()` which now returns the new color
- **Turn-boundary rotation is unchanged**: `rotateActiveChainColor` fires at end-of-turn as before; the mid-turn switch only lasts the current turn
- **Quick Play and wrong Charge do NOT trigger the switch**

```typescript
// switchActiveChainColor(newChainType) in chainSystem.ts:
// - Sets _activeChainColor = newChainType
// - Sets _chain.chainType = newChainType (preserves _chain.length)
// - No-op if newChainType is not in _runChainTypes or if legacy mode
```

After a switch, `turnState.activeChainColor` is also updated so the Svelte UI (ChainCounter, CardHand glow) re-renders reactively via the existing `` prop chain.

---

## Chain Types

There are 6 chain types total (`NUM_CHAIN_TYPES = 6`). Each run uses 3 of the 6, selected deterministically from a seed via `selectRunChainTypes(seed, count)` using a Fisher-Yates LCG shuffle.

All 6 types defined in `CHAIN_TYPES` in `chainTypes.ts`:

| Index | Name | Hex Color | Glow Color |
|-------|------|----------|-----------|
| 0 | Obsidian | `#546E7A` | `rgba(84, 110, 122, 0.30)` |
| 1 | Crimson | `#EF5350` | `rgba(239, 83, 80, 0.30)` |
| 2 | Azure | `#42A5F5` | `rgba(66, 165, 245, 0.30)` |
| 3 | Amber | `#FFA726` | `rgba(255, 167, 38, 0.30)` |
| 4 | Violet | `#AB47BC` | `rgba(171, 71, 188, 0.30)` |
| 5 | Jade | `#26A69A` | `rgba(38, 166, 154, 0.30)` |

Cards are assigned a `chainType` integer (0–5) at run start from the active 3-type subset. This is runtime-only — not persisted to the DB.

---

## Multiplier Scaling

Defined in `CHAIN_MULTIPLIERS` in `balance.ts`:

```typescript
export const CHAIN_MULTIPLIERS: number[] = [1.0, 1.2, 1.5, 2.0, 2.5, 3.5];
export const MAX_CHAIN_LENGTH = 5;
```

| Chain Length | Multiplier | Cards Played |
|-------------|-----------|-------------|
| 0 | 1.0× | no cards played yet |
| 1 | 1.2× | first matching card |
| 2 | 1.5× | second matching card |
| 3 | 2.0× | third matching card |
| 4 | 2.5× | fourth matching card |
| 5 | 3.5× | fifth+ matching card (cap) |

Once `MAX_CHAIN_LENGTH = 5` is reached, the multiplier stays at `3.5×`. Capped via `Math.min(_chain.length + 1, MAX_CHAIN_LENGTH)` in `extendOrResetChain()`.

---

## Core Functions (`chainSystem.ts`)

### `initChainSystem(runChainTypes, seed, deckComposition?)`

Stores run chain types, rotation seed, and optional deck composition for active chain color selection. Call once per encounter from `encounterBridge.ts`. The `deckComposition` parameter (AR-7.7) accepts a `Map<chainTypeIndex, cardCount>` for weighted rotation.

### `extendOrResetChain(chainType, chainMultiplierOverride?, isOffColourWrong?)`

Called by `turnManager` on every Charge play:

- If `chainType === null/undefined` AND `isOffColourWrong === false` (default) — **fully resets** chain to 0, returns `1.0`
- If `chainType === null/undefined` AND `isOffColourWrong === true` (AR-7.8) — **halves** chain length (floor, min 1), returns `1.0`
- **Rotation mode** (when `_runChainTypes` is configured):
  - If `chainType === _activeChainColor` — extends chain (length + 1), returns new multiplier
  - If `chainType !== _activeChainColor` — chain length preserved (multiplier unchanged), no extension
- **Legacy mode** (no run chain types configured — trivia/test contexts):
  - If `chainType === _chain.chainType` — increments `_chain.length`, returns `CHAIN_MULTIPLIERS[length]`
  - If `chainType !== _chain.chainType` — resets to new chain with `length: 1`, returns `1.2`
- `chainMultiplierOverride` — clamps the multiplier to a fixed value (used by The Nullifier enemy, AR-59.13)

### `rotateActiveChainColor(turnNumber)`

Selects active chain color for the given turn. LCG: `(seed * 1664525 + turnNumber * 1013904223) & 0xFFFFFFFF`. Returns one of the 3 run chain types or `null` if none configured. Uses **uniform** (1/3) distribution across the 3 run chain types.

### `rotateActiveChainColorWeighted(turnNumber, deckComposition?)` (AR-7.7)

Like `rotateActiveChainColor` but **weighted** by deck composition. A chain type with 13 cards out of 24 total appears as the active color ~54% of turns rather than a uniform 33%. Falls back to uniform rotation when `deckComposition` is empty or all counts are zero.

- `deckComposition: Map<chainTypeIndex, cardCount>` — passed in or stored via `initChainSystem`.
- The internal rotation seed is still deterministic (same LCG), but the roll is bucketed by card count rather than index count.
- Unit tested: given `{A:13, B:10, C:1}`, 10,000 rolls produce ratios within 5% of the expected proportions.

### `resetChain()`

Fully resets chain to `{ chainType: null, length: 0 }`. Called at encounter start.

### `decayChain()`

Called at end of each player turn. Reduces chain length by `CHAIN_DECAY_PER_TURN` (1). If length reaches 0, clears chain type. Partial momentum carries into the next turn.

### `getChainMultiplier(length)`

Returns `CHAIN_MULTIPLIERS[clamp(0, length, MAX_CHAIN_LENGTH)]`. Safe lookup with `?? 1.0` fallback.

### `getChainState()`

Returns a snapshot `{ chainType: number | null, length: number }` for UI consumption.

### `getActiveChainColor()`

Returns the active chain type index for the current turn, or `null` if not configured. Used by the UI to highlight cards that would extend the chain.

---

## Chain Momentum (AR-122)

```typescript
export const CHAIN_MOMENTUM_ENABLED = true;
```

When enabled: a correct Charge answer waives the +1 AP surcharge on the **next** Charge that same turn. This rewards consecutive Charge plays within a turn, not just same-chainType plays.

---

## How Chains Interact with Damage

The chain multiplier is passed into `cardEffectResolver.ts` as `options.chainMultiplier`. The full attack formula:

```
CC damage = getMasteryStats(mechanicId, level).qpValue × 1.75 × chainMult × relicMods + inscriptionBonus
```

Tier multipliers are all 1.0 for active tiers and do not appear in the formula. The chain multiplier applies to the **full resolved damage** after base + mastery scaling, before relic flat bonuses. Chain Lightning (`chain_lightning` mechanic) is the only card that reads `chainLightningChainLength` directly — its CC damage is `baseValue × chain length` rather than using the standard multiplier.

---

## Break / Preserve Conditions (AR-310 update, 7.8 partial-reset update)

The chain **fully resets** in these cases:

1. **Encounter start** — `resetChain()` is called by `startEncounter()` for a clean slate
2. **Wrong on-colour charge** — `extendOrResetChain(null, undefined, false)` (default `isOffColourWrong=false`) resets chain to 0
3. **Turn decay** — `decayChain()` at end of each turn reduces length by 1 (not a full reset)

The chain is **partially reduced** (7.8) when:

- **Wrong off-colour charge** — `extendOrResetChain(null, undefined, isOffColourWrong=true)`. Chain length is halved (floored, minimum 1) instead of fully reset. Fires in `turnManager.ts` when `playMode === 'charge'` and `!answeredCorrectly` and `cardInHand.chainType !== getActiveChainColor()`.

The chain does NOT change when:

4. **Non-active color played correctly** (AR-310) — playing a card whose color does not match the active chain color via CC. Chain length is preserved; only extension is skipped.
5. **Quick Play** — QP does not call `extendOrResetChain()`; chain state unchanged

---

## Visual Feedback (`chainVisuals.ts`)

`chainVisuals.ts` maps `chainType` integers to display colors for `CardHand.svelte`:

- `getChainColor(chainType)` — returns hex color; `#888888` if undefined
- `getChainGlowColor(chainType)` — returns rgba glow color; `rgba(136,136,136,0.30)` if undefined
- `getChainColorGroups(cards)` — groups card IDs by shared `chainType`; only includes groups with 2+ cards (potential chain partners worth highlighting)

Cards with the same `chainType` in hand are visually grouped so players can identify chain opportunities before playing. The `activeChainColor` field on `TurnState` (set by `rotateActiveChainColor`) allows the UI to highlight which cards would extend the chain this turn.

### Chain Combo Escalating Visual Feedback (Spec 03)

As the player builds a chain, the environment visually escalates at four thresholds. All values come from `getChainAtmosphereModifiers(chainCount, chainType)` in `chainVisuals.ts`.

| Chain Length | Particles | Point Lights | Vignette Pulse | Screen Shake | Tint Overlay | Depth Pulse |
|---|---|---|---|---|---|---|
| 0–1 | Baseline | Baseline (1.0×) | Off | None | None | Off |
| 2 | 0.8× interval (~20% more) | 1.0× | Off | None | None | Off |
| 3–4 | 0.7× interval (~40% more) | 1.25× + 30% color blend | Off | micro | None | Off |
| 5–6 | 0.5× interval (2× rate) | 1.5× + 50% color blend | α=0.08 | micro | 0.05α | Off |
| 7+ | 0.5× interval (2× rate) | 1.8× + 70% color blend, 2× flicker | α=0.10 | medium | 0.05α | Yes |

**Integration wiring** (`encounterBridge.ts`):
- `scene.onChainUpdated(chainLength, chainType)` — called after every card play resolution (uses `result.turnState.chainLength` / `.chainType`). Also called after turn-end so the UI reflects chain decay.
- Chain decay happens inside `endPlayerTurn()` (`decayChain()` reduces length by 1), so the post-turn-end call correctly shows the decayed chain.

**`CombatScene` API:**
- `onChainUpdated(chainCount, chainType)` — coordinates particles, point lights, vignette, tint overlay, depth breathing. Handles `reduceMotion` path (lights only) and `isTurboMode()` (full skip).
- `onChainBroken()` — calls `onChainUpdated(0, undefined)` for full 500ms reset.
- `currentChainCount` — stored on scene for use by per-card shake triggers.

**Device tier handling:**
- Low-end: particle rate changes skipped (`applyChainModifiers` no-op); vignette/tint overlays still active (cheap alpha tween on a Rectangle).
- DepthLightingSystem already gated by `this.enabled`; chain light override is automatically no-op on low-end.
- Reduce-motion: only point light intensity/color changes apply; no tweens, no particles, no screen shake.

---

## Knowledge Surge System (AR-59.4)

Related system that runs on a turn schedule (not per-play):

```typescript
export const SURGE_FIRST_TURN = 2;
export const SURGE_INTERVAL = 4;
```

Surge turns occur on turn 2, then every 4 turns (turns 2, 6, 10, ...). Surge provides a bonus that stacks with chain multipliers. Exact Surge bonuses are defined in `turnManager.ts` [UNVERIFIED — not in chainSystem.ts].

---

## Themed Chain Distribution (`chainDistribution.ts`)

For curated deck runs (Study Temple mode), chain types are assigned to deck sub-topics rather than randomly to individual cards. This lets players learn that "the Azure chain is vocabulary" or "Crimson chain covers grammar" within a run.

### Types

```typescript
interface TopicGroup {
  id: string;        // sub-deck ID or synthetic id like "pos_noun", "theme_2"
  label: string;     // display name: "Ancient Wonders", "Nouns", "Group 1"
  deckId: string;
  factIds: string[]; // filtered to active run pool (per-deck only, not cross-deck)
  fsrs: { new: number; learning: number; review: number; mastered: number };
}

interface ChainDistribution {
  runChainTypes: number[];                          // 3 indices, e.g. [0, 2, 4]
  assignments: [TopicGroup[], TopicGroup[], TopicGroup[]]; // topics per chain slot
  factToChain: Map<string, number>;                // factId → chain type index
}
```

`ChainDistribution` lives on `RunState.chainDistribution` (optional). The `Map` it contains is NOT JSON-serializable — it is excluded from `runSaveService.ts` serialization (listed in the `Omit<>` type) and must be recomputed on run resume if needed.

### TopicGroup Extraction Waterfall

`extractTopicGroups(deck, factIds, reviewStates)` applies these rules in priority order:

**IMPORTANT:** `factIds` must be scoped to the current deck only. When calling from `extractTopicGroupsMultiDeck`, the function internally scopes fact IDs per deck — do NOT pass the full cross-deck pool directly to `extractTopicGroups`.

1. **Sub-decks** — if the deck JSON has a `subDecks[]` array, each sub-deck becomes one TopicGroup.
   - Sub-decks with an explicit `factIds` array use those directly.
   - Sub-decks with only a `chainThemeId` (e.g. ancient_greece) match facts by their `fact.chainThemeId` field so real sub-deck names are used (not generic "Group N" labels).
   - Sub-decks with no pool facts are skipped.
2. **Part of speech** — if facts have `partOfSpeech` field, group by POS. Groups below the proportional threshold are merged into a single "Other" group. Threshold: `max(5, floor(poolSize × 0.03))` — scales with pool size to avoid dozens of tiny groups (e.g. "Pronouns (14)") for large pools like All Chinese (~7000 facts). Label: capitalize POS + "s" (e.g., "Nouns", "Verbs").
   - **No-drop safety net**: facts in the run pool that have NO `partOfSpeech` field are distributed round-robin across the existing POS groups. This prevents mixed decks (e.g. Chinese/Spanish with partially-tagged facts) from silently losing ungrouped facts. Without this fix, a 466-fact deck showed only 70 facts.
   - FSRS summaries are recomputed after round-robin distribution.
3. **chainThemeId fallback** — group by `fact.chainThemeId` value. Labels are generic ("Group 1", "Group 2", …). Only reached if sub-deck extraction produced no groups.

`extractTopicGroupsMultiDeck(decks, factIds, reviewStates)` pools results from all decks. It scopes each `extractTopicGroups()` call to only that deck's own fact IDs (intersected with the global pool), preventing cross-deck contamination in the ungrouped-facts safety net.

### FSRS-Balanced Bin-Packing

`distributeTopicGroups(groups, runChainTypes, seed)` uses greedy LPT (Longest Processing Time) bin-packing:

1. **Load score** per group: `new×3 + learning×2 + review×1 + mastered×0.5`
2. **Seeded shuffle** of equal-score groups using the same LCG RNG as `selectRunChainTypes()` (seed = `RunState.runSeed`)
3. **Sort descending** by score (heaviest groups assigned first)
4. **Greedy assignment**: each group goes to the chain slot with the lowest cumulative load
5. **Edge-case guard**: if fewer than 3 groups, the largest group is split via round-robin index assignment until 3 chains exist (bounded by total fact count — can't produce more groups than facts)
6. **Dev-mode invariant**: when `window.__rrDebug` is set, logs a `console.warn` if the output `factToChain.size` does not match the total input fact count. This catches any future regression where facts are lost before reaching `distributeTopicGroups`.

The result is stored in `RunState.chainDistribution` and the `factToChain` Map provides O(1) lookup during card assignment in `presetPoolBuilder.ts`.

### Full Pipeline: `precomputeChainDistribution()`

`precomputeChainDistribution(deckMode, reviewStates, seed)` in `chainDistribution.ts` runs the full pipeline in one call:

**Single deck** (`deckMode.deckId` without `all:` prefix):
1. Loads the curated deck via `getCuratedDeck(deckId)`
2. Filters factIds by `subDeckId` if specified (supports both `factIds` and `chainThemeId` sub-deck styles)
3. Calls `extractTopicGroups()` → `distributeTopicGroups()`
4. Returns `ChainDistribution | undefined` (undefined for non-curated runs)

**Multi-deck language aggregate** (`deckMode.deckId` with `all:` prefix, e.g. `"all:chinese"`):
1. Finds all loaded curated decks whose ID starts with the language key (e.g. `chinese_hsk1` through `chinese_hsk6`)
2. Combines all fact IDs from all matching decks
3. Calls `extractTopicGroupsMultiDeck()` → `distributeTopicGroups()`
4. This gives "All Chinese" the full ~7000 facts instead of only HSK1 (466 facts)

Previously, `all:` runs returned `undefined` from `precomputeChainDistribution` and `StudyTempleScreen.svelte` resolved `all:chinese` to `chinese_hsk1` (first match only), limiting the pool to 466 facts. Both bugs are now fixed.

### StudyTempleScreen `all:` Routing Fix

`handleStartStudyRun()` in `StudyTempleScreen.svelte` now passes the `all:` prefix through to downstream systems unchanged when no `subDeckId` is selected:

```typescript
// Before (broken): resolved to first sub-deck only
actualDeckId = firstMatch.id; // 'chinese_hsk1'

// After (fixed): passes through for downstream handling
actualDeckId = deckId; // 'all:chinese'
```

`encounterBridge.ts` already handled `all:` correctly via `buildLanguageRunPool`, and `precomputeChainDistribution` now handles it too.

### Wiring into `gameFlowController.ts`

In `onArchetypeSelected()`, after `createRunState()` and before `activeRunState.set(run)`:
- Calls `precomputeChainDistribution(run.deckMode, reviewStates, run.runSeed)`
- If a distribution is returned, stores it on `run.chainDistribution`
- Routes to `currentScreen.set('runPreview')` if distribution exists (Study Temple)
- Routes to `currentScreen.set('dungeonMap')` if no distribution (Trivia/General)

`gameFlowState` has a new `'runPreview'` variant for this routing.

### Run Preview Helpers (`gameFlowController.ts`)

```typescript
reshuffleChainDistribution(seedOffset: number): void
```
Recomputes the distribution with `run.runSeed + seedOffset` (unsigned 32-bit wrap) and updates `RunState`. Called by the RunPreviewScreen "Shuffle" button.

```typescript
confirmChainDistribution(): void
```
Transitions `gameFlowState` and `currentScreen` to `'dungeonMap'`. Called by the RunPreviewScreen "Begin Expedition" button.

### Pool Builder Integration (`presetPoolBuilder.ts`)

`buildPresetRunPool()`, `buildGeneralRunPool()`, and `buildLanguageRunPool()` all accept `chainDistribution?: ChainDistribution` in their options.

**Important — factId space mismatch:** Curated deck JSON files use string fact IDs (e.g. `"ww_anc_pyramid_giza_height"`), while `factsDB` (SQLite) uses integer IDs. The `chainDistribution.factToChain` Map is keyed on curated deck IDs, so `factToChain.get(card.factId)` returns `undefined` for every pool card — they come from different ID spaces. Do NOT attempt to use `factToChain` for card assignment in `presetPoolBuilder.ts`.

**Proportional assignment (current implementation):**
When `chainDistribution` is provided, chain types are assigned proportionally based on how many facts each chain's topic groups contain:
1. Compute total fact count per chain slot (sum of all `g.factIds.length` across that chain's groups)
2. Shuffle pool card indices seeded with `getRunRng('chain')`
3. Build a `chainSlots[]` array sized to the pool, filling each chain's share by proportion
4. Assign each shuffled card index to the corresponding slot

This preserves the intended topic-group weighting across the run while avoiding any factId dependency.

When `chainDistribution` is absent (trivia/general runs):
- Round-robin seeded shuffle assigns chain types (`i % runChainTypes.length`)

In `encounterBridge.ts`, ALL Study Temple paths now pass `chainDistribution: run.chainDistribution`:
- `type: 'language'` mode → `buildLanguageRunPool()`
- `type: 'study'`, `all:` aggregate → `buildLanguageRunPool()`
- `type: 'study'`, single vocabulary deck → `buildLanguageRunPool()`
- `type: 'study'`, single knowledge deck → `buildGeneralRunPool()`

### Old vs. New Assignment

Previously: all cards received chain types via a seeded shuffle with `i % 3` round-robin — purely random with no semantic meaning.

Then: topic-aware lookup via `factToChain.get(card.factId)` was introduced but was silently broken because curated deck fact IDs and factsDB fact IDs are different ID spaces — every lookup returned `undefined`, causing all cards to fall back to `runChainTypes[0]` (a single color for the whole run).

Current: proportional assignment by chain group size. The distribution's weighting is preserved (chains with more facts get proportionally more cards), and language/vocabulary deck paths all receive chain distribution so Study Temple runs always show multiple colors.

`all:` language aggregates (e.g. "All Chinese") now correctly load all sub-decks (~7000 facts) instead of only the first matching sub-deck (466 facts).
