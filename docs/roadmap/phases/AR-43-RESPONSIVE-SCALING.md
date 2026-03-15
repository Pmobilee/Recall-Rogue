# AR-43 — Responsive Layout Scaling (Full Game)

## Overview
**Goal:** Replace ALL hardcoded pixel positions across the entire game with a unified CSS scaling system (`--layout-scale`) so every screen renders correctly on phones (320px–430px), large phones (430px–500px), and vertical tablets (500px–768px).

**Current state:** The game is tuned for 390×844. Phaser uses `Scale.FIT` with fixed 390×844 canvas. ~80+ hardcoded px values across 15+ Svelte components and the Phaser combat scene.

**Dependencies:** None — foundational work.
**Estimated complexity:** High (15+ files, but changes are mechanical once the scale variable exists).

## Architecture

### The Scale Variable
One CSS custom property drives everything:
```css
:root {
  --layout-scale: 1; /* JS-computed: containerWidth / 390 */
}
```
- JS updates it on mount + resize (CSS `calc()` can't divide viewport units by px)
- Value is 1.0 at 390px, ~1.1 at 430px, ~1.28 at 500px
- All hardcoded px become `calc(Npx * var(--layout-scale))`

### What gets scaled
- **Positioning**: `top`, `bottom`, `left`, `right` offsets
- **Sizing**: `width`, `height`, `min-height`, `max-width`, `gap`, `padding`, `margin`
- **Typography**: `font-size` values
- **Phaser objects**: All position constants, sprite sizes, HP bar dimensions, font sizes

### What does NOT get scaled
- `border-width`, `border-radius` (fine at fixed sizes)
- `box-shadow` (cosmetic)
- `opacity`, `z-index`, `transition` durations
- Touch target minimums (keep 44px+ for accessibility)
- `min-height: 44px` / `min-height: 48px` on buttons (accessibility floor)

---

## Sub-steps

### Wave 1: Foundation + Combat

#### 1.1 Create layout constants file
Create `src/data/layout.ts`:
```typescript
export const BASE_WIDTH = 390
export const GAME_ASPECT_RATIO = 9 / 16
```

**Files:** `src/data/layout.ts` (new)
**Acceptance:** Constants importable from both Svelte and Phaser code.

#### 1.2 Define --layout-scale via JS
In `src/CardApp.svelte`:
- On mount + window resize, compute `containerWidth / 390` and set `--layout-scale` on `:root`
- Replace hardcoded `571/1024` aspect ratio with import from `layout.ts`
- Scale the following hardcoded values in CardApp:
  - `.pause-btn`: top 8px, right 8px, width 36px, height 36px, font-size 14px
  - `.pause-icon`: gap 3px, width 3px, height 14px
  - `.active-run-banner`: gap 10px, padding 10px 16px
  - `.abandon-modal-card`: padding 24px, max-width 320px, font sizes
  - `.fact-gained-toast`: bottom 100px, padding 14px 16px, width 340px

**Files:** `src/CardApp.svelte`
**Acceptance:** `--layout-scale` updates on resize. All CardApp UI elements scale proportionally.

#### 1.3 Expose scale factor to Phaser
In `CombatScene.ts`:
- Compute `scaleFactor = this.scale.width / 390` in `create()`
- Convert all hardcoded constants to use `scaleFactor`:
  - FLOOR_COUNTER_Y (16), INTENT_ICON_OFFSET_Y (-40)
  - ENEMY_HP_BAR_W (160), ENEMY_HP_BAR_H (12)
  - PLAYER_HP_BAR_WIDTH (16), PLAYER_HP_BAR_X_OFFSET (24)
  - ENEMY_SIZE_COMMON/ELITE/BOSS (300/340/400)
  - All font size strings ('13px', '14px', '16px')
  - Enemy name offset (12px below sprite)

**Files:** `src/game/scenes/CombatScene.ts`
**Acceptance:** Combat scene scales correctly at different canvas sizes.

#### 1.4 Scale EnemySpriteSystem offsets
- Shadow offsets (4, 5), outline offsets (2) → multiply by `displaySize / 300`

**Files:** `src/game/systems/EnemySpriteSystem.ts`
**Acceptance:** Enemy sprite shadows/outlines proportional to sprite size.

#### 1.5 Scale CardCombatOverlay
Convert all hardcoded px to `calc(Npx * var(--layout-scale))`:
- AP orb: left 28px, bottom calc components
- Deck pile strip: left 8px, bottom 68px
- Enemy intent bubble: top 12px, left 8px, width 72px, expanded width 200px
- Enemy name header: top 4vh
- Damage number positions: bottom 178/320/360/180px
- WOW factor: top 60px, left 16px
- Combo counter: bottom 68px, right 12px
- End turn confirmation: top 6px, right 6px
- End turn button and other buttons: padding, sizing

**Files:** `src/ui/components/CardCombatOverlay.svelte`
**Acceptance:** All combat overlay elements scale proportionally.

#### 1.6 Scale CardHand
- Replace `height: 280px` with scaled value
- Replace `571/1024` with import from layout.ts
- Scale card width calculation (30% of viewport → stays percentage-based, OK)

**Files:** `src/ui/components/CardHand.svelte`
**Acceptance:** Card hand height scales. No card overflow.

#### 1.7 Scale CardExpanded (quiz modal)
- `width: 320px` → scaled
- Font sizes, padding, answer button heights
- Timer bar, hint menu, speed bonus badge positions

**Files:** `src/ui/components/CardExpanded.svelte`
**Acceptance:** Quiz modal scales up on larger phones.

---

### Wave 2: Hub, Map, Domain Picker

#### 2.1 Scale HubScreen
- `.study-mode-container` banner offset (64px)
- Sparkle particle sizes (5px, 30px distances)

**Files:** `src/ui/components/HubScreen.svelte`
**Acceptance:** Hub scales correctly.

#### 2.2 Scale DungeonMap
This is critical — the map uses absolute JS constants:
- `TOTAL_MAP_HEIGHT = 1350` → scale with viewport
- `H_PADDING = 28`, `V_PADDING = 44` → scale
- `MAX_WIDTH = 500` → scale or keep as cap
- HUD elements: font sizes, HP bar height (14px), padding
- MapNode.svelte: node size (44px width/height) → scale

**Files:** `src/ui/components/DungeonMap.svelte`, `src/ui/components/MapNode.svelte`
**Acceptance:** Map renders correctly on all screen sizes. Nodes don't clip or overlap.

#### 2.3 Scale DomainSelection
- Back button: top 16px, left 16px
- Title: font-size 20px
- Ascension controls: 40px buttons
- Domain grid: gap 12px, card min-height 88px
- Domain icons: 30px wrap, 24px icons
- Start button: width 220px, height 56px, font-size 18px
- Filter modal: padding, font sizes

**Files:** `src/ui/components/DomainSelection.svelte`
**Acceptance:** Domain picker scales. Start button doesn't overflow on small screens.

---

### Wave 3: Room Screens

#### 3.1 Scale ShopRoomOverlay
- Container padding, heading sizes (24px, 18px)
- Card items: padding 10px 12px
- Buy/sell buttons, done button
- Section headers

**Files:** `src/ui/components/ShopRoomOverlay.svelte`
**Acceptance:** Shop scales correctly.

#### 3.2 Scale RestRoomOverlay
- Rest card: padding 24px, max-width 340px → scaled
- Option cards: padding, icon size (28px), gap
- HP info, labels

**Files:** `src/ui/components/RestRoomOverlay.svelte`
**Acceptance:** Rest site scales correctly.

#### 3.3 Scale MysteryEventOverlay
- Mystery card: padding 24px, max-width 340px
- Effect icon: 48px
- Card reveal: 180x260px
- Choice/continue buttons

**Files:** `src/ui/components/MysteryEventOverlay.svelte`
**Acceptance:** Mystery events scale. Card reveal fits on all screens.

#### 3.4 Scale CardRewardScreen
This is the most complex — 50+ hardcoded values:
- Step icons: 86px, 92px image, 164x164 action container
- Step title/value/bonus font sizes (22px, 36px, 21px)
- Altar layout: 920px max, option min-height 146px
- Inspect panel, actions
- Remove or adjust the 700px breakpoint to work with the scale variable instead

**Files:** `src/ui/components/CardRewardScreen.svelte`
**Acceptance:** Reward screen scales. Icons don't overflow on small screens.

---

### Wave 4: Settings, Profile, Support Screens

#### 4.1 Scale SettingsPanel
- Settings card: padding 16px, gap 14px
- Chips: padding 10px 12px, min-height 48px
- Toggle/slider rows: gap, font sizes
- Slider grid columns (130px)

**Files:** `src/ui/components/SettingsPanel.svelte`
**Acceptance:** Settings panel scales.

#### 4.2 Scale RunEndScreen
- Header: font-size 24px, margin 32px
- Stats list: max-width 300px, gap 12px
- Buttons: min-width 120px, height 48px
- Bounty list: padding, font sizes

**Files:** `src/ui/components/RunEndScreen.svelte`
**Acceptance:** Victory/defeat screen scales.

#### 4.3 Scale KnowledgeLibrary
- All padding, font sizes, card layouts

**Files:** `src/ui/components/KnowledgeLibrary.svelte`
**Acceptance:** Library screen scales.

#### 4.4 Scale ProfileScreen and LeaderboardsScreen
- Padding, font sizes, row layouts

**Files:** `src/ui/components/ProfileScreen.svelte`, `src/ui/components/LeaderboardsScreen.svelte`
**Acceptance:** Profile and leaderboards scale.

#### 4.5 Scale QuizOverlay (non-combat quiz)
- Quiz card: width, padding, gap
- Choice buttons: min-height, padding
- GAIA reaction, memory tip, consistency warning

**Files:** `src/ui/components/QuizOverlay.svelte`
**Acceptance:** Non-combat quiz popups scale.

---

## Files Affected (Complete List)
| File | Wave | Changes |
|------|------|---------|
| `src/data/layout.ts` (NEW) | 1 | BASE_WIDTH, GAME_ASPECT_RATIO constants |
| `src/CardApp.svelte` | 1 | --layout-scale setup, container scaling |
| `src/game/scenes/CombatScene.ts` | 1 | scaleFactor for all position constants |
| `src/game/systems/EnemySpriteSystem.ts` | 1 | Shadow/outline offset scaling |
| `src/ui/components/CardCombatOverlay.svelte` | 1 | All overlay positions |
| `src/ui/components/CardHand.svelte` | 1 | Hand height, aspect ratio import |
| `src/ui/components/CardExpanded.svelte` | 1 | Modal width, font sizes |
| `src/ui/components/HubScreen.svelte` | 2 | Banner offset, sparkle sizes |
| `src/ui/components/DungeonMap.svelte` | 2 | Map height/padding constants |
| `src/ui/components/MapNode.svelte` | 2 | Node size (44px) |
| `src/ui/components/DomainSelection.svelte` | 2 | All positions and sizes |
| `src/ui/components/ShopRoomOverlay.svelte` | 3 | Padding, font sizes, buttons |
| `src/ui/components/RestRoomOverlay.svelte` | 3 | Card padding, icon sizes |
| `src/ui/components/MysteryEventOverlay.svelte` | 3 | Card dimensions, icon sizes |
| `src/ui/components/CardRewardScreen.svelte` | 3 | Icon sizes, altar layout, breakpoints |
| `src/ui/components/SettingsPanel.svelte` | 4 | Chip/toggle sizing |
| `src/ui/components/RunEndScreen.svelte` | 4 | Stats/button sizing |
| `src/ui/components/KnowledgeLibrary.svelte` | 4 | Card layouts |
| `src/ui/components/ProfileScreen.svelte` | 4 | Padding, font sizes |
| `src/ui/components/LeaderboardsScreen.svelte` | 4 | Row layouts |
| `src/ui/components/QuizOverlay.svelte` | 4 | Quiz card sizing |

## Verification Gate
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run build` — succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Visual test 360px width (small Android) — no overflow/clipping on any screen
- [ ] Visual test 390px width (iPhone 14) — looks identical to current
- [ ] Visual test 430px width (iPhone 14 Pro Max) — proportionally scaled
- [ ] Visual test 500px width (max container) — clean, no gaps
- [ ] Visual test 768px width (iPad portrait) — game centered, black bars, no floating elements
- [ ] Full run playthrough at 390px — combat, map, shop, rest, mystery, rewards all work
- [ ] Full run playthrough at 430px — same verification
- [ ] Card hand, AP orb, intent bubble, enemy sprite scale proportionally
- [ ] Map nodes don't clip or overlap on any width
- [ ] Reward ceremony icons don't overflow
- [ ] All touch targets remain ≥44px
