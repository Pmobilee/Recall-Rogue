# AR-78: Modals, Rewards, & Shop — Landscape Adaptation

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §8
> **Priority:** CORE EXPERIENCE
> **Complexity:** Medium
> **Dependencies:** AR-71 (Layout System)

## Context

All overlays/modals are currently full-screen (`position: fixed; inset: 0`). In landscape, they should be centered panels (~65-70% viewport width) with the background dimmed but visible behind.

## Directive

### Step 1: Modal Base Pattern

Create a reusable landscape modal pattern:

```css
.modal-landscape {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6); /* dimmed background */
}
.modal-landscape-content {
  width: min(70vw, 900px);
  max-height: 85vh;
  overflow-y: auto;
  border-radius: calc(12px * var(--layout-scale, 1));
  /* existing panel styling */
}
```

- Click on backdrop (outside panel) = dismiss (where appropriate — NOT during combat rewards)
- Escape key = close/back

### Step 2: Card Reward Screen

**File:** `src/ui/components/CardRewardScreen.svelte`

Landscape:
- Centered modal, ~65% viewport width
- 3 cards displayed horizontally with more detail:
  - Chain type badge visible
  - Mechanic description visible (not just name)
  - Fact preview (first few words of question)
  - FSRS tier indicator
- Keyboard: 1/2/3 to select, Escape to skip (if allowed)
- Cards larger than portrait (more space)

### Step 3: Shop Screen

**File:** `src/ui/components/ShopRoomOverlay.svelte`

Landscape:
- Centered panel, ~70% viewport width
- Cards and relics in a horizontal row (not stacked)
- Card removal section below main inventory
- Chain composition summary visible at top
- Haggle button prominent
- Prices clearly visible

### Step 4: Rest Site

**File:** `src/ui/components/RestRoomOverlay.svelte`

Landscape:
- Centered modal with options listed
- Heal / Upgrade / Study options in a horizontal row with icons
- Study card selection: grid view if multiple eligible cards

### Step 5: Retreat or Delve

**File:** `src/ui/components/RetreatOrDelve.svelte`

Landscape:
- Centered modal, two large buttons side-by-side
- Floor preview on delve side (what's ahead)
- Rewards summary on retreat side (what you keep)

### Step 6: Relic Reward / Pickup

**Files:** `src/ui/components/RelicRewardScreen.svelte`, `RelicPickupOverlay.svelte`

Landscape:
- Centered modal showing relic(s) with full descriptions
- Side-by-side comparison if multiple options

### Step 7: All Other Modals

Apply the modal base pattern to all remaining overlays. Each gets:
- Centered panel (not full-screen) in landscape
- Backdrop click to dismiss (where safe)
- Escape to close
- Portrait mode: unchanged

### Step 8: Verification

- [ ] All portrait modals: pixel-identical
- [ ] Card reward: centered, keyboard selectable, chain badges visible
- [ ] Shop: horizontal layout, all items visible
- [ ] Rest: horizontal options
- [ ] Retreat/Delve: side-by-side buttons
- [ ] Click-outside dismisses modals (where appropriate)
- [ ] Escape closes all modals
- [ ] No modal clips or overflows at 1920×1080

## Files Affected

| File | Action |
|------|--------|
| `src/ui/components/CardRewardScreen.svelte` | MODIFY |
| `src/ui/components/ShopRoomOverlay.svelte` | MODIFY |
| `src/ui/components/RestRoomOverlay.svelte` | MODIFY |
| `src/ui/components/RetreatOrDelve.svelte` | MODIFY |
| `src/ui/components/RelicRewardScreen.svelte` | MODIFY |
| `src/ui/components/RelicPickupOverlay.svelte` | MODIFY |
| Various other modal components | MODIFY |

## GDD Updates

None — layout-only changes.
