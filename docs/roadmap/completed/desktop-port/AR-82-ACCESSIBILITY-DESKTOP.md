# AR-82: Accessibility & Colorblind Support (Desktop)

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §18
> **Priority:** CORE EXPERIENCE
> **Complexity:** Small-Medium
> **Dependencies:** AR-71 (Layout System)

## Context

Chain types use color-only differentiation (6 colors). Colorblind players cannot distinguish chains. Add icons alongside colors. Also add UI Scale slider for desktop (different default than mobile).

## Directive

### Step 1: Chain Type Icons (SVG)

**File:** NEW `src/assets/chain-icons/` (6 SVG files)

| Chain Type | Icon Shape | File |
|------------|-----------|------|
| Obsidian (0) | Diamond | `obsidian.svg` |
| Crimson (1) | Flame | `crimson.svg` |
| Azure (2) | Droplet | `azure.svg` |
| Amber (3) | Star | `amber.svg` |
| Violet (4) | Crescent | `violet.svg` |
| Jade (5) | Leaf | `jade.svg` |

Each icon: 24×24 viewbox, simple monochrome path, filled with chain color at render time.

### Step 2: Integrate Icons into UI

Icons appear in:
- **Card left-edge glow area:** Small (~12px) icon alongside color tint
- **Chain counter display:** Icon + chain name
- **Card reward screen badges:** Icon + color + chain type name
- **Shop card display:** Icon + color

**Files to modify:**
- `src/ui/components/CardHand.svelte` — add icon to chain glow
- `src/ui/components/ComboCounter.svelte` — add icon
- `src/ui/components/CardRewardScreen.svelte` — add icon to badge
- `src/ui/components/ShopRoomOverlay.svelte` — add icon

### Step 3: UI Scale Slider (Desktop)

**File:** `src/ui/components/SettingsPanel.svelte`

Add "UI Scale" slider in landscape mode:
- Range: 80% to 150%
- Default: 100% on desktop
- Modifies `--layout-scale` CSS variable
- Persisted to localStorage
- Live preview as slider moves

### Step 4: Text Size Enhancement

Existing text size setting (Small/Medium/Large) works the same but verify it doesn't break landscape layouts at each size.

### Step 5: Colorblind Testing

Verify chain colors are distinguishable under:
- Protanopia (red-blind)
- Deuteranopia (green-blind)
- Tritanopia (blue-blind)

The 6 chain colors (Obsidian=#546E7A, Crimson=#C62828, Azure=#1565C0, Amber=#FF8F00, Violet=#6A1B9A, Jade=#2E7D32) should test well because they span the hue spectrum, but verify. Icons provide the redundant channel regardless.

### Step 6: Verification

- [ ] All 6 chain type icons render correctly
- [ ] Icons visible at small sizes (12px)
- [ ] UI Scale slider works (80-150%)
- [ ] Text size options don't break landscape layouts
- [ ] Chain types distinguishable in colorblind simulation

## Files Affected

| File | Action |
|------|--------|
| `src/assets/chain-icons/*.svg` | NEW (6 files) |
| `src/ui/components/CardHand.svelte` | MODIFY |
| `src/ui/components/ComboCounter.svelte` | MODIFY |
| `src/ui/components/CardRewardScreen.svelte` | MODIFY |
| `src/ui/components/ShopRoomOverlay.svelte` | MODIFY |
| `src/ui/components/SettingsPanel.svelte` | MODIFY |

## GDD Updates

Update `docs/GAME_DESIGN.md` §20 (Accessibility) with chain type icons, UI Scale slider, and colorblind support notes.
