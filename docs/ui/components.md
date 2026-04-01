# UI Component Catalog

> **Purpose:** Gameplay-critical Svelte components: Combat UI, Quiz & Study, Hub & Navigation, Dungeon & Map, Card Management, Rooms & Events, Rewards & Progression, Relics.
> **Last verified:** 2026-04-01
> **Source files:** `src/ui/components/**/*.svelte` (186 files), `src/CardApp.svelte`, `src/ui/effects/hubLightingState.ts`, `src/ui/effects/HubGlowEffect.ts`, `src/ui/effects/CampfireEffect.ts`

> **See also:** [`components-social.md`](components-social.md) — Social & Multiplayer, Profile & Account, Auth & Legal, Monetization & Seasons, Onboarding & Cutscenes, Utility & Effects.

---

## Combat UI

| Component | Purpose |
|-----------|---------|
| `CardHand.svelte` | Renders the player's hand with V2 card frames, art, mastery glow, chain color groups, and damage-modifier coloring (green=buffed, red=nerfed via `damagePreviews` prop) |
| `CardCombatOverlay.svelte` | Root combat screen: wraps CardHand + QuizOverlay, handles surge/boss phases, landscape/portrait. Computes `damagePreviews` via `damagePreviewService` and passes to CardHand |
| `CombatHUD.svelte` | Legacy HP bars + combat log; largely superseded by InRunTopBar |
| `InRunTopBar.svelte` | Landscape/Portrait HUD: HP bar, shield badge, gold, floor/segment, relic tray, fog level, pause. Inline player status effect icons (poison, burn, etc.) to the right of the HP bar — hover to show per-icon popup. `.hp-group` uses `flex: 1 0 auto` (never shrinks when icons are added). Icon size matches HP bar height (`var(--topbar-height) * 0.58`). Status popup is per-wrapper positioned below each icon on hover; backdrop click pattern removed. `.section-left` uses `max-width: 35%`. Accepts optional `statusEffects` prop (from `topBarPlayerEffects` derived in CardApp.svelte). |
| `MusicWidget.svelte` | Ultra-sleek Spotify-style BGM player widget. `position: fixed` pill (top-right, below InRunTopBar, z-index 201). Collapsed: ~56×36px pill with 6-bar spectrogram canvas (48×32). Expanded: 240px glass panel with wide spectrogram, track title + marquee overflow, category toggle (EPIC/QUIET), prev/play-pause/next controls, volume slider with mute toggle. All state synced from `musicService` via `subscribe()`. rAF animation loop driven by `musicService.getFrequencyData()` — idle sine wave when not playing. Expand/collapse via CSS `max-height` + `opacity` transition. Closes on outside click. Shown alongside `InRunTopBar` whenever `showTopBar` is true (landscape in-run screens). `musicService.startIfNotPlaying()` auto-fires on entering any `IN_RUN_SCREENS`. |
| `ChainCounter.svelte` | Animated chain streak badge showing length, type color, and damage multiplier |
| `ChainIcon.svelte` | Single chain-type icon pip used in ChainCounter and card frames |
| `DamageNumber.svelte` | Floating combat numbers (damage, block, heal, poison, burn, bleed, gold, crit) |
| `StatusEffectBar.svelte` | Row of active status effect icons + counts during combat. Enemy bar positioned at `14vh` (portrait) / `18vh` (landscape override via ). Player StatusEffectBar removed — player effects now inline in InRunTopBar |
| `PassiveEffectBar.svelte` | Persistent passive effects active on player or enemy |
| `EnemyPowerBadges.svelte` | Badges showing elite/boss modifier tags on an enemy |
| `BossIntroOverlay.svelte` | Full-screen dramatic boss introduction cinematic |
| `SurgeBorderOverlay.svelte` | Pulsing colored border overlay during surge turns |
| `ComebackBonus.svelte` | Toast/banner when the low-HP comeback bonus activates |
| `ExhaustPileViewer.svelte` | Drawer showing exhausted cards for the current turn |
| `SpeedRoundTimer.svelte` | Countdown timer for speed-round challenge phases |
| `NearMissBanner.svelte` | Feedback banner when a wrong answer was very close |
| `TimeUpOverlay.svelte` | Full-screen overlay when the floor timer expires |
| `KidWowStars.svelte` | Star-burst animation for kids-mode correct answers |
| `MentorHintDisplay.svelte` | Displays the hint purchased via the hint action |
| `StreakFeedback.svelte` | Animated feedback for correct-answer streaks |

### CardHand damagePreviews prop

`CardHand` accepts an optional `damagePreviews?: Record<string, DamagePreview>` prop (from `damagePreviewService`). When present:
- Each card's displayed damage/block number uses the relic/buff/enemy-adjusted effective value instead of the raw base value
- `.desc-number.damage-buffed` (green glow) — effective > base
- `.desc-number.damage-nerfed` (red glow) — effective < base
- Both landscape and portrait rendering paths apply modifier coloring
- `modState` is computed per-card from `preview.qpModified` / `preview.ccModified` depending on charge preview state

`CardCombatOverlay` builds the full `DamagePreviewContext` from `turnState` and calls `computeDamagePreview` for every card in hand, passing the result as `{damagePreviews}` to CardHand.

### CardHand tier classes

Cards have `class:tier-2a`, `class:tier-2b`, and `class:tier-3` bindings in the template (both landscape and portrait paths). The corresponding CSS rules carry no visual effects — tier drop-shadow glow styles (silver for 2a/2b, gold for tier-3) were removed 2026-03-31. The class bindings remain in the template for potential future use.

### CardHand card-play animation phases

Cards animate in place (no centering/floating to screen center). All three phases use `z-index: 60` instead of `z-index: 100`.

| CSS class | Phase | Animation |
|---|---|---|
| `.card-reveal` | Reveal | `cardRevealPulse` — 200ms brightness flash + scale(1.05) in place |
| `.card-swoosh` | Swoosh | `cardSwooshFade` — 200ms scale 1→0.9 + opacity fade; type-specific `::after` pseudo-elements still apply |
| `.card-impact` | Impact | `cardImpactFade` — 200ms scale 0.9→0.7 + opacity 0.3→0 |
| `.card-discard` | Discard | `discardShrink` — 200ms scale 0.7→0.3 + opacity fade |

The six `.card-impact-attack/shield/buff/debuff/wild` sub-classes and their `@keyframes` were removed 2026-03-31 — the base `.card-impact` handles all variants. Reduced-motion disables all four animations via `animation: none !important`.

---

## Quiz & Study

| Component | Purpose |
|-----------|---------|
| `QuizOverlay.svelte` | Multiple-choice quiz modal for card activation; Gaia avatar, 3 distractors, timer |
| `ChallengeQuizOverlay.svelte` | Challenge-mode quiz (speed round, mastery) with configurable ChallengeMode |
| `StudyQuizOverlay.svelte` | Rest-room study quiz: boss-quiz–style questions to upgrade card charges |
| `MasteryChallengeOverlay.svelte` | Mastery challenge room: timed quiz sequence for card mastery rewards |
| `ScholarQuizPanel.svelte` | Scholar-challenge run quiz panel with extended question formats |
| `EventQuiz.svelte` | Quiz embedded inside mystery/special events for branching outcomes |
| `GrammarTypingInput.svelte` | Free-text typing input for grammar deck tilde-fragment answers |
| `WordHover.svelte` | Hoverable word revealing dictionary definition on hover/tap |
| `StudySession.svelte` | Standalone study session for the Study Temple screen |
| `StudyStation.svelte` | Quick-review widget inside the Hub |
| `StudyModeSelector.svelte` | Toggle between multiple-choice / typing / flashcard modes |
| `FactReveal.svelte` | Animates the reveal of a new fact after answering correctly |
| `FactArtwork.svelte` | Displays the artwork image associated with a knowledge fact card |

---

## Hub & Navigation

| Component | Purpose |
|-----------|---------|
| `HubScreen.svelte` | Main hub: campfire, NPC sprites, run summary, navigation entry points. Integrates hub lighting engine, glow canvas, fireflies, moths, custom cursor light, per-sprite brightness with mouse proximity bonus, and background warmth filter. Tracks mouse via `onpointermove`/`onpointerleave`; hides system cursor with `style:cursor="none"` when effects are enabled. Child interactive elements use `cursor: inherit` (not `cursor: pointer`) so the hub cursor:none propagates correctly. **Z-index layering (landscape)**: `.camp-bg-wide` z-0, HubGlowCanvas glow-canvas z-1 / vignette z-2, `.hub-center` z-3 (raised from z-1 on 2026-04-01 so all sprites and HUD inside hub-center paint above the vignette overlay; background image at z-0 still gets darkened by vignette). |
| `HubNavBar.svelte` | Bottom navigation bar (Library, Profile, Social, Leaderboards) |
| `HubVisitorView.svelte` | Visitor profile view when browsing another player's hub |
| `CampHudOverlay.svelte` | HUD overlay on the hub: streak, gold, XP progress bar |
| `CampSpriteButton.svelte` | Clickable NPC sprite button in the hub scene. Props: `spriteOffsetX`/`spriteOffsetY` for CSS translate repositioning; `brightness` (default 1.0) for campfire lighting via `--sprite-brightness` CSS custom property. `fireShadow` prop removed 2026-04-01 (full-frame sprites caused alpha-channel blob halos). `.sprite-hitbox` uses `cursor: inherit` (updated 2026-04-01, was `cursor: pointer`) so the hub `cursor: none` is not overridden by child buttons — the custom glow cursor IS the hover feedback when effects are active. See "Hub Lighting" section below. |
| `CampSpeechBubble.svelte` | Speech bubble overlay for hub NPC characters |
| `CampfireCanvas.svelte` | Canvas-based animated campfire flicker effect. CSS size is `calc(200px * var(--layout-scale, 1))` × `calc(250px * var(--layout-scale, 1))`. **z-index: 26** — above campfire sprite (z-25) so ember particles render on top of the fire art. On mount, canvas pixel dimensions are set from `clientWidth`/`clientHeight`; a `ResizeObserver` keeps them in sync. Scale factor (`clientWidth / 200`) is passed to `CampfireEffect` constructor and updated via `setScale()`. |
| `HubGlowCanvas.svelte` | Two-layer hub glow system: (1) `position: fixed` canvas with `mix-blend-mode: screen` for additive warm orange radial glow; (2) sibling `<div class="hub-vignette">` with normal blend mode and reactive CSS `radial-gradient` that pulses with fire intensity — bright fire expands the lit area, dim fire tightens darkness. Props: `campfireCenterFn: () => {x, y}` (absolute viewport pixels), `zIndex?: number` (default 1; vignette div gets `zIndex + 1`), `mouseX?: number` / `mouseY?: number` — forwarded to `HubGlowEffect.setMousePosition()` for a secondary warm light at the cursor. Imports `getHubLightingStore()` and uses `$derived` to recompute gradient stops from `$hubLighting.intensity` at ~30fps. |
| `HubFireflies.svelte` | Ambient firefly particles driven by **RAF sine-wave motion** (rewritten 2026-04-01 to match RewardRoomScene.ts Phaser firefly system). Spawns 8 fireflies on mount; keeps count stable by respawning dead ones immediately. **Motion:** each firefly has per-fly `phase`, `ampX`/`ampY` (2–5% / 1.5–4% container), `freqX`/`freqY` (0.0004–0.001), `depthLayer` (0.5–1.0). Position updated each RAF tick: `x = baseX + sin(now * freqX * depth + phase) * ampX`, `y = baseY + cos(now * freqY * depth + phase) * ampY`. Slow horizontal drift on `baseX` (±0.02%/frame, clamped 2–98%). **Lifecycle:** fadingIn 600ms → alive 4–8s → fadingOut 800ms → dead → respawn at new random position. **Alpha:** `maxAlpha = 0.4 + depthLayer * 0.4` (0.6–0.8). **No CSS keyframes** — all motion is JS-driven via RAF at 30fps throttle. Single `tick` `` integer triggers Svelte re-renders; firefly array is plain (non-reactive) for performance. **Spawn:** 30% dark-edge bias (4 edges), 70% full-screen excluding campfire zone 40–60%x / 55–75%y. **Size:** `(size * depthLayer)px * var(--layout-scale, 1)`. **Reduce-motion:** static positions, no RAF loop, alpha 0.5. |

| `HubMoths.svelte` | 4 tiny moths orbiting the campfire (added 2026-04-01). Each traces an elliptical CSS path centered near the fire (~50%, 58% of container). Orbit radius 3–8% wide, 1.5–3% tall; duration 4–8s; staggered by ~0.8s each. Scale variation in `@keyframes moth-orbit` (0.8–1.1×) simulates depth as moths pass in front of and behind the fire. Separate `@keyframes moth-flutter` (1.2–2.7s) drives irregular opacity (0.5–0.9) simulating wings catching firelight. Appearance: 3×2px dot, `rgba(180,160,120,0.7)` warm tan, subtle warm glow. z-index 26 (matches CampfireCanvas). Rendered via `{#if !disableEffects}<HubMoths />{/if}` in both landscape and portrait hub layouts. |
| `HubCursorLight.svelte` | Mouse-interactive custom cursor + firefly trail for the hub scene. Props: `x: number` (viewport clientX), `y: number` (viewport clientY), `visible: boolean`. Renders a warm orange radial-gradient glowing dot (`position: fixed; z-index: 100; pointer-events: none`) that replaces the system cursor. **Trail (updated 2026-04-01):** warm golden yellow particles `rgba(255, 240, 120, 0.8)` (was green). Max 6 particles (was 10), spawn interval 120ms (was 80ms). **Movement threshold:** only spawns when cursor moves ≥3px — suppresses micro-movement spawning. **Distance pruning:** particles >10% viewport width from current cursor are removed immediately (prevents orphaned spheres when cursor jumps). **Stop cleanup:** all trail particles cleared 500ms after cursor stops moving (via `setTimeout` reset on each move event). Particles drift 10–25px, lifetime 400–800ms. Respects `prefers-reduced-motion` (hides trail, keeps static cursor). |
| `CampfirePause.svelte` | In-run pause menu: resume / return to hub, run stats |
| `CampUpgradeModal.svelte` | Modal for purchasing permanent camp upgrades |
| `FireflyBackground.svelte` | Ambient animated firefly particles on the global background |
| `DomeCanvas.svelte` | Starfield dome canvas rendered behind the hub |
| `LoginCalendar.svelte` | Daily login streak calendar widget |
| `AnnouncementBanner.svelte` | Scrolling banner for server announcements / seasonal events |
| `WelcomeBackOverlay.svelte` | Overlay shown after a multi-day absence |

### Hub Lighting System

`src/ui/effects/hubLightingState.ts` — central flicker engine driving glow, sprite dimming, and background warmth in sync.

**Architecture:**
- Single RAF loop at ~30fps, shared cadence with `CampfireEffect`
- **Responsive flicker** (updated 2026-04-01): easing factor 0.15/frame — visible changes within ~5 frames (~170ms). New target picked every 150–600ms (was 300–1200ms). Dim dip floor lowered to 0.15 (was 0.25), bright flare ceiling raised to 0.95 (was 0.90). Per-frame micro-jitter of ±0.02 for alive feel. Slow breathing sine (amplitude 0.08, freq 0.0015) for macro rhythm.
- **Brighter peaks** (updated 2026-04-01): 3% super flare → instantly targets 1.0 (quick 100–200ms burst); 10% bright flare → 0.90–1.0+ (was 0.80–0.95); 77% normal range → 0.45–0.75 (was 0.45–0.70, widened for livelier baseline). Super flare checked before dim dip and bright flare.
- Streak multiplier scales flicker amplitude (streak 0 → ×1.0, streak 7+ → ×1.6 capped at ×1.8)
- Reactive store updated every frame at ~30fps (was every other frame at ~15fps) — drives responsive vignette pulsing
- Respects `localStorage 'card:reduceMotionMode'` — returns static middle values when true

**Exports:**

| Export | Type | Description |
|--------|------|-------------|
| `HubLightingSnapshot` | interface | `{ intensity, warmth, sparkChance }` all 0–1 |
| `HubLightingReactive` | interface | `{ spriteBrightness, warmth, intensity }` for CSS consumers |
| `CAMPFIRE_CENTER_PCT` | const | `{ x: 50, y: 64 }` — campfire center as % of hub container |
| `getSnapshot()` | function | Allocation-free synchronous read; returns mutated shared object |
| `getHubLightingStore()` | function | Returns Svelte writable store updated at ~30fps (every frame) for CSS consumers. Used by HubScreen for per-sprite brightness and HubGlowCanvas for reactive vignette gradient. |
| `start(streak)` | function | Start RAF loop; safe to call multiple times |
| `stop()` | function | Stop loop, reset to static values |
| `updateStreak(streak)` | function | Update amplitude multiplier without restarting |
| `getSpriteBrightness(hitTop, hitLeft, hitWidth, hitHeight, intensity)` | function | Per-sprite brightness: distance falloff from campfire + ±8% flicker; clamped 0.35–1.0 |

**`CampSpriteButton` props:**
- `brightness?: number` (default 1.0) — set as `--sprite-brightness` CSS custom property inline
- `fireShadow` prop REMOVED 2026-04-01: full-frame sprites (`inset: 0; width/height: 100%`) mean `drop-shadow` follows the entire image alpha channel, creating visible dark blob halos rather than subtle directional shadows. Incompatible with this sprite architecture.
- `.sprite-img` base rule: `filter: brightness(var(--sprite-brightness, 1))`
- `.sprite-img.rpg-outline`: brightness then outline drop-shadows (no fire shadow)
- `:has(.sprite-hitbox:active)` press flash: hardcoded `brightness(1.4)` with warm glow drop-shadow

### HubScreen Integration (Batch 3)

`HubScreen.svelte` now wires together all three hub atmosphere systems:

**Lighting engine lifecycle:**
- `onMount`: calls `start(streak)` when `disableEffects` is false
- `onDestroy`: calls `stop()` always
- `$effect`: calls `updateStreak(streak)` reactively when streak prop changes

**Mouse tracking (added 2026-04-01):**
- `mouseX` / `mouseY` (`$state<number | undefined>`) and `mouseInHub` (`$state<boolean>`) track cursor within the hub container
- Both `.hub-landscape` and `.camp-hub` receive `onpointermove={handleHubPointerMove}` and `onpointerleave={handleHubPointerLeave}`
- System cursor hidden with `style:cursor={disableEffects ? undefined : 'none'}` on the hub root elements
- Mouse coords forwarded to `HubGlowCanvas` as `mouseX`/`mouseY` props for the secondary canvas light pass
- `HubCursorLight` rendered inside the hub root (after all other content) when `!disableEffects && mouseInHub`

**Per-sprite brightness (`$derived`):**
- Each `CampSpriteButton` receives a `brightness` prop derived from `getSpriteBrightness(...) + getMouseProximityBonus(...)`, clamped to 1.0
- `getMouseProximityBonus(hitTop, hitLeft, hitWidth, hitHeight, mx, my, containerEl)`: converts mouse viewport coords to container-percentage space, computes distance to sprite center, returns 0–0.15 bonus fading linearly from dist=0 to dist=25 percentage units
- Portrait-specific proximity uses `campHubEl` as the container; landscape uses `hubCenterEl`
- Portrait-specific deriveds for shop (`87%, 52%`) and tent (`44%, 66%`) since they differ from landscape positions (`52%, 2%` and `40%, 90%`)
- **Landscape shop hitbox** (2026-04-01): `hitTop="52%" hitLeft="2%" hitWidth="16%" hitHeight="13%"` — adjusted from previous 60%/1%/19%/11% to match chest visual position after `spriteOffsetX="-73%" spriteOffsetY="-27%"` transform
- **Landscape tent hitbox** (2026-04-01): `hitTop="40%" hitLeft="90%" hitWidth="30%" hitHeight="20%"` — adjusted from previous 42%/84%/36%/22% to match tent visual position after `spriteOffsetX="30%" spriteOffsetY="-2%"` transform
- All brightness deriveds return `1.0` when `disableEffects` is true

**Fire shadow helper `getFireShadow()` REMOVED 2026-04-01:**
- Full-frame sprite images cause `drop-shadow` to create alpha-channel blob halos around entire objects. Feature was fundamentally incompatible with this rendering approach.
- All `fireShadow={...}` props removed from every `CampSpriteButton` in both landscape and portrait templates.

**Background warmth:**
- `bgWarmthFilter` derived: `sepia(0.03 + warmth*0.05) saturate(1.0 + warmth*0.1)` applied via `style:filter` to both `.camp-bg-wide` (landscape) and `.camp-bg` (portrait) images
- Returns `''` (no filter) when `disableEffects` is true

**Campfire center function:**
- `getCampfireViewportCenter()` reads `hubCenterEl` (landscape) or `campHubEl` (portrait) bounding rect
- Returns `{ x: rect.left + rect.width * 0.50, y: rect.top + rect.height * 0.64 }`
- Falls back to `window.innerWidth/2, window.innerHeight * 0.64` before mount

**Z-index stack (campfire area):**
- Campfire sprite: z-index 25
- `CampfireCanvas` (ember particles): **z-index 26** (was 16) — above campfire so embers appear to rise from fire
- `.campfire-sparkle-burst`: **z-index 27** (was 17) — above CampfireCanvas so click sparks render on top
- `HubCursorLight` trail particles (`.trail-firefly`): **z-index 99** — above all hub content
- `HubCursorLight` cursor dot (`.hub-cursor-glow`): **z-index 100** — topmost hub layer

**Removed (Batch 3):**
- `.hub-side-panel`, `.hub-side-left`, `.hub-side-right` CSS classes and their corresponding `<div>` elements — the landscape layout no longer uses flanking side panels; `.hub-center` is centered with `margin: 0 auto`

**`CampfireEffect` (updated Batch 2):**
- Constructor: `new CampfireEffect(canvas, streak, scale = 1)`
- `setScale(scale)`: updates scale factor, clears particles for respawn at correct positions
- Scale affects particle spawn spread, speed, size, and glow radius
- Glow alpha is now driven by `getSnapshot().intensity * 0.24` (shared flicker state, not standalone sine)
- **Dual particle types:**
  - `ember` (80%): orange→yellow drift, size `(6+rnd*6)*scale`, life 1–1.5s, shrinks `life*0.6+0.4`
  - `spark` (20%): white-hot `0xFFFFFF` → blue-white `0xE8E8FF`, size `(2+rnd*3)*scale`, 2-3× upward speed, life 0.4–0.8s; only emitted when `sparkChance > 0.7`
- **Particle counts per streak:** streak 0 → 15, streak 3+ → 30, streak 7+ → 45

**`HubGlowEffect` — `src/ui/effects/HubGlowEffect.ts`:**
- `new HubGlowEffect(canvas, campfireCenterFn)`
- Own 30fps RAF loop reading `getSnapshot()` each frame
- **Pass 1 (warm glow):** radial gradient centered on campfire, `0%: rgba(255,140,40, intensity*0.25)` → `30%: rgba(255,100,20, intensity*0.12)` → `100%: transparent`; radius = `diagonal * (0.55 + intensity * 0.10)`
- **Pass 2 (mouse light):** when `setMousePosition(x, y)` has been called, draws a second radial gradient centered on the cursor. Radius = `diagonal * 0.15` (smaller than campfire). Alphas: `rgba(255,220,160, intensity*0.10)` → `rgba(255,200,140, intensity*0.04)` → transparent. Adds subtle warm illumination near the cursor on the screen-blend canvas.
- **Pass 2 (vignette) REMOVED** (2026-04-01): `mix-blend-mode: screen` makes dark colors transparent — vignette drawn on this canvas did nothing. Vignette moved to a sibling CSS `<div class="hub-vignette">` in `HubGlowCanvas.svelte` using normal blend mode with reactive `$derived` gradient. Stops pulse with `$hubLighting.intensity`: transparent stop moves 10–13.6%, darkness alphas shift 0.20–0.30 / 0.55–0.65 / 0.83–0.88 as fire dims/brightens. Updates at ~30fps via store subscription.
- `mix-blend-mode: screen` on canvas CSS makes glow additive (dark colors transparent — correct for warm glow, wrong for vignette darkening)
- Reduce-motion: draws one static frame at `intensity=0.5`, no RAF loop
- `setMousePosition(x, y)` / `clearMousePosition()` — forwarded from `HubGlowCanvas` via `$effect` when `mouseX`/`mouseY` props change
- `start()` / `stop()` / `destroy()` lifecycle


## Dungeon & Map

| Component | Purpose |
|-----------|---------|
| `DungeonMap.svelte` | Procedurally generated dungeon map with branching node paths |
| `DungeonEntrance.svelte` | Dungeon entry screen with parallax transition and language selection |
| `MapNode.svelte` | Individual room node on the dungeon map (combat, shop, rest, mystery, boss) |
| `MapAmbientParticles.svelte` | Ambient particle layer over the dungeon map |
| `DomainSelection.svelte` | Domain/topic selection for trivia-mode runs |
| `DomainStrip.svelte` | Horizontal strip for a domain category with icon and name |
| `DomainStripCard.svelte` | Individual card within a DomainStrip |
| `TriviaDungeonScreen.svelte` | Entry screen for trivia-dungeon mode with domain selection |
| `RetreatOrDelve.svelte` | Post-boss decision: retreat for safety vs. delve deeper |
| `TheDeepUnlockOverlay.svelte` | Unlock overlay when the player first reaches floor 10+ |

### DungeonMap fog-of-war z-index stack

`DungeonMap.svelte` uses a CSS mask-based fog system. The z-index ordering within `.map-canvas` is:

| Layer | CSS class | z-index | Notes |
|---|---|---|---|
| Floor depth markers | `.row-marker` | 0 | Background labels |
| SVG edges | `.edge-layer` | 1 | Path lines between nodes |
| Nodes | `.node-position` | 2 | Room buttons |
| Fog overlay | `.fog-overlay` | 3 | ABOVE nodes — mask window reveals current/next rows |

The fog overlay sits **above** nodes (z-index 3 > 2) so the CSS `mask-image` gradient actually hides far-away nodes. The transparent window in the mask reveals nodes at the current and next rows. `pointer-events: none` on `.fog-overlay` ensures clicks pass through to available node buttons below. Locked nodes hidden by fog are also `disabled` in markup.

The vignette (`.vignette-overlay`) is `position: fixed` in a separate stacking context at z-index 4 — it does not interfere with the map-canvas stack.

---

## Card Management & Deck Building

| Component | Purpose |
|-----------|---------|
| `DeckSelectionHub.svelte` | Run-start hub: choose trivia mode vs. curated study deck |
| `DeckBuilder.svelte` | Full deck-builder: browse, filter, and manage curated deck cards |
| `CardBrowser.svelte` | Card collection browser with filtering and sorting in the Library |
| `CardExpanded.svelte` | Full-screen expanded card view with all details and fact text |
| `CardPickerOverlay.svelte` | Pick a specific card from the deck (e.g., transmute target) |
| `DeckTileV2.svelte` | Tile component for a curated deck in the selection grid |
| `DeckDetailModal.svelte` | Modal showing deck contents, stats, and subcategory breakdown |
| `DeckFilterChips.svelte` | Filter chips for filtering decks by domain/language/tag |
| `DeckSearchBar.svelte` | Search bar for the deck browser |
| `DeckSortDropdown.svelte` | Sort order dropdown for deck listing views |
| `CategoryLockSelector.svelte` | UI for locking/unlocking fact categories within a deck |
| `CategoryTabs.svelte` | Tab bar for switching between fact categories in a deck |
| `SubcategoryChip.svelte` | Individual subcategory filter chip |
| `DuplicateMixingModal.svelte` | Warning/options modal when mixing duplicate facts across decks |
| `LoadoutCard.svelte` | Compact card tile used in loadout/preset displays |
| `PlaylistBar.svelte` | Horizontal bar showing the active study playlist |
| `PlaylistPickerPopup.svelte` | Popup for choosing a study playlist |
| `LanguageGroupHeader.svelte` | Section header grouping language deck entries by family |

---

## Rooms & Events

| Component | Purpose |
|-----------|---------|
| `ShopRoomOverlay.svelte` | Shop: buy/sell cards and relics, card removal, haggle quiz |
| `RestRoomOverlay.svelte` | Rest room: heal HP, study to upgrade a card, meditate to remove one |
| `MysteryEventOverlay.svelte` | Mystery event: narrative choice cards with quiz-gated outcomes |
| `SpecialEventOverlay.svelte` | Scripted lore/mechanic special events |
| `PostMiniBossRestOverlay.svelte` | Post-mini-boss rest: auto-heal + optional card upgrade |
| `MeditateOverlay.svelte` | Meditate rest option: pick a card to permanently remove |
| `UpgradeSelectionOverlay.svelte` | Rest-room card upgrade: pick one card from candidates |
| `MultiChoicePopup.svelte` | Generic multi-choice modal for event branching and onboarding |

---

## Rewards & Progression

| Component | Purpose |
|-----------|---------|
| `CardRewardScreen.svelte` | Post-combat reward: animated gold/heal reveal then 3-card pick |
| `RewardCardDetail.svelte` | Expanded detail for a single reward card (RewardRoomScene). Renders an identical V2 card frame to CardHand.svelte. AP cost font: `var(--card-w) * 0.14`. Effect text uses `'Kreon', 'Georgia', serif` matching CardHand. Adaptive size classes: `effect-text-md` (>15 chars), `effect-text-sm` (>25), `effect-text-xs` (>35) computed by `effectTextSizeClass()`. `.desc-number` inherits font/color from parent (no override). |
| `RunEndScreen.svelte` | Run summary: victory/defeat, XP breakdown, facts correct, floor reached |
| `ArchetypeSelection.svelte` | Run-start archetype picker: Balanced / Aggressive / Defensive / Scholar |
| `GachaReveal.svelte` | Gacha-style animated reveal for rare unlocks and season rewards |
| `SeasonRewardOverlay.svelte` | Animated season pass tier reward unlock overlay |
| `KnowledgeTree.svelte` | Visual mastery tree showing fact unlock progression |
| `KnowledgeTreeView.svelte` | Scrollable wrapper for KnowledgeTree |
| `LearningInsightsTab.svelte` | Per-domain accuracy and retention insights tab |
| `ProgressBars.svelte` | Generic multi-segment progress bar component |
| `BadgeDisplay.svelte` | Grid of earned achievement badges |
| `StreakPanel.svelte` | Daily streak calendar and history panel |

---

## Relics

| Component | Purpose |
|-----------|---------|
| `RelicTray.svelte` | Horizontal relic tray with triggered-relic highlight |
| `RelicPickupOverlay.svelte` | Relic acquisition: accept or decline a found relic |
| `RelicPickupToast.svelte` | Toast when a relic is auto-picked up; offers Swap if slots are full |
| `RelicSwapOverlay.svelte` | Overlay for swapping an offered relic with an equipped one |
| `RelicCollectionScreen.svelte` | Browse all discovered relics with lore and stats |
| `StarterRelicSelection.svelte` | Starter relic picker (dead code; removed in AR-59.12) |
| `RarityBadge.svelte` | Small colored rarity badge (common / uncommon / rare / legendary) |

---

## CardApp Global Overlays

Global overlays rendered directly in `src/CardApp.svelte` (not component files).

### Active-Run Banner (`.active-run-banner`)

Fixed banner at the top of the screen (z-index 250) shown when `showActiveRunBanner` is true and there is a saved run in progress.

**Layout (updated 2026-04-01):** Column flex layout — label stacked above centered buttons.
- `.active-run-banner`: `flex-direction: column; align-items: center; gap: calc(6px * var(--layout-scale, 1))`
- `.banner-label`: label text ("Run in progress"), `font-size: calc(11px * var(--text-scale, 1)); opacity: 0.8`
- `.banner-buttons`: inner row, `display: flex; justify-content: center; gap: calc(10px * var(--layout-scale, 1))`
- Resume button (`.banner-resume-btn`): green gradient background, `min-height: 44px`
- Abandon button (`.banner-abandon-btn`): muted slate background, `min-height: 44px`

Was (pre-2026-04-01): single flex row — label + two buttons in one row with `justify-content: center`, causing buttons to be visually off-center because the label text shifted the group to the right.
