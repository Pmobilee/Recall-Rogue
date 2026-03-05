# Phase 55: Economy Depth

**Status**: Not Started
**Depends On**: Phase 4 (Economy & Base — mineral tiers, crafting, Materializer), Phase 21 (Monetization — Terra Pass, premium economy), Phase 55 resolves open design questions Q-E1, Q-E2, Q-E3
**Estimated Complexity**: Medium — primarily UI updates and data changes; `DuplicateMixingModal.svelte` already exists (audit its implementation); `PremiumMaterializer.svelte` already exists (verify its completeness)
**Design Decisions**: DD-020 (duplicate mixing), Q-E1 (compression tax), Q-E2 (rescue beacon cost), Q-E3 (daily deals), DD-V2 premium economy notes

---

## 1. Overview

Phase 55 closes the economy loop by implementing five systems that convert raw minerals and duplicate artifacts into meaningful sinks and sources of player agency. The goal is an economy where every mineral has a clear purpose and players make genuine trade-off decisions.

### What Exists Already

| File | Status |
|---|---|
| `src/ui/components/DuplicateMixingModal.svelte` | Component exists — audit whether it is wired and functional |
| `src/ui/components/PremiumMaterializer.svelte` | Exists — verify completeness of premium station UI |
| `src/ui/components/Materializer.svelte` | Standard crafting station UI |
| `src/ui/components/rooms/MarketRoom.svelte` | Daily deal display — verify current implementation |
| `src/data/dailyDeals.ts` | Daily deal type definitions — audit current state |
| `src/data/balance.ts` | Has `MINERAL_COMPRESSION_TAX` — audit whether it is applied |
| `src/data/consumables.ts` | Has `rescue_beacon` added by Phase 51; verify cost is set |

### Audit Instructions for Workers

Before implementing, audit the current state of each existing file:
- `DuplicateMixingModal.svelte`: Is it reachable from any room UI? Does it call a functional backend path to resolve the mix?
- `PremiumMaterializer.svelte`: Is it mounted in `App.svelte` or a room? Does it accept Primordial Essence as currency?
- `MarketRoom.svelte`: Does it display daily deals? Are deals refreshed daily?
- `balance.ts` `MINERAL_COMPRESSION_TAX`: Is this constant consumed anywhere in the compression logic?

---

## 2. Sub-phases

---

### 55.1 — Duplicate Fact Mixing at Materializer (Resolve DD-020)

**Goal**: The Materializer should have a "Fact Recycling" station where the player selects 3+ duplicate artifact cards and mixes them, producing a single new artifact with an upward rarity bias and a mineral fee sink.

#### 55.1.1 — Audit `DuplicateMixingModal.svelte`

Read the current file. If the component:
- Is not reachable from any room → wire it into `Materializer.svelte` as a tab or button.
- Does not implement the rarity roll → add the roll logic below.
- Is fully functional → skip to 55.1.2.

#### 55.1.2 — Mixing rarity roll in `playerData.ts`

Add (or verify existence of) a `mixArtifacts()` function in `src/ui/stores/playerData.ts`:

```typescript
/**
 * Mixes 3+ duplicate artifact cards, consuming them and producing a single
 * new artifact with a probabilistic rarity boost.
 *
 * Roll table (from the input cards' base rarity):
 *   60% — same tier as input cards
 *   30% — one tier up
 *   10% — two tiers up (capped at 'mythic')
 *
 * @param inputCardIds  Instance IDs of the artifact cards to mix (must be >= 3)
 * @param mineralFee    Record of { tier: amount } to deduct as a mixing fee
 * @returns The rarity of the output artifact
 */
export function mixArtifacts(
  save: PlayerSave,
  inputCardIds: string[],
  mineralFee: Partial<Record<MineralTier, number>>
): { updatedSave: PlayerSave; outputRarity: Rarity } {
  if (inputCardIds.length < 3) throw new Error('Mixing requires at least 3 artifacts')

  // Deduct mineral fee
  let updated = { ...save }
  for (const [tier, amount] of Object.entries(mineralFee)) {
    updated.minerals[tier as MineralTier] = Math.max(0, (updated.minerals[tier as MineralTier] ?? 0) - (amount ?? 0))
  }

  // Determine base rarity from input cards
  const baseRarity = determineBaseRarityFromCards(save, inputCardIds) // 'common' if mixed

  // Roll output rarity
  const roll = Math.random()
  let outputRarity: Rarity = baseRarity
  if (roll < 0.10) outputRarity = upgradeRarity(baseRarity, 2)
  else if (roll < 0.40) outputRarity = upgradeRarity(baseRarity, 1)

  // Remove input cards from inventory (mark as consumed)
  updated.artifactCards = (updated.artifactCards ?? []).filter(c => !inputCardIds.includes(c.instanceId))

  return { updatedSave: updated, outputRarity }
}
```

Balance constants in `balance.ts`:

```typescript
MIX_MIN_CARDS: 3,
MIX_FEE_DUST: 100,    // Mineral fee to mix (payable in any combination)
MIX_RARITY_SAME:     0.60,
MIX_RARITY_ONE_UP:   0.30,
MIX_RARITY_TWO_UP:   0.10,
```

#### 55.1.3 — `DuplicateMixingModal.svelte` full wire-up

Ensure `DuplicateMixingModal.svelte`:
- Is accessible from a "Recycle Artifacts" button in `Materializer.svelte`.
- Displays the player's artifact collection filtered to show only duplicates (cards where the same `factId` appears 2+ times).
- Shows a mineral fee preview ("Costs 100 Dust").
- On confirm: calls `mixArtifacts()`, then shows a gacha-style reveal animation (`GachaReveal.svelte`) for the output artifact.
- Handles the case where the player selects cards of mixed rarities (use the most common rarity in the selection as the base).

**Acceptance Criteria**:
- A "Recycle Artifacts" button is visible in the Materializer room.
- Selecting 3+ duplicate artifact cards and clicking "Mix" deducts 100 Dust and consumes the input cards.
- A rarity reveal animation plays, showing the output artifact's rarity (60% same, 30% one up, 10% two up).
- The output artifact enters the player's artifact collection.
- Mixing requires exactly 3 minimum; UI prevents confirming with fewer.

---

### 55.2 — Mineral Compression Tax (Resolve Q-E1)

**Goal**: When compressing minerals to a higher tier (e.g., 100 Dust → 1 Shard), require an additional 5% of the lower tier as a compression loss fee. This is an economy sink.

#### 55.2.1 — Balance constant in `src/data/balance.ts`

Verify or add:

```typescript
MINERAL_COMPRESSION_TAX: 0.05, // 5% of input tier required as waste
```

#### 55.2.2 — Compression logic audit in `Materializer.svelte` or `playerData.ts`

Locate where mineral compression is computed. Add the tax:

```typescript
/**
 * Computes the actual input cost for a compression (including 5% tax).
 * e.g., compressing 1 Shard costs 100 Dust + 5 Dust tax = 105 Dust total.
 */
export function compressionCost(baseInputAmount: number): number {
  return Math.ceil(baseInputAmount * (1 + MINERAL_COMPRESSION_TAX))
}
```

The compression ratios (e.g., 100 Dust → 1 Shard) are unchanged; only the fee is added on top.

#### 55.2.3 — UI display in `Materializer.svelte` or `MineralConverter.svelte`

In the compression UI (likely `src/ui/components/MineralConverter.svelte` if it exists, or a section of `Materializer.svelte`), show the fee explicitly:

```
Convert: 100 Dust + 5 Dust (compression loss) → 1 Shard
```

Format: `"[base] + [tax] (compression loss) → [output]"`. The tax line should be in a muted color (grey) to indicate it is waste.

**Acceptance Criteria**:
- Compressing 100 Dust to 1 Shard requires 105 Dust total (100 base + 5 tax).
- The compression UI shows the tax amount explicitly.
- The tax is deducted from `PlayerSave.minerals` when compression is confirmed.
- Compression still produces the correct output (1 Shard) regardless of the tax.

---

### 55.3 — Rescue Beacon Crafting Cost (Resolve Q-E2)

**Goal**: Confirm the Rescue Beacon crafting cost is set to 200 Crystals + 2 Geodes (as added in Phase 51). Verify this is surfaced in the Workshop/Materializer UI as a visible, enticing recipe.

#### 55.3.1 — Recipe visibility audit

Verify that the `recipe_rescue_beacon` recipe (added in Phase 51 step 51.5.2) appears in the crafting station UI with the correct cost display:

```
Rescue Beacon
Cost: 200 Crystal + 2 Geode
→ Emergency extraction with zero loot loss
```

If Phase 51 has not been implemented: add the recipe directly in this phase. See Phase 51 step 51.5.2 for the exact recipe definition.

#### 55.3.2 — Recipe unlock requirement

The Rescue Beacon recipe should be visible from the start (no unlock gate) but the cost (200 Crystal + 2 Geode) places it in mid-game territory. Add a tooltip: "Mid-game item — requires reaching Layer 4+ for Geode drops."

**Acceptance Criteria**:
- Rescue Beacon crafting recipe is visible in the Materializer/Workshop with correct cost.
- Player cannot craft it until they have 200 Crystal and 2 Geode.
- Recipe shows the item description and a "0 owned" inventory count.

---

### 55.4 — Daily Deal Structure (Resolve Q-E3)

**Goal**: The shop always has exactly 3 daily deal slots with fixed roles. Slot 1: consumable at 20% discount. Slot 2: cosmetic at standard price (exclusive rotation). Slot 3: "Featured Deal" on a 7-day cycle with a Rare+ item guaranteed every 7th day.

#### 55.4.1 — `dailyDeals.ts` daily deal generation

Audit `src/data/dailyDeals.ts`. Replace or extend with a structured 3-slot generation function:

```typescript
export interface DailyDeal {
  id: string
  slot: 1 | 2 | 3
  itemType: 'consumable' | 'cosmetic' | 'featured'
  itemId: string
  displayName: string
  basePrice: { mineralTier: MineralTier; amount: number } | { currency: 'premium'; amount: number }
  discountPercent: number  // 0 for standard price, 20 for slot 1 discount
  expiresAt: number        // Unix timestamp midnight UTC
  /** For slot 3: which day in the 7-day rotation (1-7). Day 7 = guaranteed Rare+ */
  featuredDay?: number
}

/**
 * Generates the 3 daily deal slots for a given calendar day (UTC).
 * Uses a deterministic seed based on the date string so all players see the same deals.
 */
export function generateDailyDeals(dateIsoUtc: string): DailyDeal[] { ... }
```

#### 55.4.2 — Deal rotation logic

- **Slot 1 (Consumable)**: Rotate through `[bomb, flare, o2_cache, drill_charge, rescue_beacon]` using `dayIndex % consumablePool.length`. Apply 20% discount off the standard mineral price.
- **Slot 2 (Cosmetic)**: Rotate through all non-earned cosmetics using `dayIndex % cosmeticPool.length`. Standard price (no discount). Marks the item as exclusive to this day's deal — it will not appear in the standard cosmetics shop until the next rotation cycle.
- **Slot 3 (Featured Deal)**: `featuredDay = (dayIndex % 7) + 1`. Days 1–6: rotate through uncommon items. Day 7: guarantee a Rare or higher item (randomly selected from `rarity >= 'rare'` pool). Show "PITY DAY" badge on Day 7 in the UI.

#### 55.4.3 — `MarketRoom.svelte` 3-slot layout

In `src/ui/components/rooms/MarketRoom.svelte`, replace any existing deal display with a strict 3-slot layout:

```svelte
<div class="daily-deals">
  <h2>Daily Deals <span class="refresh-timer">{timeUntilRefresh}</span></h2>
  <div class="deal-grid">
    {#each dailyDeals as deal}
      <DealCard {deal} onPurchase={handlePurchase} />
    {/each}
  </div>
</div>
```

The refresh timer shows `HH:MM:SS` until midnight UTC. Slot 3 shows a 7-day progress strip (7 dots, current day highlighted, Day 7 marked as "Pity").

**Acceptance Criteria**:
- Market room always shows exactly 3 daily deal slots.
- Slot 1 is always a consumable at a 20% discount.
- Slot 2 is always a cosmetic at standard price.
- Slot 3 rotates through a 7-day cycle; Day 7 shows a Rare+ item.
- Deals are identical for all players on the same UTC calendar day.
- Deals refresh at midnight UTC (countdown timer visible).
- Purchased deals cannot be purchased again that day (deducted from `purchasedDeals`).

---

### 55.5 — Premium Materializer Distinction

**Goal**: The Premium Materializer must be visually distinct (different sprite, golden glow), accept only Primordial Essence as currency, and offer only cosmetic items. Verify the existing `PremiumMaterializer.svelte` meets these requirements; patch gaps.

#### 55.5.1 — Audit `PremiumMaterializer.svelte`

Read the component. Verify:
1. It uses `premiumMaterials['primordial_essence']` from `PlayerSave.premiumMaterials` as currency.
2. It lists only cosmetic items (no gameplay-advantageous items).
3. It has a visual distinction (golden border, glow effect) from the standard Materializer.

If any of these are absent, implement them.

#### 55.5.2 — Item type guard in `PremiumMaterializer.svelte`

Ensure the item list is filtered so only items with `type: 'cosmetic'` (or an equivalent flag) appear. Add a runtime guard:

```typescript
// In PremiumMaterializer.svelte script:
const premiumItems = PREMIUM_RECIPES.filter(recipe => recipe.outputType === 'cosmetic')
// If any non-cosmetic item is present in PREMIUM_RECIPES, log a warning and exclude it.
```

#### 55.5.3 — Visual distinction

The Premium Materializer should:
- Have a `gold-glow` CSS class: `box-shadow: 0 0 20px rgba(255, 200, 0, 0.6)`.
- Display a "PREMIUM" badge in the top-right corner of the station panel.
- Show the player's Primordial Essence balance with a distinct icon (⚗ or equivalent).
- Use a warm golden color scheme (background hue-rotate toward gold) distinct from the standard teal/blue Materializer.

**Acceptance Criteria**:
- Premium Materializer is visually distinct from the standard Materializer with a golden glow and PREMIUM badge.
- Only cosmetic items appear in the premium list (miner skins, pickaxe skins, dome decorations, pet cosmetics).
- Currency shown is Primordial Essence, not standard minerals.
- Player cannot purchase premium cosmetics with standard minerals.
- No gameplay-advantageous items (stat bonuses, extra oxygen, better odds) appear in the premium store.

---

## 3. Verification Gate

- [ ] `npm run typecheck` passes with 0 errors.
- [ ] `npm run build` completes successfully.
- [ ] "Recycle Artifacts" button is visible in Materializer room.
- [ ] Selecting 3+ duplicate artifacts and confirming mix: input cards consumed, 100 Dust deducted, rarity reveal animation plays.
- [ ] Over 20 mixes: approximately 60% same rarity, 30% one up, 10% two up (statistical, not exact — verify directional trend).
- [ ] Mineral compression in the Materializer shows "+5 Dust compression loss" for a Dust→Shard conversion and deducts 105 Dust total.
- [ ] Market room shows exactly 3 deal slots with correct slot roles.
- [ ] Day 7 of the 7-day cycle: Featured Deal shows a Rare+ item with "PITY DAY" badge.
- [ ] Countdown timer in Market room ticks toward midnight UTC.
- [ ] Premium Materializer has golden glow styling.
- [ ] Premium Materializer lists only cosmetic items.
- [ ] Attempting to purchase a premium item without Primordial Essence shows an insufficient funds message.
- [ ] Rescue Beacon recipe visible in Materializer with 200 Crystal + 2 Geode cost.

---

## 4. Files Affected

### Modified
- `src/data/balance.ts` — add `MIX_MIN_CARDS`, `MIX_FEE_DUST`, `MIX_RARITY_*`, `MINERAL_COMPRESSION_TAX` (verify/update), rescue beacon cost constants (if not already from Phase 51)
- `src/data/dailyDeals.ts` — replace or extend with 3-slot deterministic deal generation
- `src/ui/stores/playerData.ts` — add or verify `mixArtifacts()`, `compressionCost()` helper
- `src/ui/components/DuplicateMixingModal.svelte` — full wire-up to Materializer; implement rarity roll if absent
- `src/ui/components/Materializer.svelte` — "Recycle Artifacts" button; compression tax display
- `src/ui/components/MineralConverter.svelte` (if exists) — compression tax display
- `src/ui/components/rooms/MarketRoom.svelte` — 3-slot layout, 7-day rotation strip
- `src/ui/components/PremiumMaterializer.svelte` — visual distinction, cosmetic-only guard, Primordial Essence currency display

### New
- None expected; all work extends existing files
