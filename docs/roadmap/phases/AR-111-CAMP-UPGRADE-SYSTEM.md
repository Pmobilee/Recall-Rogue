# AR-111: Camp Upgrade System — Full PSD-Driven Campsite Overhaul

## Overview

Complete overhaul of the campsite hub using a new layered PSD (`data/generated/camp-art/NEW_CAMP_WITH_UPGRADES.psd`) that provides upgrade tiers for every camp element. Players spend Dust in a new shop UI to upgrade individual camp elements, each visually evolving through up to 7 tiers. The campsite becomes the primary Dust sink and a visual progression showcase.

**PSD dimensions:** 1536x2784 (portrait 9:16). Landscape uses existing `camp-background-wide.jpg` which already matches.

**Key design rules:**
- Thick black borders on ALL interactive camp elements (scaling with screen size)
- Remove all text labels from the campsite — borders alone indicate clickables
- Fireplace always renders IN FRONT of the anvil (z-order)
- Character always renders IN FRONT of the tent
- Pet always renders IN FRONT of the character
- Settings element never changes (1 tier only, no upgrades)
- Anvil/relics ignored for this AR

---

## PSD Layer Analysis

The PSD has 7 groups (Group 0 = base/default, Groups 1-6 = upgrade tiers). Each group contains positioned sprites for each element at that tier level. Not all elements appear in every group.

### Element Upgrade Tier Counts

| Element | Upgrade Tiers | Groups Present | Notes |
|---------|:---:|---|---|
| Cave Background | 1 | Always on | Static, never upgrades |
| Tent | 7 | 0,1,2,3,4,5,6 | Player's shelter |
| Character | 7 | 0,1,2,3,4,5,6 | Avatar appearance |
| Pet | 6 | 0,1,3,4,5,6 | Missing from Group 2 |
| Campfire | 6 | 0,2,3,4,5,6 | Missing from Group 1 |
| Library | 6 | 0,1,2,4,5,6 | Missing from Group 3 |
| Quest Board | 7 | 0,1,2,3,4,5,6 | Quest system hub |
| Shop | 7 | 0,1,2,3,4,5,6 | Dust spending station |
| Journal | 7 | 0,1,2,3,4,5,6 | Player journal |
| Doorway | 7 | 0,1,2,3,4,5,6 | Dungeon entrance |
| Settings | 1 | 0 only | Never changes |

### Z-Order Requirements (front to back)
1. Pet (frontmost)
2. Character
3. Campfire/Fireplace
4. Tent
5. All other elements at their natural depth
6. Cave Background (backmost)

---

## Sub-steps

### 1. Extract PSD layers to individual WebP sprites

- [ ] 1.1 Create `scripts/extract-camp-upgrades.py` that reads the PSD and extracts each layer from each group as a cropped, positioned PNG
- [ ] 1.2 Output structure:
  ```
  public/assets/camp/upgrades/
    tent/tier-0.webp ... tier-6.webp
    character/tier-0.webp ... tier-6.webp
    pet/tier-0.webp ... tier-5.webp
    campfire/tier-0.webp ... tier-5.webp
    library/tier-0.webp ... tier-5.webp
    questboard/tier-0.webp ... tier-6.webp
    shop/tier-0.webp ... tier-6.webp
    journal/tier-0.webp ... tier-6.webp
    doorway/tier-0.webp ... tier-6.webp
    settings/tier-0.webp (one only)
    background/cave-bg.webp (one only)
  ```
- [ ] 1.3 Each sprite must be exported at FULL PSD canvas size (1536x2784) with transparent background, so they overlay perfectly by just stacking them. This is critical — the PSD has each element precisely positioned.
- [ ] 1.4 Convert all outputs to WebP with lossless compression

**Files:** `scripts/extract-camp-upgrades.py`, `public/assets/camp/upgrades/`

**Acceptance:** All tiers extracted. Stacking tier-0 of every element over the background recreates the base campsite exactly.

### 2. Refactor `campState.ts` — expand to all elements

**Current:** 4 elements (`tent`, `seating`, `campfire`, `decor`) with max tier 3.
**New:** 9 upgradeable elements with variable max tiers.

- [ ] 2.1 Replace `CampElement` type:
  ```ts
  export type CampElement =
    | 'tent' | 'character' | 'pet' | 'campfire'
    | 'library' | 'questboard' | 'shop' | 'journal' | 'doorway'
  ```
- [ ] 2.2 Add per-element max tiers:
  ```ts
  export const CAMP_MAX_TIERS: Record<CampElement, number> = {
    tent: 6, character: 6, pet: 5, campfire: 5,
    library: 5, questboard: 6, shop: 6, journal: 6, doorway: 6,
  }
  ```
- [ ] 2.3 Update `UPGRADE_COSTS_BY_TIER` to have costs for up to 6 upgrades (tier 0 is free/base):
  ```ts
  const UPGRADE_COSTS = [80, 120, 200, 320, 500, 750] as const
  ```
- [ ] 2.4 Update `DEFAULT_CAMP_STATE` with all 9 elements at tier 0
- [ ] 2.5 Migrate existing save data: map old `seating` → `library`, old `decor` → `doorway` (or reset gracefully)
- [ ] 2.6 Keep pet/outfit unlocking system as-is — pet TIERS are separate from pet SELECTION

**Files:** `src/ui/stores/campState.ts`

**Acceptance:** TypeScript compiles. State persists correctly. Old saves migrate without crash.

### 3. Refactor `campArtManifest.ts` — new upgrade sprite system

- [ ] 3.1 Replace the old element/outfit/pet art manifest with a simpler tier-based system:
  ```ts
  export function getCampUpgradeUrl(element: CampElement, tier: number): string {
    return `/assets/camp/upgrades/${element}/tier-${tier}.webp`
  }
  ```
- [ ] 3.2 Keep `getCampBackgroundUrl()` and `getCampBackgroundWideUrl()` as-is
- [ ] 3.3 Remove old `getCampSpriteUrl()`, `getCampElementArtUrl()`, etc. — replaced by tier system

**Files:** `src/ui/utils/campArtManifest.ts`

**Acceptance:** All camp components can resolve the correct sprite URL for any element at any tier.

### 4. Rebuild `CampfireCanvas.svelte` / camp scene rendering

The campsite scene must render as a stack of full-canvas sprites (background + one sprite per element at its current tier), not as individually positioned sprites.

- [ ] 4.1 Create/refactor the main camp scene component to:
  - Render the cave background as the base layer
  - For each element, render its current-tier sprite as an absolutely-positioned full-size image
  - Z-order (back to front): background → doorway → library → settings → shop → journal → questboard → tent → campfire → character → pet
  - Fireplace ALWAYS in front of anvil (N/A since anvil excluded, but in front of tent)
  - Character ALWAYS in front of tent
  - Pet ALWAYS in front of character
- [ ] 4.2 All interactive elements get thick black borders via CSS `drop-shadow` (already exists in `CampSpriteButton` as `rpg-outline`)
  - Border thickness scales with viewport: `calc(2px + 0.15vw)` or similar
  - Settings element also gets border (it's clickable, just not upgradeable)
- [ ] 4.3 Remove ALL text labels from the campsite — the black borders indicate clickability
  - Remove `sprite-label` rendering from camp buttons
  - Remove `labelTop`/`labelLeft` usage
- [ ] 4.4 Hitbox areas for each element derived from the non-transparent pixel region of their sprite (or manually defined bounding boxes from the PSD positions)
- [ ] 4.5 Portrait mode: use full-canvas sprites at 1536x2784 ratio, stretched to viewport
- [ ] 4.6 Landscape mode: use existing wide background, reposition element hitboxes to match

**Files:** Camp scene Svelte components, `CampSpriteButton.svelte`

**Acceptance:** Campsite renders with all elements at their correct tiers. Z-order correct. Black borders on all interactive elements. No text labels. Portrait and landscape both work.

### 5. Build the Camp Shop UI

Replace the "coming soon" placeholder in `CampUpgradeModal.svelte` with a full upgrade shop.

- [ ] 5.1 Shop layout — shows ALL 9 upgradeable elements in a scrollable grid/list
- [ ] 5.2 Each element card shows:
  - Element name and icon (small preview of current tier sprite)
  - Current tier indicator (e.g., tier 3/6 shown as pips or progress bar)
  - "Next upgrade" preview — shows the next tier sprite alongside current
  - Upgrade cost in Dust
  - "Upgrade" button (disabled if insufficient Dust or max tier)
  - "MAX" badge if at max tier
- [ ] 5.3 Dust balance always visible at top
- [ ] 5.4 When upgrade purchased:
  - Deduct Dust from player balance
  - Increment element tier in campState
  - Play a brief celebration animation/particle burst
  - Campsite behind the modal updates in real-time
- [ ] 5.5 UI must work in both portrait and landscape:
  - Portrait: vertical scrolling list, full-width cards
  - Landscape: 2-column or 3-column grid
- [ ] 5.6 Nice visual design: dark theme matching game aesthetic, upgrade path visualization showing all tiers as a horizontal track with current position highlighted

**Files:** `src/ui/components/CampUpgradeModal.svelte`

**Acceptance:** Player can browse all elements, see current/next tier, spend Dust to upgrade. UI responsive for both orientations. Real-time campsite visual update on purchase.

### 6. Update camp element click handlers

- [ ] 6.1 Clicking the Shop element opens the Camp Shop modal (step 5)
- [ ] 6.2 Clicking Doorway starts a run (existing behavior)
- [ ] 6.3 Clicking Journal opens journal (existing behavior)
- [ ] 6.4 Clicking Quest Board opens quests (existing behavior)
- [ ] 6.5 Clicking Library opens knowledge library (existing behavior)
- [ ] 6.6 Clicking Settings opens settings (existing behavior)
- [ ] 6.7 Clicking Tent / Character / Pet / Campfire — opens the Shop modal scrolled to that element's upgrade section (shortcut)

**Files:** Camp scene component, click handlers

**Acceptance:** All camp elements are clickable via their hitboxes. Correct actions fire.

### 7. Integrate with existing Dust economy

- [ ] 7.1 Verify Dust is awarded from runs (already exists in playerData)
- [ ] 7.2 Camp upgrades deduct from `playerSave.minerals.dust`
- [ ] 7.3 Ensure upgrade costs are balanced — early tiers cheap (~80-120 Dust), late tiers expensive (~500-750 Dust)
- [ ] 7.4 Total cost to fully upgrade everything: sum across all elements, all tiers = meaningful long-term goal

**Files:** `src/ui/stores/campState.ts`, `src/ui/stores/playerData.ts`

**Acceptance:** Dust deducted correctly on upgrade. Balance persists across sessions. Costs feel fair for progression pace.

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes (update/add tests for new campState)
- [ ] PSD extraction script runs cleanly, all sprites extracted
- [ ] Campsite renders correctly at tier 0 for all elements (fresh save)
- [ ] Upgrading an element visually swaps its sprite in real-time
- [ ] Z-order: pet > character > campfire > tent (verified visually)
- [ ] All elements have thick black borders
- [ ] No text labels on campsite
- [ ] Camp Shop modal shows all elements, costs, upgrade buttons
- [ ] Dust deduction works correctly
- [ ] Landscape mode renders correctly with wide background
- [ ] Portrait mode renders correctly with stacked PSD sprites
- [ ] Settings element is clickable but not upgradeable
- [ ] Old save data migrates cleanly (no crash, no data loss)
