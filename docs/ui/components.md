# UI Component Catalog

> **Purpose:** Gameplay-critical Svelte components: Combat UI, Quiz & Study, Hub & Navigation, Dungeon & Map, Card Management, Rooms & Events, Rewards & Progression, Relics.
> **Last verified:** 2026-04-05
> **Source files:** `src/ui/components/**/*.svelte` (194 files), `src/CardApp.svelte`, `src/ui/effects/hubAnimationLoop.ts`, `src/ui/effects/hubLightingState.ts`, `src/ui/effects/HubGlowEffect.ts`, `src/ui/effects/CampfireEffect.ts`, `src/ui/effects/spritesheetPlayer.ts`, `src/ui/effects/petBehavior.ts`

> **See also:** [`components-social.md`](components-social.md) — Social & Multiplayer, Profile & Account, Auth & Legal, Monetization & Seasons, Onboarding & Cutscenes, Utility & Effects.

---

## Combat UI

| Component | Purpose |
|-----------|---------|
| `CardHand.svelte` | Renders the player's hand with V2 card frames, art, mastery glow, chain color groups, and damage-modifier coloring (green=buffed, red=nerfed via `damagePreviews` prop). **AR-310:** Accepts `activeChainColor?: number | null` prop — cards matching the active chain type get a `drop-shadow` glow in the chain color, a `.card--active-chain` class (no outline; kept for glow via inline style), and a `pill-chain-active` class on the chain color pill div which triggers a `chainPillPulse` keyframe animation (1.5s, scale 1→1.35 with box-shadow in chain color). Glow/pulse suppressed while dragging, while the card is selected, or while any other card is selected. The `.charge-play-btn-landscape` button has `z-index: 30` so it renders above selected cards (`z-index: 25`) and is always tappable. **Accessibility (2026-04-06):** Both landscape (line 847) and portrait (line 1195) card button `aria-label` attributes now call `getShortCardDescription(card, getEffectValue(card))` — passing the mastery-adjusted runtime value from `getMasteryStats()` as `powerOverride`, so screen readers announce the correct damage/block value instead of the stale `card.baseEffectValue`. |
| `CardCombatOverlay.svelte` | Root combat screen: wraps CardHand + QuizOverlay, handles surge/boss phases, landscape/portrait. **Dev skip button:** When `import.meta.env.DEV` is true, a red `.dev-skip-btn` button is rendered in `CardApp.svelte` during the combat screen block, positioned fixed below the MusicWidget (top-right, `z-index: 201`). Clicking it calls `devForceEncounterVictory()` from `encounterBridge.ts` to immediately trigger a victory. Hidden in production builds via Vite tree-shaking. Computes `damagePreviews` via `damagePreviewService` and passes to CardHand. Derives `activeChainColor = turnState?.activeChainColor ?? null` and passes to both ChainCounter and CardHand (AR-310). Calls `ambientAudio.duck()` / `unduck()` via `$effect` reactive on `isQuizPanelVisible` — ducks ambient when charge quiz panel is showing. **Landscape AP sphere** (`.lsb-ap-standalone`): positioned at `left: calc(16px * var(--layout-scale, 1))`, `bottom: 38vh` — raised from 34.5vh to 38vh (2026-04-01) to clear the draw pile (at 27.2vh with scale 0.85). `DamagePreviewContext` now includes `playerStrengthModifier: getStrengthModifier(ps.statusEffects)` — damage previews show red/green when player has weakness/strength. **`onplaycard` signature (2026-04-04):** Last parameter `wasQuizzed?: boolean` added — `false` for Quick Play and guaranteed/Soul Jar charge paths (no quiz shown), `true` for charge paths where the quiz was actually presented to the player (both correct and wrong answer paths). |
| `CombatHUD.svelte` | Legacy HP bars + combat log; largely superseded by InRunTopBar |
| `InRunTopBar.svelte` | Landscape/Portrait HUD: HP bar, shield badge, gold, floor/segment, relic tray, fog level, pause. Inline player status effect icons (poison, burn, etc.) to the right of the HP bar — hover to show per-icon popup. `.hp-group` uses `flex: 1 0 auto` (never shrinks when icons are added). Icon size matches HP bar height (`var(--topbar-height) * 0.58`). `.topbar-status-sprite` and `.topbar-status-popup-sprite` use browser-default bilinear filtering (no `image-rendering` override). `.topbar-status-popup-sprite` is `28px` (scaled). Status popup is per-wrapper positioned below each icon on hover; backdrop click pattern removed. `.section-left` uses `max-width: 35%`. Accepts optional `statusEffects` prop (from `topBarPlayerEffects` derived in CardApp.svelte). **Fog gauge:** `getAuraLevel()` returns 0-10. The gauge maps this to a -5..+5 display range via `{@const displayFl = fl - 5}` — negative = flow (green, fills left), positive = fog (red, fills right), zero = neutral (2026-04-01 fix). **Button sizing (2026-04-04 fix):** `.pause-btn` height is `var(--topbar-height) * 0.7` (reduced from 0.85) so it fits within the topbar with centering margin and no viewport clip; `max-height: 100%` removed (was ineffective). `.relics-row` has `max-height: 100%` to prevent relic buttons from exceeding container height. |
| `MusicWidget.svelte` | Ultra-sleek Spotify-style BGM player widget. Single expanding container: collapsed pill (~56×36px, top-right, `position: fixed`, z-index 201) expands to a 240px glass panel — not two separate elements. Collapsed shows a 6-bar spectrogram canvas (48×32) built from AnalyserNode frequency bins. Expanded shows: wider spectrogram, track title + marquee overflow, **EPIC / LO-FI** category toggle (renamed from "QUIET"), prev/play-pause/next controls, volume slider with mute toggle. Volume and mute synced with `cardAudioManager` `musicVolume`/`musicEnabled` stores (single source of truth, not internal widget state). rAF animation loop driven by `musicService.getFrequencyData()` — idle sine wave when not playing. Glass morphism: `backdrop-filter: blur(20px)`, `rgba(8, 10, 18, 0.4)` background. All sizing uses `clamp()` units (viewport-clamped). Expand/collapse via CSS `max-height` + `opacity` transition. Closes on outside click. Rendered in `CardApp.svelte` alongside `InRunTopBar` whenever `showTopBar` is true. `musicService.startIfNotPlaying()` auto-fires on entering any `IN_RUN_SCREENS`. |
| `ChainCounter.svelte` | Animated chain streak badge. **AR-310:** Always-visible active chain color bar (`.active-chain-bar`) when `activeChainColor` prop is provided — shows colored dot + chain name at chain length 0 ("Play to chain!" hint), upgrades to show multiplier when chain >= 1. Existing slam-animation chain display (`.chain-display`) still shown at chain length >= 2. `.active-chain-bar` uses `z-index: 50` so it appears above the card hand strip. `.chain-display` remains at `z-index: 18`. Props: `isPerfectTurn`, `chainLength`, `chainType`, `chainMultiplier`, `activeChainColor: number | null`. |
| `ChainIcon.svelte` | Single chain-type icon pip used in ChainCounter and card frames |
| `DamageNumber.svelte` | Floating combat numbers (damage, block, heal, poison, burn, bleed, gold, crit) |
| `StatusEffectBar.svelte` | Row of active status effect icons + counts during combat. Enemy bar positioned at `14vh` (portrait) / `18vh` (landscape override via ). Player StatusEffectBar removed — player effects now inline in InRunTopBar. Icon `.effect-icon` container is `50px` (scaled). `.effect-sprite-icon` is `40px` (scaled); `.popup-sprite-icon` is `30px` (scaled). Both sprite icons use browser-default bilinear filtering (no `image-rendering` override) — avoids aliasing artifacts when downscaling 256px source art to small display sizes. Stack badge (`.effect-stack`) shows for `value >= 1` (not `> 1`), sized 20×20px. Turn counter (`.effect-turns`) font 12px, color `#e2e8f0`, with text-shadow. `brain_fog` and `flow_state` desc functions show context-aware text based on fog level thresholds: ≤2 = Flow State active, 3-6 = Neutral, ≥7 = Brain Fog active. |
| `PassiveEffectBar.svelte` | Persistent passive effects active on player or enemy. `.passive-icon-img` is `18px` (scaled); uses browser-default bilinear filtering (no `image-rendering` override). All sizing (top, left, gap, padding, border-radius, min-width) uses `calc(Npx * var(--layout-scale, 1))` — fully responsive. |
| `EnemyPowerBadges.svelte` | Badges showing elite/boss modifier tags on an enemy. `.badge-icon` is `60px` (scaled); uses browser-default bilinear filtering (no `image-rendering` override). |
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

FSRS tier classes (`tier-2a`, `tier-2b`, `tier-3`) and all tier-up animations/overlays were removed 2026-04-03. FSRS knowledge tiers have zero visual impact on cards. The in-run mastery level system (L0–L5, controlled by `hasMasteryGlow()` and `getMasteryIconFilter()`) is the only visual power indicator on cards. The `card.tier` field still exists and affects quiz difficulty — it is just not used for any visual styling.

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

The six `.card-impact-attack/shield/buff/debuff/wild` sub-classes and their `@keyframes` were removed 2026-03-31 — the base `.card-impact` handles all variants. Reduced-motion disables all four animations via `animation: none !important`. **Tier-up animation phase** (`.card-tier-up`, `.tier-up-overlay`, `@keyframes tierUpBluePulse/tierUpGreenSparkle/tierUpMasteryBurst`) and related props (`tierUpTransitions`) were removed 2026-04-03.

---

## Quiz & Study

| Component | Purpose |
|-----------|---------|
| `QuizOverlay.svelte` | Multiple-choice quiz modal for card activation; Gaia avatar, 3 distractors, timer. **Landscape two-zone layout (2026-04-03):** see section below. **Grammar fill-blank (2026-04-04):** `isGrammarFillBlank` branch exists in both landscape (~line 571) and portrait (~line 769); uses `GrammarSentenceFurigana` for each segment, rendering furigana and hover tooltips. **Cogwheel (2026-04-04):** `.quiz-options-cogwheel` — `top: 4px` (was 8px), `right: 8px` (was 12px), `font-size: 28px` (was 22px), `color: rgba(255,255,255,0.6)` (was 0.35), `background: rgba(255,255,255,0.06)` (was transparent). **Always-Write typing mode (2026-04-04):** `alwaysWriteEnabled` reads `$deckOptions[fact.language]?.alwaysWrite`; `useTypingMode = alwaysWriteEnabled && isGrammarFillBlank`. When `useTypingMode` is true, a `GrammarTypingInput` block renders in Zone B (landscape) and the portrait answer area instead of multiple-choice buttons — hidden once `showResult` is true. Correct submit calls `handleAnswer(fact.correctAnswer)`; wrong submit calls `handleAnswer` with any other choice. Uses `fact.acceptableAnswers ?? []` for alternatives. Styled by `.typing-mode-container` (padding `8px`, flex center). |
| `ChallengeQuizOverlay.svelte` | Challenge-mode quiz (speed round, mastery) with configurable ChallengeMode |
| `StudyQuizOverlay.svelte` | Rest-room study quiz: boss-quiz–style questions to upgrade card charges. Shows inline `SRS +` / `SRS -` indicator (green/red, 0.65 opacity, scaled `10px`) alongside correct/wrong feedback text. |
| `MasteryChallengeOverlay.svelte` | Mastery challenge room: timed quiz sequence for card mastery rewards. Calls `ambientAudio.setContext('mastery_challenge')` on `$effect` when challenge is set |
| `ScholarQuizPanel.svelte` | Scholar-challenge run quiz panel with extended question formats |
| `EventQuiz.svelte` | Quiz embedded inside mystery/special events for branching outcomes. Choice buttons have `data-testid="quiz-answer-{i}"` (0-indexed) for automated testing — matches pattern used in `QuizOverlay.svelte`. **Fact source (2026-04-07):** `buildQuestions()` handles three deck modes: `study` (calls `selectNonCombatStudyQuestion`), `playlist` (calls `selectNonCombatPlaylistQuestion` with `run.factSourceDeckMap`), and all other modes fall through to the trivia DB. Before the playlist branch was added, playlist runs fell through to the trivia DB fallback, showing unrelated facts instead of playlist deck facts. |
| `GrammarTypingInput.svelte` | Free-text typing input for grammar deck tilde-fragment answers |
| `WordHover.svelte` | Hoverable word revealing dictionary definition on hover/tap |
| `GrammarSentenceFurigana.svelte` | Renders a Japanese grammar sentence segment with furigana ruby annotations, kana-only mode, and WordHover-style tooltips. Used in grammar fill-in-the-blank questions in `QuizOverlay.svelte` (both landscape and portrait) and `CardExpanded.svelte`. Props: `sentence: string`, `excludeWords?: string[]`. Tokenizes via `tokenizeWithGloss()` on mount; shows plain text fallback until tokenizer loads. Reads `$deckOptions.ja.furigana` / `.kanaOnly` reactively. Non-hoverable tokens with kanji also show furigana ruby annotations. |
| `ProceduralStudyScreen.svelte` | Full-screen procedural math practice session. Calls `startProceduralSession` on mount, generates questions via `getNextQuestion`, grades with `gradeProceduralAnswer`. Shows running accuracy stats (questions answered, accuracy %). Answer buttons go green/red on feedback with a 1.2s delay before next question. "Stop" button returns to `studyTemple`. Tier badge shows current skill difficulty (Learning/Familiar/Advanced/Mastered). Uses same CSS scaling conventions as other screens. Props: `deckId: string`, `subDeckId?: string`, `onBack: () => void`. |
| `StudySession.svelte` | Standalone study session for the Study Temple screen. After player taps a rating button, shows a floating `SRS +` (green) or `SRS -` (red) label above the rating buttons for the 300ms pause before advancing. State: `srsIndicator: '+' | '-' | null`. |
| `StudyStation.svelte` | Quick-review widget inside the Hub |
| `StudyModeSelector.svelte` | Toggle between multiple-choice / typing / flashcard modes |
| `FactReveal.svelte` | Animates the reveal of a new fact after answering correctly |
| `FactArtwork.svelte` | Displays the artwork image associated with a knowledge fact card |
### QuizOverlay Landscape Two-Zone Layout

**Refactored 2026-04-03.** The landscape quiz overlay uses a space-filling two-zone flex column anchored dynamically between the fog meter and card hand.

**Stage anchoring via ResizeObserver:**
- A `ResizeObserver` on `.card-app` fires on every resize and sets `--quiz-stage-top` / `--quiz-stage-bottom` CSS custom properties on the stage element.
- `--quiz-stage-top` = bottom of `.fog-wing-wrapper` (falls back to `.topbar` bottom).
- `--quiz-stage-bottom` = `window.innerHeight - .card-hand-landscape.top`.
- `.quiz-landscape-stage` uses `top: var(--quiz-stage-top, 0)` / `bottom: var(--quiz-stage-bottom, 0)` to fill exactly the space between HUD and card hand.

**Panel layout (`container-type: inline-size; container-name: quiz-panel`):**
- `.quiz-landscape-stage` uses `align-items: stretch` so the panel fills stage height (not centers to content size).
- `.quiz-landscape-panel` is a flex column with `height: calc(100% - calc(16px * var(--layout-scale, 1)))` and `margin: calc(8px * var(--layout-scale, 1)) 0` — fills the stage minus 8px breathing room top/bottom.
- `max-height: 95%` removed (was only a cap; replaced with explicit height fill).
- `max-width` redundant property removed; `width: min(50vw, calc(640px * var(--layout-scale, 1)))` is the single size constraint.
- Close button and cogwheel are `position: absolute` outside both zones.
- `gap` reduced to `6px` (was `8px`) and `padding` to `8px 12px` (was `10px 14px`).

**Zone A — `.quiz-zone-question`** (`flex: 1 1 auto; overflow-y: auto; min-height: 0; align-items: flex-start`):
- `align-items` changed from `center` to `flex-start` so question content aligns left for readability.
- Contains: category label, mode headers (gate/artifact/layer/random), fact artwork, question image, question text, attempts counter.
- Scrollable when content overflows. `.has-overflow::after` adds a sticky gradient fade at the bottom.
- `.quiz-category-label`: flush left, 11px, uppercase, `rgba(255,255,255,0.45)` — shows `fact.categoryL2` or `fact.category[0]`. **Emoji characters stripped** via `/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu` regex before display.
- **Image expand toggle:** Question images are wrapped in `button.quiz-image-toggle`. Clicking toggles `imageExpanded` state. Expanded uses `max-height: var(--image-max-expanded)` computed by the ResizeObserver as `max(100, zoneH - questionH - 40)px`. Resets to `false` on every fact/mode change.
- **Container queries** override question font sizes inside `.quiz-landscape-panel`:
  - `.quiz-text-short` (len < 60): `clamp(18px, 4cqi, 24px)`
  - `.quiz-text-medium` (len < 120): `clamp(15px, 3.2cqi, 20px)`
  - `.quiz-text-long` (len >= 120): `clamp(12px, 2.5cqi, 16px)`
- `questionLengthClass` thresholds updated: short < 60 (was < 30), medium < 120 (was < 80).
- `zoneAOverflows` boolean drives `has-overflow` class for the scroll indicator.

**Zone B — `.quiz-zone-answers`** (`flex: 0 0 auto; max-height: 55%; overflow-y: auto`):
- Contains: answer buttons, dev-skip, result text, GAIA reaction, memory tip, continue button, report button.
- A 1px `::before` pseudo-element separator divides zones visually.
- **`answerSizeClass`** CSS class derived from `choices.length`:
  - `answer-spacious` (2 or fewer): `padding: 12px 16px`
  - `''` (3–4 choices): default `padding: 8px 14px`
  - `answer-compact` (5 or more): `padding: 6px 12px`, smaller font
- Button `font-size`: `clamp(12px, 1.5vw, 16px)` (compact: `clamp(11px, 1.3vw, 14px)`).
- `min-height: unset` overrides the base `52px` min-height for landscape buttons.
- `align-self: start` prevents grid items from stretching to fill implicit row height.
- `border-radius: calc(12px * var(--layout-scale, 1))` overrides base `999px` pill — compact rounded rect for landscape.
- Focus ring: `outline: 2px solid #60a5fa` + box-shadow spread.

**New JS state (landscape-specific):**

| State | Type | Description |
|-------|------|-------------|
| `imageExpanded` | `$state(false)` | Whether question image is expanded inline |
| `zoneAOverflows` | `$state(false)` | Whether Zone A has scrollable overflow |
| `zoneAEl` | `$state(null)` | DOM ref for Zone A (bind:this) |
| `stageEl` | `$state(null)` | DOM ref for the stage container (bind:this) |
| `answerSizeClass` | `$derived` | CSS class string based on `choices.length` |

**Portrait mode unchanged** — lines 575+ in the template are not modified.


---

## Hub & Navigation

| Component | Purpose |
|-----------|---------|
| `HubScreen.svelte` | Main hub: campfire, NPC sprites, run summary, navigation entry points. Calls `ambientAudio.setContext('hub')` on initial `$effect`. Integrates hub lighting engine, glow canvas, fireflies, moths, custom cursor light, per-sprite brightness with mouse proximity bonus, and background warmth filter. Tracks mouse via `onpointermove`/`onpointerleave`; hides system cursor with `style:cursor="none"` when effects are enabled. Child interactive elements use `cursor: inherit` (not `cursor: pointer`) so the hub cursor:none propagates correctly. **Z-index layering (landscape)**: `.camp-bg-wide` z-0, HubGlowCanvas glow-canvas z-1 / vignette z-2, `.hub-center` z-3 (raised from z-1 on 2026-04-01 so all sprites and HUD inside hub-center paint above the vignette overlay; background image at z-0 still gets darkened by vignette). **Props (2026-04-06 addition):** `onOpenMultiplayer: () => void` — new required prop added after `onOpenSocial`; triggers `handleOpenMultiplayer()` in CardApp which creates a lobby and navigates to `multiplayerLobby`. A `.multiplayer-hub-btn` is positioned bottom-left (`position: absolute`, z-45) in both landscape (fixed, 20px from bottom-left) and portrait (12px from bottom-left) hub layouts. Styling uses glass morphism (`backdrop-filter: blur(8px)`, purple-tinted background) matching the hub aesthetic. |
| `HubNavBar.svelte` | Bottom navigation bar (Library, Profile, Social, Leaderboards) |
| `KnowledgeLibrary.svelte` | Full-screen knowledge fact browser (screen: `library`). Props: `onback: () => void`. **Layout (2026-04-06 rewrite):** sidebar + header + main content — identical structure to StudyTempleScreen. Header bar: back arrow, LIBRARY title (purple, Cinzel uppercase), search input (flex:1, max-width 400px), Tier select, Sort select, mastery badge at far right. Sidebar: collapsible (200px → 36px) with breathe-gold animation on toggle arrow when collapsed; categories built from `domainSummaries.filter(s => s.totalFacts > 0)` — All tab (null) plus one entry per domain. Active tab has `border-left-color: #818cf8` and `rgba(99,102,241,0.08)` background. Main content: subcategory chips bar (only visible when a specific domain is active and `domainSubcategories.length > 1`); lore unlock banner + lore grid (only in All tab); fact count summary; scrollable fact grid (`repeat(auto-fill, minmax(300px, 1fr))`); scroll-fade gradient overlay. **State:** `activeTab: FactDomain | null` (null = All), `selectedEntry`, `selectedSubcategory`, `tierFilter`, `sortBy`, `searchQuery`, `sidebarCollapsed`. **Derived:** `allDomainEntries` — when `activeTab` is null, combines `buildDomainEntries()` across all non-empty domains; when a domain is active, calls `buildDomainEntries()` for that domain with tier/sort/subcategory filters. `filteredDomainEntries` applies `searchQuery` on top. **Detail view:** clicking a fact row sets `selectedEntry`; detail card renders in main content area with back button, statement title, domain subtitle, 2-col stats grid (attempts/correct/avgRT/stability/difficulty/nextReview), question variants list, tier history. **Escape key:** closes detail then exits library. Background: `linear-gradient(160deg, #0a0e1a 0%, #1a1035 50%, #0a0e1a 100%)`. z-index: 260. All sizing uses `calc(Npx * var(--layout-scale, 1))` / `calc(Npx * var(--text-scale, 1))` — zero hardcoded px. Removed all landscape/portrait class overrides and `:global([data-layout])` rules. |
| `HubVisitorView.svelte` | Visitor profile view when browsing another player's hub |
| `CampHudOverlay.svelte` | HUD overlay on the hub: streak, gold, XP progress bar |
| `CampSpriteButton.svelte` | Clickable NPC sprite button in the hub scene. Props: `spriteOffsetX`/`spriteOffsetY` for CSS translate repositioning; `brightness` (default 1.0) for campfire lighting via `--sprite-brightness` CSS custom property. `fireShadow` prop removed 2026-04-01 (full-frame sprites caused alpha-channel blob halos). `.sprite-hitbox` uses `cursor: inherit` (updated 2026-04-01, was `cursor: pointer`) so the hub `cursor: none` is not overridden by child buttons — the custom glow cursor IS the hover feedback when effects are active. See "Hub Lighting" section below. |
| `CampSpeechBubble.svelte` | Speech bubble overlay for hub NPC characters |
| `AnimatedPet.svelte` | Canvas-based animated hub pet. Renders 64×64 px horizontal spritesheet strips for 6 `PetBehavior` states (`idle`, `walk`, `sit`, `lick`, `sleep`, `react`) driven by the `petBehavior.ts` state machine and the shared 30fps `hubAnimationLoop`. Position follows `petState.position` (% of `.hub-center` container). Walk bob: sine-wave vertical offset `sin(now * 0.006) * 2` px during walk. Flip: `facingLeft` passed as `flipX` to `drawSpritesheetFrame`. Props: `species?: PetSpecies` (default `'cat'`), `disableEffects?: boolean` (reduces to static frame 0 at campfire, no loop), `onclick?: () => void`. Click triggers `triggerReact()` then the callback. Minimum tap target 44×44px hitbox button overlay. Graceful degradation: if a behavior spritesheet fails to load, that behavior renders nothing. z-index 35. CSS size `calc(64px * var(--layout-scale, 1))`. **NOT mounted in HubScreen (2026-04-04):** pet is rendered as a standard `CampSpriteButton` (tier sprites from `pet/tier-{N}.webp`, hitTop 69% / hitLeft 60% / hitWidth 11% / hitHeight 6%, zIndex 35, `petBright` lighting, preloaded in `_campImagesToPreload`). `AnimatedPet.svelte` and `petBehavior.ts` are retained for potential future reuse. |
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
| `DeckSelectionHub.svelte` | Run-start hub: choose Trivia Dungeon vs. Study Temple. **3D parallax panels:** both panels use `transform-style: preserve-3d` with `--rot-x`/`--rot-y` CSS vars driven by RAF-throttled `makePointerHandlers()` factory (`rotY = (x-0.5)*24`, `rotX = (0.5-y)*24`). Each panel has a `.parallax-wrap` containing a `.plx-layer` image (`/assets/sprites/deckfronts/trivia_dungeon.webp` and `study_temple.webp`) that shifts `(pointer - center) * -0.08%` against pointer and scales 1.08; rendered only when the webp resolves (runtime `Image.onload` check). **Smoke system:** 12 background wisps (`.smoke-container`, z-index 1) + 5 foreground wisps (`.smoke-foreground`, z-index 3) — each is a blurred radial-gradient ellipse (`500px` bg / `350px` fg) animating with `smoke-rise` (vertical drift, 8–14s cycle) and `wind-gust` (periodic lateral shove via `margin-left`, 5–10s). Each wisp has individual `--duration`, `--delay`, `--sway`, `--peak-opacity`, `--gust-duration`, `--gust-delay`, `--gust-shift` CSS vars. **Ground fog:** `.ground-fog` persistent 45%-height layer at bottom (z-index 1) with 3 layered gradients on element + `::before` + `::after`, each drifting independently via `fog-drift` and `fog-sway` keyframes; blurred 15px. **Text overlay:** `.panel-text-overlay` at `translateZ(40px)` with dark `radial-gradient` scrim (`::before`, rgba 0,0,0 0.75→transparent). **Text sizes (all scaled):** title 32px, subtitle 18px, tagline 16px, stats 13px. All text has heavy `text-shadow` 4-direction stroke (2px black). Shine overlay (`radial-gradient` at `--shine-x`/`--shine-y`, opacity 0→1 on hover, z-index 10). Icons removed. Touch devices skip 3D math (`hover: none` detection). All dimensions use `calc(Npx * var(--layout-scale, 1))` / `calc(Npx * var(--text-scale, 1))`. **Reduced-motion:** panel transitions disabled, shine hidden, smoke wisps hidden, ground fog animations stopped. |
| `StudyTempleScreen.svelte` | Full-screen deck library (THE LIBRARY). **Layout:** header (single row, `flex-wrap: nowrap`) + horizontal body split: collapsible left sidebar + right main content. Sidebar (`.sidebar`, default `200px` wide, `calc(200px * var(--layout-scale,1))`) lists categories vertically via `.sidebar-item` buttons; collapses to `36px` when `sidebarCollapsed` is true (toggle arrow button at top). Category data comes from the `categoryList` derived (built from `getDomainMetadata` — `null` id = All tab); also shows a "My Decks" entry (id `'personal'`) when any deck with `domain === 'personal'` exists. Active item gets indigo-tinted background + `3px` left border in `#818cf8`. Main content (`.main-content`, `flex:1`) contains deck-summary + `.deck-scroll` + `.scroll-fade`. **Header:** `[← Back] [THE LIBRARY] [search/sort/filter] [Import Anki]`, `flex-wrap: nowrap`, `flex-shrink: 0`. **Import Anki button** (`.anki-import-btn`, purple tint, `12px` font, `6×12px` padding) triggers `showAnkiImport` state, mounting `AnkiImportWizard`. On `onimport` callback, calls `registerPersonalDecks()`, switches `activeTab` to `'personal'`, increments `dealKey`. **Export:** `DeckDetailModal` receives `onExportAnki={handleExportDeck}` prop; clicking "Export to Anki" in the modal sets `showAnkiExport` state, mounting `AnkiExportWizard`. `registerPersonalDecks()` also called in `onMount` to register any previously saved personal decks on screen load. **No `CategoryTabs` component** — replaced by sidebar. `getDomainMetadata` imported from `../../data/domainMetadata`. All sizing: `calc(Npx * var(--layout-scale,1))` / `calc(Npx * var(--text-scale,1))`. **Playlist run support (2026-04-07):** `onStartRun` prop accepts a third union member `{ mode: 'playlist'; items: PlaylistDeckItem[] }` (imported from `../../data/studyPreset`). `handleStartCustomRun()` filters playlist items to `type === 'study'`: if 1 item, emits `mode: 'study'` (backward compat); if 2+ items, emits `mode: 'playlist'` with merged `PlaylistDeckItem[]`. |
| `DeckBuilder.svelte` | Full deck-builder: browse, filter, and manage curated deck cards |
| `CardBrowser.svelte` | Card collection browser with filtering and sorting in the Library |
| `CardExpanded.svelte` | Full-screen expanded card view with all details and fact text. **Always-Write typing mode (2026-04-04):** `alwaysWriteEnabled` reads `$deckOptions[quizLanguageCode ?? '']?.alwaysWrite`; `effectiveResponseMode = alwaysWriteEnabled || quizResponseMode === 'typing' ? 'typing' : 'choice'`. The `GrammarTypingInput` block at ~line 572 now checks `effectiveResponseMode === 'typing'` instead of `quizResponseMode === 'typing'` directly, so the toggle activates typing mode even when `quizResponseMode` is `'choice'`. |
| `CardPickerOverlay.svelte` | Pick a specific card from the deck (e.g., transmute target) |
| `DeckTileV2.svelte` | Tile component for a curated deck in the selection grid. 3D tilt on hover, shine overlay, deal animation. Single-image CSS parallax when `/assets/sprites/deckfronts/{id}.webp` is found (single image shifts against pointer, 0.08% multiplier, scale 1.08). When `hasImage` is true, adds `.has-image` class: title uses `position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%) translateZ(40px)` (bottom-center of art area, floating in 3D space), and badges float at `translateZ(30px)`. **Procedural deck support:** when `deck.procedural` is true, shows a single skill count bar ("X skills") instead of Seen/Review/Mastered progress bars, with a "Practice to track progress" hint. Description auto-falls back to "X skills" instead of "X facts" for procedural decks. |
| `DeckDetailModal.svelte` | Two-column modal (900px wide) for deck details. **Left column** (scrollable): deck name, description, overall progress bar, Study Focus sub-deck radio list, exam tag filter chips. **Right column** (fixed, vertically centered): total facts / mastered stat block, Launch Expedition button (curated), Add to Custom Deck button, optional Export to Anki button. **Props:** `deck`, `progress`, `onStartRun`, `onClose`, `onAddToCustom?`, `onExportAnki?: (deckId: string, deckName: string) => void` (new 2026-04-05). When `onExportAnki` is provided, renders an `.export-anki-btn` (purple tint, `12px` font, full-width `36px` height) below the Add to Custom Deck button — clicking it calls `onExportAnki(deck.id, deck.name)`. Banner icon and gradient removed. Close button is yellow (`#eab308`), no background circle. All sizing uses `calc(Npx * var(--layout-scale, 1))`. **Procedural deck support:** progress shows "X skills", start button reads ">> START PRACTICE". |
| `AnkiImportWizard.svelte` | 4-step modal wizard for importing Anki .apkg files into the game as personal decks. **Props:** `onclose: () => void`, `onimport: (result: { deckId: string; deckName: string }) => void`. **Step 1 — Upload:** drag-and-drop zone with dashed purple border; click-to-browse via hidden file input; validates `.apkg` extension and 50 MB size limit; shows file name + size after selection. **Step 2 — Preview:** stat cards (total cards / notes / note types), scheduling badge ("Has scheduling data" / "New cards only"), model field chips per note type, first 5 notes preview with field labels. **Step 3 — Configure:** deck name input (pre-filled from Anki deck name), question/answer field dropdowns (populated from model fields, default Front/Back), "Import scheduling data (FSRS stats)" checkbox (disabled if no scheduling data exists), "Use multiple choice mode" checkbox. **Step 4 — Progress:** animated progress bar 0→100% with gradient fill (purple→amber), success icon + card count + Done button on completion. Uses `import type { AnkiImportData }` from `../../services/ankiService`. Dynamically imports `parseApkg`, `ankiToPersonalDeck` at call time; `savePersonalDeck`, `registerPersonalDecks`, `mergeReviewStates` from `personalDeckStore`. **Step indicator:** 4 dots connected by line connectors — completed steps purple, active step amber glow. Modal: 640px wide (scaled), max-height 85vh, z-index 400, fade-in backdrop. |
| `AnkiExportWizard.svelte` | Single-screen modal for exporting any deck (curated or personal) to Anki `.apkg` format. **Props:** `deckId: string`, `deckName: string`, `onclose: () => void`. Deck name shown in purple info banner at top. **Options:** "Include review progress (FSRS stats)" — checked by default, exports `reviewStates` matching the deck's fact IDs from `playerSave`; "Include only due/overdue cards" — unchecked by default, filters to facts whose `due` date is in the past. **Export flow:** fetches facts via `getCuratedDeckFacts(deckId)` (curatedDeckStore) with fallback to `getPersonalDeckData(deckId).facts` (personalDeckStore); calls `createApkg({ deckName, facts, reviewStates })` from `ankiService`; triggers browser download via `URL.createObjectURL(blob)`. Shows spinner during generation; green success banner ("Download started — N cards exported") after completion. "Export Again" button remains visible for re-export. Modal: 480px wide (scaled), z-index 400. |
| `DeckFilterChips.svelte` | **REMOVED** — replaced by `DeckFilterSegmented.svelte` |
| `DeckFilterSegmented.svelte` | Connected segmented control for filtering decks by progress state (`all` / `in-progress` / `not-started` / `mastered`). Props: `activeFilter: FilterOption`, `onFilterChange: (filter: FilterOption) => void`. Active segment styled with indigo tint (`rgba(99,102,241,0.2)` background, `#c7d2fe` text). All sizing uses `calc(Npx * var(--layout-scale, 1))` / `calc(Npx * var(--text-scale, 1))`. |
| `DeckSearchBar.svelte` | Search bar for the deck browser. Props: `placeholder?`, `value`, `onsearchchange`. Height `32px`, border-radius `6px` (unified header-control size). Border `1px solid rgba(255,255,255,0.12)`; indigo focus ring. Debounces input at 150ms. All sizing uses `calc(Npx * var(--layout-scale, 1))`. |
| `DeckSortDropdown.svelte` | Sort order dropdown for deck listing views. Props: `value: SortOption`, `onsortchange`. Options: `alpha`, `progress-high`, `progress-low`, `facts`, `newest`. Height `32px`, border-radius `6px`, border `1px solid rgba(255,255,255,0.08)` (subdued vs search bar). Custom arrow via `::after` pseudo-element. All sizing uses `calc(Npx * var(--layout-scale, 1))`. |
| `CategoryLockSelector.svelte` | UI for locking/unlocking fact categories within a deck |
| `CategoryTabs.svelte` | Tab bar for switching between deck domains/categories. Renders label + count per tab — no icons. `.category-tabs` uses `flex-wrap: nowrap` with a right-fade mask (`mask-image: linear-gradient(to right, black 85%, transparent)`) and no background or bottom border. Active tab indicated solely by a `::after` bottom border in the tab's `--tab-color`. Hover and active states have `background: transparent` — no fill on interaction. `.tab-count` uses `opacity: 0.5` (inactive) and `opacity: 0.7` (active) instead of color values. |
| `SubcategoryChip.svelte` | Individual subcategory filter chip |
| `DuplicateMixingModal.svelte` | Warning/options modal when mixing duplicate facts across decks |
| `LoadoutCard.svelte` | Compact card tile used in loadout/preset displays |
| `PlaylistBar.svelte` | Horizontal bar showing the active custom deck (formerly called "playlist"). Fallback name shows "Custom Deck" when no named playlist exists. |
| `PlaylistPickerPopup.svelte` | Popup for adding a deck to a custom deck (formerly "playlist"). Input placeholder reads "Custom deck name...", aria-labels updated to match. |
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
| `RelicTray.svelte` | Horizontal relic tray with triggered-relic highlight. `.relic-slot` container is `40px` (scaled); `.relic-icon` is `32px` (scaled). Uses `image-rendering: auto` (bilinear filtering). |
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
