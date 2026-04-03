# UI Component Catalog

> **Purpose:** Gameplay-critical Svelte components: Combat UI, Quiz & Study, Hub & Navigation, Dungeon & Map, Card Management, Rooms & Events, Rewards & Progression, Relics.
> **Last verified:** 2026-04-03
> **Source files:** `src/ui/components/**/*.svelte` (190 files), `src/CardApp.svelte`, `src/ui/effects/hubAnimationLoop.ts`, `src/ui/effects/hubLightingState.ts`, `src/ui/effects/HubGlowEffect.ts`, `src/ui/effects/CampfireEffect.ts`, `src/ui/effects/spritesheetPlayer.ts`, `src/ui/effects/petBehavior.ts`

> **See also:** [`components-social.md`](components-social.md) — Social & Multiplayer, Profile & Account, Auth & Legal, Monetization & Seasons, Onboarding & Cutscenes, Utility & Effects.

---

## Combat UI

| Component | Purpose |
|-----------|---------|
| `CardHand.svelte` | Renders the player's hand with V2 card frames, art, mastery glow, chain color groups, and damage-modifier coloring (green=buffed, red=nerfed via `damagePreviews` prop). **AR-310:** Accepts `activeChainColor?: number | null` prop — cards matching the active chain type get a `drop-shadow` glow in the chain color plus `.card--active-chain` CSS class (subtle white outline) when no card is selected. Glow suppressed while dragging or another card is selected. |
| `CardCombatOverlay.svelte` | Root combat screen: wraps CardHand + QuizOverlay, handles surge/boss phases, landscape/portrait. **Dev skip button:** When `import.meta.env.DEV` is true, a red `.dev-skip-btn` button is rendered in `CardApp.svelte` during the combat screen block, positioned fixed below the MusicWidget (top-right, `z-index: 201`). Clicking it calls `devForceEncounterVictory()` from `encounterBridge.ts` to immediately trigger a victory. Hidden in production builds via Vite tree-shaking. Computes `damagePreviews` via `damagePreviewService` and passes to CardHand. Derives `activeChainColor = turnState?.activeChainColor ?? null` and passes to both ChainCounter and CardHand (AR-310). Calls `ambientAudio.duck()` / `unduck()` via `$effect` reactive on `isQuizPanelVisible` — ducks ambient when charge quiz panel is showing. **Landscape AP sphere** (`.lsb-ap-standalone`): positioned at `left: calc(16px * var(--layout-scale, 1))`, `bottom: 38vh` — raised from 34.5vh to 38vh (2026-04-01) to clear the draw pile (at 27.2vh with scale 0.85). `DamagePreviewContext` now includes `playerStrengthModifier: getStrengthModifier(ps.statusEffects)` — damage previews show red/green when player has weakness/strength. |
| `CombatHUD.svelte` | Legacy HP bars + combat log; largely superseded by InRunTopBar |
| `InRunTopBar.svelte` | Landscape/Portrait HUD: HP bar, shield badge, gold, floor/segment, relic tray, fog level, pause. Inline player status effect icons (poison, burn, etc.) to the right of the HP bar — hover to show per-icon popup. `.hp-group` uses `flex: 1 0 auto` (never shrinks when icons are added). Icon size matches HP bar height (`var(--topbar-height) * 0.58`). Status popup is per-wrapper positioned below each icon on hover; backdrop click pattern removed. `.section-left` uses `max-width: 35%`. Accepts optional `statusEffects` prop (from `topBarPlayerEffects` derived in CardApp.svelte). **Fog gauge:** `getAuraLevel()` returns 0-10. The gauge maps this to a -5..+5 display range via `{@const displayFl = fl - 5}` — negative = flow (green, fills left), positive = fog (red, fills right), zero = neutral (2026-04-01 fix). |
| `MusicWidget.svelte` | Ultra-sleek Spotify-style BGM player widget. Single expanding container: collapsed pill (~56×36px, top-right, `position: fixed`, z-index 201) expands to a 240px glass panel — not two separate elements. Collapsed shows a 6-bar spectrogram canvas (48×32) built from AnalyserNode frequency bins. Expanded shows: wider spectrogram, track title + marquee overflow, **EPIC / LO-FI** category toggle (renamed from "QUIET"), prev/play-pause/next controls, volume slider with mute toggle. Volume and mute synced with `cardAudioManager` `musicVolume`/`musicEnabled` stores (single source of truth, not internal widget state). rAF animation loop driven by `musicService.getFrequencyData()` — idle sine wave when not playing. Glass morphism: `backdrop-filter: blur(20px)`, `rgba(8, 10, 18, 0.4)` background. All sizing uses `clamp()` units (viewport-clamped). Expand/collapse via CSS `max-height` + `opacity` transition. Closes on outside click. Rendered in `CardApp.svelte` alongside `InRunTopBar` whenever `showTopBar` is true. `musicService.startIfNotPlaying()` auto-fires on entering any `IN_RUN_SCREENS`. |
| `ChainCounter.svelte` | Animated chain streak badge. **AR-310:** Always-visible active chain color bar (`.active-chain-bar`) when `activeChainColor` prop is provided — shows colored dot + chain name at chain length 0 ("Play to chain!" hint), upgrades to show multiplier when chain >= 1. Existing slam-animation chain display (`.chain-display`) still shown at chain length >= 2. Props: `isPerfectTurn`, `chainLength`, `chainType`, `chainMultiplier`, `activeChainColor: number | null`. |
| `ChainIcon.svelte` | Single chain-type icon pip used in ChainCounter and card frames |
| `DamageNumber.svelte` | Floating combat numbers (damage, block, heal, poison, burn, bleed, gold, crit) |
| `StatusEffectBar.svelte` | Row of active status effect icons + counts during combat. Enemy bar positioned at `14vh` (portrait) / `18vh` (landscape override via ). Player StatusEffectBar removed — player effects now inline in InRunTopBar. Icon `.effect-icon` has intentional dark background `rgba(20, 28, 40, 0.6)` with `rgba(255,255,255,0.4)` white border (2026-04-01) for clear icon framing, plus white outline `drop-shadow`. Stack badge (`.effect-stack`) shows for `value >= 1` (not `> 1`), sized 20×20px. Turn counter (`.effect-turns`) font 12px, color `#e2e8f0`, with text-shadow. `brain_fog` and `flow_state` desc functions show context-aware text based on fog level thresholds: ≤2 = Flow State active, 3-6 = Neutral, ≥7 = Brain Fog active. |
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

`CardCombatOverlay` builds the full `DamagePreviewContext` from `turnState` and calls `computeDamagePreview` for every card in hand, passing the result as `{damagePreviews}` to CardHand. `DamagePreviewContext` fields include `playerStrengthModifier?: number` (1.0 = neutral, >1 = strength buff, <1 = weakness nerf) — populated via `getStrengthModifier(ps.statusEffects)` from `statusEffects.ts`.

### CardHand tier classes

Cards have `class:tier-2a`, `class:tier-2b`, and `class:tier-3` bindings in the template (both landscape and portrait paths). The corresponding CSS rules carry no visual effects — tier drop-shadow glow styles (silver for 2a/2b, gold for tier-3) were removed 2026-03-31. The class bindings remain in the template for potential future use.

### CardHand charge button AP display

The charge button and drag-charge zone both show the **total AP cost** to charge, not just the surcharge. This means a 1 AP card displays "2 AP ⚡ CHARGE" (base 1 + surcharge 1), not "+1 AP".

-  — total cost (base card cost minus focus discount + surge/momentum surcharge)
- When free (surge/momentum/isFreeCharge): , displays "0 AP" with green badge color
- Badge color: green when free, red when , default otherwise
- Drag zone indicator uses  (same formula, no isFreeCharge factor)
- Applies to landscape charge button (~line 978), portrait charge button (~line 1369), landscape drag zone (~line 968), portrait drag zone (~line 1354)

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
| `StudyQuizOverlay.svelte` | Rest-room study quiz: boss-quiz–style questions to upgrade card charges. Shows inline `SRS +` / `SRS -` indicator (green/red, 0.65 opacity, scaled `10px`) alongside correct/wrong feedback text. |
| `MasteryChallengeOverlay.svelte` | Mastery challenge room: timed quiz sequence for card mastery rewards. Calls `ambientAudio.setContext('mastery_challenge')` on `$effect` when challenge is set |
| `ScholarQuizPanel.svelte` | Scholar-challenge run quiz panel with extended question formats |
| `EventQuiz.svelte` | Quiz embedded inside mystery/special events for branching outcomes. Choice buttons have `data-testid="quiz-answer-{i}"` (0-indexed) for automated testing — matches pattern used in `QuizOverlay.svelte`. |
| `GrammarTypingInput.svelte` | Free-text typing input for grammar deck tilde-fragment answers |
| `WordHover.svelte` | Hoverable word revealing dictionary definition on hover/tap |
| `ProceduralStudyScreen.svelte` | Full-screen procedural math practice session. Calls `startProceduralSession` on mount, generates questions via `getNextQuestion`, grades with `gradeProceduralAnswer`. Shows running accuracy stats (questions answered, accuracy %). Answer buttons go green/red on feedback with a 1.2s delay before next question. "Stop" button returns to `studyTemple`. Tier badge shows current skill difficulty (Learning/Familiar/Advanced/Mastered). Uses same CSS scaling conventions as other screens. Props: `deckId: string`, `subDeckId?: string`, `onBack: () => void`. |
| `StudySession.svelte` | Standalone study session for the Study Temple screen. After player taps a rating button, shows a floating `SRS +` (green) or `SRS -` (red) label above the rating buttons for the 300ms pause before advancing. State: `srsIndicator: '+' | '-' | null`. |
| `StudyStation.svelte` | Quick-review widget inside the Hub |
| `StudyModeSelector.svelte` | Toggle between multiple-choice / typing / flashcard modes |
| `FactReveal.svelte` | Animates the reveal of a new fact after answering correctly |
| `FactArtwork.svelte` | Displays the artwork image associated with a knowledge fact card |

---

## Hub & Navigation

| Component | Purpose |
|-----------|---------|
| `HubScreen.svelte` | Main hub: campfire, NPC sprites, run summary, navigation entry points. Calls `ambientAudio.setContext('hub')` on initial `$effect`. Integrates hub lighting engine, glow canvas, fireflies, moths, custom cursor light, per-sprite brightness with mouse proximity bonus, and background warmth filter. Tracks mouse via `onpointermove`/`onpointerleave`; hides system cursor with `style:cursor="none"` when effects are enabled. Child interactive elements use `cursor: inherit` (not `cursor: pointer`) so the hub cursor:none propagates correctly. **Z-index layering (landscape)**: `.camp-bg-wide` z-0, HubGlowCanvas glow-canvas z-1 / vignette z-2, `.hub-center` z-3 (raised from z-1 on 2026-04-01 so all sprites and HUD inside hub-center paint above the vignette overlay; background image at z-0 still gets darkened by vignette). |
| `HubNavBar.svelte` | Bottom navigation bar (Library, Profile, Social, Leaderboards) |
| `HubVisitorView.svelte` | Visitor profile view when browsing another player's hub |
| `CampHudOverlay.svelte` | HUD overlay on the hub: streak, gold, XP progress bar |
| `CampSpriteButton.svelte` | Clickable NPC sprite button in the hub scene. Props: `spriteOffsetX`/`spriteOffsetY` for CSS translate repositioning; `brightness` (default 1.0) for campfire lighting via `--sprite-brightness` CSS custom property. `fireShadow` prop removed 2026-04-01 (full-frame sprites caused alpha-channel blob halos). `.sprite-hitbox` uses `cursor: inherit` (updated 2026-04-01, was `cursor: pointer`) so the hub `cursor: none` is not overridden by child buttons — the custom glow cursor IS the hover feedback when effects are active. See "Hub Lighting" section below. |
| `CampSpeechBubble.svelte` | Speech bubble overlay for hub NPC characters |
| `AnimatedPet.svelte` | Canvas-based animated hub pet. Renders 64×64 px horizontal spritesheet strips for 6 `PetBehavior` states (`idle`, `walk`, `sit`, `lick`, `sleep`, `react`) driven by the `petBehavior.ts` state machine and the shared 30fps `hubAnimationLoop`. Position follows `petState.position` (% of `.hub-center` container). Walk bob: sine-wave vertical offset `sin(now * 0.006) * 2` px during walk. Flip: `facingLeft` passed as `flipX` to `drawSpritesheetFrame`. Props: `species?: PetSpecies` (default `'cat'`), `disableEffects?: boolean` (reduces to static frame 0 at campfire, no loop), `onclick?: () => void`. Click triggers `triggerReact()` then the callback. Minimum tap target 44×44px hitbox button overlay. Graceful degradation: if a behavior spritesheet fails to load, that behavior renders nothing. z-index 35. CSS size `calc(64px * var(--layout-scale, 1))`. Replaces `CampSpriteButton` pet in `HubScreen.svelte` (both landscape and portrait) — 2026-04-02. |
| `CampfireCanvas.svelte` | Canvas-based animated campfire flicker effect. CSS size is `calc(200px * var(--layout-scale, 1))` × `calc(250px * var(--layout-scale, 1))`. **z-index: 26** — above campfire sprite (z-25) so ember particles render on top of the fire art. On mount, canvas pixel dimensions are set from `clientWidth`/`clientHeight`; a `ResizeObserver` keeps them in sync. Scale factor (`clientWidth / 200`) is passed to `CampfireEffect` constructor and updated via `setScale()`. |
| `HubGlowCanvas.svelte` | Two-canvas hub glow system (updated 2026-04-01 perf pass): (1) `position: fixed` canvas with `mix-blend-mode: screen` for additive warm orange radial glow; (2) sibling `<canvas class="hub-vignette-canvas">` with `mix-blend-mode: normal` for vignette darkening — replaces the old CSS `<div>` whose reactive `radial-gradient` was being reparsed by Chrome each frame. Props: `campfireCenterFn: () => {x, y}` (absolute viewport pixels), `zIndex?: number` (default 1; vignette canvas gets `zIndex + 1`), `mouseX?: number` / `mouseY?: number` — forwarded to `HubGlowEffect.setMousePosition()`. No longer imports `getHubLightingStore()` — vignette gradient is drawn directly by `HubGlowEffect` onto the second canvas each frame. |
| `HubFireflies.svelte` | Ambient firefly particles driven by **shared-loop sine-wave motion** (updated 2026-04-01 perf pass). Uses `hubAnimationLoop.ts` shared 30fps loop instead of own RAF. Spawns 15 fireflies on mount; keeps count stable by respawning dead ones immediately. **Motion:** each firefly has per-fly `phase`, `ampX`/`ampY`, `freqX`/`freqY`, `depthLayer` (0.5–1.0). Position updated every 30fps tick; Svelte `tick` $state only incremented every 3rd frame (~10fps) to reduce 15-element DOM style-recalc cascade. **Lifecycle:** fadingIn 600ms → alive 4–8s → fadingOut 800ms → dead → respawn. **Alpha:** `maxAlpha = 0.4 + depthLayer * 0.4` (0.6–0.8). **No CSS keyframes** — all motion is JS-driven. **Spawn:** full-screen excluding campfire zone 40–60%x / 55–75%y. **Size:** `(size * depthLayer)px * var(--layout-scale, 1)`. **Reduce-motion:** static positions, no callback registration. |

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
- Uses shared 30fps loop from `hubAnimationLoop.ts` — no own RAF (updated 2026-04-01 perf pass)
- **Responsive flicker** (updated 2026-04-01): easing factor 0.15/frame — visible changes within ~5 frames (~170ms). New target picked every 150–600ms (was 300–1200ms). Dim dip floor lowered to 0.15 (was 0.25), bright flare ceiling raised to 0.95 (was 0.90). Per-frame micro-jitter of ±0.02 for alive feel. Slow breathing sine (amplitude 0.08, freq 0.0015) for macro rhythm.
- **Brighter peaks** (updated 2026-04-01): 3% super flare → instantly targets 1.0 (quick 100–200ms burst); 10% bright flare → 0.90–1.0+ (was 0.80–0.95); 77% normal range → 0.45–0.75 (was 0.45–0.70, widened for livelier baseline). Super flare checked before dim dip and bright flare.
- Streak multiplier scales flicker amplitude (streak 0 → ×1.0, streak 7+ → ×1.6 capped at ×1.8)
- Reactive store throttled to every 3rd frame (~10fps) to reduce Svelte reactive cascade overhead; `getSnapshot()` still updates every frame for canvas consumers
- Respects `localStorage 'card:reduceMotionMode'` — returns static middle values when true

**Exports:**

| Export | Type | Description |
|--------|------|-------------|
| `HubLightingSnapshot` | interface | `{ intensity, warmth, sparkChance }` all 0–1 |
| `HubLightingReactive` | interface | `{ spriteBrightness, warmth, intensity }` for CSS consumers |
| `CAMPFIRE_CENTER_PCT` | const | `{ x: 50, y: 64 }` — campfire center as % of hub container |
| `getSnapshot()` | function | Allocation-free synchronous read; returns mutated shared object |
| `getHubLightingStore()` | function | Returns Svelte writable store throttled to ~10fps (every 3rd frame) for CSS consumers. Used by HubScreen for per-sprite brightness. No longer used by HubGlowCanvas (vignette drawn by HubGlowEffect directly onto canvas). |
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
- `new HubGlowEffect(canvas, vignetteCanvas, campfireCenterFn)` (updated 2026-04-01 perf pass — now takes two canvases)
- Uses shared 30fps loop from `hubAnimationLoop.ts` — no own RAF
- **Pass 1 (warm glow):** radial gradient centered on campfire, `0%: rgba(255,140,40, intensity*0.25)` → `30%: rgba(255,100,20, intensity*0.12)` → `100%: transparent`; radius = `diagonal * (0.55 + intensity * 0.10)`
- **Pass 2 (mouse light):** when `setMousePosition(x, y)` has been called, draws a second radial gradient centered on the cursor. Radius = `diagonal * 0.15` (smaller than campfire). Alphas: `rgba(255,220,160, intensity*0.10)` → `rgba(255,200,140, intensity*0.04)` → transparent. Adds subtle warm illumination near the cursor on the screen-blend canvas.
- **Pass 3 (vignette):** drawn onto `vignetteCanvas` (normal blend mode) each frame using `ctx.createRadialGradient()`. Intensity-modulated stops: transparent at campfire center, `rgba(5,5,15, 0.20–0.30)` → `rgba(5,5,15, 0.55–0.65)` → `rgba(2,2,8, 0.83–0.88)` → `rgba(2,2,8, 0.93)` at outer edge. Replaces old CSS `<div>` whose reactive `$derived` gradient string was being reparsed by Chrome each frame (even when quantized to 20 steps).
- `mix-blend-mode: screen` on glow canvas CSS makes glow additive (dark = transparent — correct for warm glow). Vignette canvas uses `mix-blend-mode: normal` so it can genuinely darken edges.
- Reduce-motion: draws one static frame at `intensity=0.5`, no RAF loop
- `setMousePosition(x, y)` / `clearMousePosition()` — forwarded from `HubGlowCanvas` via `$effect` when `mouseX`/`mouseY` props change
- `start()` / `stop()` / `destroy()` lifecycle

### Hub Shared Animation Loop

`src/ui/effects/hubAnimationLoop.ts` — single 30fps RAF loop shared by all hub ambient systems (added 2026-04-01 perf pass).

**Purpose:** Replaces 4 separate `requestAnimationFrame` loops that were running simultaneously (`hubLightingState`, `CampfireEffect`, `HubGlowEffect`, `HubFireflies`). Consolidating into one loop reduces RAF callback overhead and ensures all systems advance in lockstep.

**API:**

| Export | Type | Description |
|--------|------|-------------|
| `FrameCallback` | type alias | `(now: number, deltaMs: number) => void` |
| `registerCallback(cb)` | function | Register a callback; auto-starts the loop on first registration |
| `unregisterCallback(cb)` | function | Unregister; auto-stops the loop when no callbacks remain |

**Behavior:**
- Throttles to 30fps (FRAME_MS = 33.3ms) using a frame-skip approach
- Guards against tab-hidden wake-up spikes by capping `deltaMs` at 100ms
- Auto-starts RAF when the first callback is registered
- Auto-stops RAF when all callbacks are unregistered (zero overhead when hub is not visible)
- De-duplicates registrations (safe to call `registerCallback` multiple times with same ref)


## Dungeon & Map

| Component | Purpose |
|-----------|---------|
| `DungeonMap.svelte` | Procedurally generated dungeon map with branching node paths. Calls `ambientAudio.setContext('dungeon_map')` on `onMount` |
| `DungeonEntrance.svelte` | Dungeon entry screen with parallax transition and language selection |
| `MapNode.svelte` | Individual room node on the dungeon map (combat, shop, rest, mystery, boss) |
| `MapAmbientParticles.svelte` | Ambient particle layer over the dungeon map |
| `DomainSelection.svelte` | Domain/topic selection for trivia-mode runs |
| `DomainStrip.svelte` | Horizontal strip for a domain category with icon and name |
| `DomainStripCard.svelte` | Individual card within a DomainStrip |
| `TriviaDungeonScreen.svelte` | Entry screen for trivia-dungeon mode with domain selection |
| `RetreatOrDelve.svelte` | Post-boss decision: retreat for safety vs. delve deeper. Calls `ambientAudio.setContext('retreat_delve')` on initial `$effect` on mount |
| `TheDeepUnlockOverlay.svelte` | Unlock overlay when the player first reaches floor 10+ |

### DungeonMap fog-of-war system

**Source:** `DungeonMap.svelte`

The fog system uses **progressive node blur based on distance** combined with **scattered atmospheric fog wisps**. No opaque overlays or masks block visibility — the fog is purely visual depth cues.

**Node visibility by distance (from current row):**

| Rows | Blur | Opacity | Visibility |
|------|------|---------|-----------|
| 0–1 | 0px | 1.0 | Clear, fully visible |
| 2 | 8px | 0.4 | Slightly soft |
| 3 | 16px | 0.2 | Very soft, hard to read |
| 4+ | 24px | 0.08 | Nearly imperceptible |

Node blur and opacity applied via CSS `filter: blur(...)` and `opacity: ...` on `.node-position` elements. Edge connection lines (`.edge-layer` SVG) apply the same opacity progression (1.0 → 0.4 → 0.15 → 0.05). Transitions smooth over 0.6s as the player advances.

**Fog wisps:** 17 scattered clouds across 3 size tiers (medium 300–500px, large 550–800px, backdrop 900–1200px). Each wisp uses Web Animations API for 6-keyframe meandering paths with 200–450px drift. Soft diffuse radial-gradient fades to transparent at radius 100%. Extends full screen width via `left: -50vw; right: -50vw` inside `.dungeon-map-overlay`. Respects `prefers-reduced-motion` — skips animation.

**Z-index stack:**

| z-index | Element | Role |
|---------|---------|------|
| 0 | `.row-marker` | Floor depth labels |
| 1 | `.edge-layer` SVG | Connection lines |
| 2 | `.node-position` | Map nodes |
| 3 | `.fog-overlay` | Fog wisps (atmospheric only) |
| 4 | `.vignette-overlay` | Edge darkening (position: fixed) |

---

## Card Management & Deck Building

| Component | Purpose |
|-----------|---------|
| `DeckSelectionHub.svelte` | Run-start hub: choose trivia mode vs. curated study deck |
| `DeckBuilder.svelte` | Full deck-builder: browse, filter, and manage curated deck cards |
| `CardBrowser.svelte` | Card collection browser with filtering and sorting in the Library |
| `CardExpanded.svelte` | Full-screen expanded card view with all details and fact text |
| `CardPickerOverlay.svelte` | Pick a specific card from the deck (e.g., transmute target) |
| `DeckTileV2.svelte` | Tile component for a curated deck in the selection grid. 3D tilt on hover, shine overlay, deal animation. Single-image CSS parallax when `/assets/sprites/deckfronts/{id}.webp` is found (single image shifts against pointer, 0.08% multiplier, scale 1.08). When `hasImage` is true, adds `.has-image` class: title uses `position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%) translateZ(40px)` (bottom-center of art area, floating in 3D space), and badges float at `translateZ(30px)`. **Procedural deck support:** when `deck.procedural` is true, shows a single skill count bar ("X skills") instead of Seen/Review/Mastered progress bars, with a "Practice to track progress" hint. Description auto-falls back to "X skills" instead of "X facts" for procedural decks. |
| `DeckDetailModal.svelte` | Modal showing deck contents, stats, and subcategory breakdown. **Procedural deck support:** when `deck.procedural` is true, the progress line reads "X skills" instead of "X facts mastered", and the start button reads ">> START PRACTICE" instead of ">> START STUDY RUN". |
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

### DeckTileV2 parallax (single-image approach)

When `/assets/sprites/deckfronts/{deckId}.webp` exists (checked at runtime via `Image.onload`), the art area renders a single background image with pointer-driven parallax shift instead of just the plain CSS gradient.

**Parallax formula:** `(pointer - center) * -0.08` % translation against pointer direction. The image is scaled to 1.08× to prevent edge gaps during the shift.

The combined effect has three layers of motion:
1. Image shifts against pointer (the parallax)
2. Card tilts ±24° on X/Y axes (pre-existing 3D rotation driven by pointer position)
3. Title floats at `translateZ(40px)`, visually separating from the image during tilt

> **Why not fg/bg depth layers?** A two-layer depth approach (foreground masked by `_depth.webp` luminance, shifting independently from background) was prototyped and rejected. The masked foreground produced a visible "bad cutout moving over the other" artifact. Depth maps are still generated and stored as `{id}_depth.webp` in case the approach is revisited.

**Image path resolution** uses `PARENT_PREFIXES` (japanese, chinese, korean, spanish, french, german, dutch, czech). A deck id of `japanese_n5_vocab` resolves to `deckfronts/japanese.webp`. The Study Temple ALL tab uses synthetic IDs with an `all:` prefix (e.g., `all:japanese`) — the resolver strips this prefix before lookup, so no separate image is needed for ALL-tab entries.

**Z-order inside `.art-area`:**
- `.parallax-img` — z-index 0
- `.deck-title-3d`, `.badge` — z-index 2
- `.shine-overlay` (on `.deck-tile`, covers whole card) — z-index 10

**Reduced motion** — the parallax translation has `transition: none !important` in the reduced-motion media query. The static image remains visible; only the movement is disabled.

The CSS gradient `background-image` on `.art-area` is always present as a fallback; the parallax image renders on top when available.

### DeckTileV2 floating title (has-image mode)

When `hasImage` is `true`, the `.art-area` receives the `.has-image` class which activates a 3D floating title effect:

**Layout change** —  uses absolute positioning instead of flex layout to anchor the title at bottom-center of the art area:



The  plus  centers the title horizontally over the art, independent of its text width. This replaces the previous  approach, which left-aligned the title when text was narrower than the container.

**Title depth layer** — the  in the transform places the text 40px closer to the viewer in 3D space. Because  has , when the card tilts on hover (±24° rotation) the text visually separates from the background image — the stronger the tilt, the more pronounced the floating effect.

**Text styling override** — The default 3D stacked text-shadow (8 layers, used on text-only tiles) is replaced by two focused shadow groups:
- Four directional 2px offsets at 0.9 opacity — creates a crisp pixel outline around each letter
- Two soft drop shadows (4px and 8px) at 0.7/0.4 opacity — simulates the shadow cast by text floating above the card surface
- `color: #ffffff` (full white, not the 0.95 alpha default)
- `filter: drop-shadow(...)` for an additional outer glow

**Badge depth layer** — `.has-image .badge` applies `transform: translateZ(calc(30px * var(--layout-scale, 1)))` — slightly less depth than the title so the badge and title have distinct Z planes.

**Non-image tiles** — The original centered layout and stacked text-shadow are unchanged when `hasImage` is `false`. Both code paths are fully independent.


---

## Rooms & Events

| Component | Purpose |
|-----------|---------|
| `ShopRoomOverlay.svelte` | Shop: buy/sell cards and relics, card removal, haggle quiz. Calls `ambientAudio.setContext('shop')` on `$effect` |
| `RestRoomOverlay.svelte` | Rest room: heal HP, study to upgrade a card, meditate to remove one. Calls `ambientAudio.setContext('rest')` on `$effect` |
| `MysteryEventOverlay.svelte` | Mystery event: narrative choice cards with quiz-gated outcomes. Calls `ambientAudio.setContext('mystery')` on `$effect` when event is set |
| `SpecialEventOverlay.svelte` | Scripted lore/mechanic special events |
| `PostMiniBossRestOverlay.svelte` | Post-mini-boss rest: auto-heal + optional card upgrade |
| `MeditateOverlay.svelte` | Meditate rest option: pick a card to permanently remove |
| `UpgradeSelectionOverlay.svelte` | Rest-room card upgrade: pick one card from candidates |
| `MultiChoicePopup.svelte` | Generic multi-choice modal for event branching and onboarding |
| `NarrativeOverlay.svelte` | Full-screen atmospheric narrative overlay for room transitions and NPC dialogue. Always click-through: line 1 appears on mount, each click reveals the next line; when all lines are visible, next click triggers ash dissolve exit. State machine: **REVEALING** (lines appear one at a time) → **DISSOLVING** (ash animation, clicks ignored) → **DONE** (onDismiss fired). Click mid-animation skips to fully visible; click on settled line advances or begins dissolve on last line. Hint shows 0.8s after line settles: "click to continue" or "click to dismiss". Entrance keyframe: `lineReveal` 0.8s (opacity 0→1, translateY 12px→0, scale 0.95→1, glow pulse at 60%). Exit keyframe: `ashDissolve` 0.8s per line, staggered 0.15s, blur+float+letter-spacing expansion. Text: 22px (was 18px), max-width calc(1100px * var(--layout-scale, 1)) (was 800px), gap calc(28px * var(--layout-scale, 1)) (was 20px). Props: `lines: NarrativeLine[]`, `mode?: 'auto-fade' | 'click-through'` (kept for API compat, always ignored), `onDismiss: () => void`. z-index 950. Driven by `narrativeStore.ts` (`showNarrative()` / `dismissNarrative()`). **Wired into `CardApp.svelte`** — gated by `$narrativeDisplay.active`, renders above other overlays at z-index 950. See docs/mechanics/narrative.md §Display System. |

---

## Rewards & Progression

| Component | Purpose |
|-----------|---------|
| `CardRewardScreen.svelte` | Post-combat reward: animated gold/heal reveal then 3-card pick. **Landscape sizing (2026-04-01):** `.altar-shell` width `min(80vw, 1200px)`, scale 1.5 (was 65vw/900px/1.15). `.altar-option` min-height 300px (was 200px), padding 54/15/18px (was 36/10/12px). `.altar-options` gap 24px (was 16px). `.mini-card-name` 20px (was 15px). `.mini-card-desc` 16px (was 12px). |
| `RewardCardDetail.svelte` | Expanded detail for a single reward card (RewardRoomScene). Renders an identical V2 card frame to CardHand.svelte. AP cost font: `var(--card-w) * 0.14`. Effect text uses `'Kreon', 'Georgia', serif` matching CardHand. Adaptive size classes: `effect-text-md` (>15 chars), `effect-text-sm` (>25), `effect-text-xs` (>35) computed by `effectTextSizeClass()`. `.desc-number` inherits font/color from parent (no override). |
| `RunEndScreen.svelte` | Run summary: victory/defeat, XP breakdown, facts correct, floor reached. Calls `ambientAudio.setContext('run_end_victory')` or `setContext('run_end_defeat')` on `onMount` branched on `isVictory` |
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
