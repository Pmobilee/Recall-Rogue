# UI Component Catalog

> **Purpose:** Gameplay-critical Svelte components: Combat UI, Quiz & Study, Hub & Navigation, Dungeon & Map, Card Management, Rooms & Events, Rewards & Progression, Relics.
> **Last verified:** 2026-04-11
> **Source files:** `src/ui/components/**/*.svelte` (195 files), `src/CardApp.svelte`, `src/ui/effects/hubAnimationLoop.ts`, `src/ui/effects/hubLightingState.ts`, `src/ui/effects/HubGlowEffect.ts`, `src/ui/effects/CampfireEffect.ts`, `src/ui/effects/spritesheetPlayer.ts`, `src/ui/effects/petBehavior.ts`

> **See also:** [`components-social.md`](components-social.md) — Social & Multiplayer, Profile & Account, Auth & Legal, Monetization & Seasons, Onboarding & Cutscenes, Utility & Effects.

---

## Combat UI

| Component | Purpose |
|-----------|---------|
| `CardHand.svelte` | Renders the player's hand with V2 card frames, art, mastery glow, chain color groups, and damage-modifier coloring (green=buffed, red=nerfed via `damagePreviews` prop). **AR-310:** Accepts `activeChainColor?: number | null` prop — cards matching the active chain type get a `drop-shadow` glow in the chain color, a `.card--active-chain` class (no outline; kept for glow via inline style), and a `pill-chain-active` class on the chain color pill div which triggers a `chainPillPulse` keyframe animation (1.5s, scale 1→1.35 with box-shadow in chain color). Glow/pulse suppressed while dragging, while the card is selected, or while any other card is selected. The `.charge-play-btn-landscape` button has `z-index: 30` so it renders above selected cards (`z-index: 25`) and is always tappable. **Accessibility (2026-04-06):** Both landscape (line 847) and portrait (line 1195) card button `aria-label` attributes now call `getShortCardDescription(card, getEffectValue(card))` — passing the mastery-adjusted runtime value from `getMasteryStats()` as `powerOverride`, so screen readers announce the correct damage/block value instead of the stale `card.baseEffectValue`. **Description line-break rendering (2026-04-08):** description parts are processed through `groupIntoLines()` before iteration in both landscape and portrait blocks; when `cardDescriptionService` emits `\n` in a text part the clauses break onto separate `<div class="desc-line">` elements. `.desc-line { display: block; width: 100%; }` added to CSS. **V2 frame refactor (2026-04-09):** All v2 card frame rendering extracted to `CardVisual.svelte` — CardHand no longer contains the frame template or CSS. Each card slot in CardHand renders `<CardVisual {card} effectValue={effectVal} {isChargePreview} {isBtnChargePreview} {modState} masteryFlash={...} {displayedApCost} {apGemColor} chainPillActive={...} />`. Animating (fly-out) instances use `<CardVisual {card} />` with no special props. Cross-boundary interaction styles use `:global()`: `.card-in-hand.insufficient-ap :global(.v2-ap-cost)` for red AP pulse, `:global(.card-selected .card-v2-frame)` for pointer-events none on selected card. |
| `CardVisual.svelte` | **Shared card frame renderer (2026-04-09).** Pure display-only component — no interaction, no drag, no state machine. Single source of truth for the V2 layered card frame used by both `CardHand.svelte` and `CardPickerOverlay.svelte`. **Props:** `card: Card`, `effectValue?: number`, `isChargePreview?: boolean`, `isBtnChargePreview?: boolean`, `modState?: 'buffed' | 'nerfed' | 'neutral' | null`, `masteryFlash?: 'up' | 'down' | null`, `displayedApCost?: string | number`, `apGemColor?: string | null`, `showMasteryGlow?: boolean`, `chainPillActive?: boolean`. **Renders:** 4-layer image stack (border + card art + base frame + chain banner), `.v2-mechanic-name` (with `use:stretchText`), `.v2-card-type` chain pill, `.v2-effect-text` parchment block (description parts rendered via `getCardDescriptionParts()` + `groupIntoLines()`), `.v2-ap-cost` gem. **CSS ownership:** ALL v2 card frame CSS lives here — callers must not duplicate it. `CardHand.svelte` uses `:global(.v2-ap-cost)` and `:global(.card-v2-frame)` only for cross-boundary interaction states (insufficient AP coloring, pointer-events on selected cards). **`--card-w` CSS variable** must be set on the wrapper by the caller. `CardPickerOverlay` sets it via inline style matching `CardHand.landscapeCardW` formula: `(35vh * 0.88) / 1.42`; `CardHand` sets it per card slot based on the same formula. **Draw animation:** `CardHand.svelte` detects newly added card IDs via an internal `$effect` (comparing current vs previous hand state using `untrack()` to avoid reactive loops) and applies a `.card-drawn-in` class that triggers a `cardDrawnIn` keyframe — cards fly in from above when added to hand (e.g. after picker pick). |
| `CardCombatOverlay.svelte` | Root combat screen: wraps CardHand + QuizOverlay, handles surge/boss phases, landscape/portrait. **Dev skip button:** When `import.meta.env.DEV` is true, a red `.dev-skip-btn` button is rendered in `CardApp.svelte` during the combat screen block, positioned fixed below the MusicWidget (top-right, `z-index: 201`). Clicking it calls `devForceEncounterVictory()` from `encounterBridge.ts` to immediately trigger a victory. Hidden in production builds via Vite tree-shaking. Computes `damagePreviews` via `damagePreviewService` and passes to CardHand. Derives `activeChainColor = turnState?.activeChainColor ?? null` and passes to both ChainCounter and CardHand (AR-310). Calls `ambientAudio.duck()` / `unduck()` via `$effect` reactive on `isQuizPanelVisible` — ducks ambient when charge quiz panel is showing. **AP display (2026-04-09 visual polish):** `.player-ap-right` is the sole AP display — the `.ap-label` "AP" span has been removed, leaving only `.ap-num`. Background upgraded to amber: `rgba(180, 100, 40, 0.85)` (portrait) / `rgba(208px, var(--layout-scale))` (landscape; shifted from `left: 148px` to `left: 208px` to give more clearance from End Turn). Active state: `rgba(220, 140, 60, 0.92)` with amber glow. `.ap-num` color: `#fff7e6`. **End Turn button (2026-04-09):** Background upgraded from `#854d0e` to `#b8860b` (brighter gold); pulse keyframe colors updated to `#b8860b`/`#c4960d`; portrait `right` offset bumped from `70px` to `90px` to match. **Enemy intent bubble (2026-04-09 damage formula fix):** `intentDetailText` and `intentDisplay` now show the actual runtime damage via `displayDmg(base, enemy)` — mirrors `enemyManager.executeEnemyIntent()` formula: `Math.round(base × strengthMod × floorScaling × GLOBAL_ENEMY_DAMAGE_MULTIPLIER)`. Imports added: `getFloorDamageScaling` from `enemyManager`, `GLOBAL_ENEMY_DAMAGE_MULTIPLIER` from `balance`. Attack intent copy changed from "Charging N damage next turn" to "Attacking for N damage" — the word "Charging" is now reserved for the `charge` intent type. Multi-attack: "Attacking for N × M hits". **Enemy intent bubble — HP damage after block (Issue 11, 2026-04-11):** `displayImpact(intent, enemy)` replaces the old `displayDmg(base, enemy)` helper. It calls `computeIntentHpImpact()` with `playerBlock = turnState.playerState.shield` and `act` derived from `currentFloor` (≤6 → Act 1, ≤12 → Act 2, 13+ → Act 3), returning `{ raw, postDecayBlock, hpDamage }`. Intent detail line shows: "Attacking for N HP damage" (no block), "N HP damage (raw − postDecayBlock block)" (partial block), or "Fully blocked (raw absorbed)" (fully blocked). Fully-blocked bubble gets `.intent-bubble-blocked` CSS class (muted slate text) and `data-intent-blocked="true"` attribute. `computeIntentDisplayDamage` import replaced with `computeIntentHpImpact, IntentHpImpact`. `EnemyIntent` type added to enemies import. **Co-op cancel (2026-04-09):** `.coop-waiting-banner` now has `pointer-events: auto` and contains a `.coop-cancel-btn` button — clicking it calls `cancelCoopTurnEnd()` from `multiplayerCoopSync` and sets `coopWaitingForPartner` to false, immediately unblocking the local turn-end wait. `.coop-waiting-banner` now uses `display: flex; align-items: center; gap: 8px` to keep text + button inline. `DamagePreviewContext` includes `playerStrengthModifier: getStrengthModifier(ps.statusEffects)` — damage previews show red/green when player has weakness/strength. **`onplaycard` signature (2026-04-04):** Last parameter `wasQuizzed?: boolean` added. **Wow-factor fixes (2026-04-08):** `showWowFactor` signature changed to `showWowFactor(answeredFactId: string, card: Card)` — takes the fact ID actually shown in the quiz instead of `card.factId`, fixing study-mode cases where the quizzed fact differs from the card base. Call site derives `answeredFactId = card.__studyFactId ?? card.factId`. Display duration doubled: timers changed from `turboDelay(5200)/5500` to `turboDelay(10200)/10500` (hold 5s → 10s). **Z-index layering (2026-04-09):** `.player-ap-right` uses `z-index: 26` in both portrait and landscape (raised from 6/20) — sits above `.quiz-backdrop` (25) so AP indicator stays fully visible at full brightness during quiz. `.end-turn-btn` uses `z-index: 26` in both portrait (raised from 5) and landscape (raised from 20) for the same reason. Both are covered by `CardExpanded.svelte` (`z-index: 30`) so the quiz window renders on top. The quiz backdrop (`z-index: 25`) dims everything below it including MultiplayerHUD and ChainCounter. |
| `CombatHUD.svelte` | Legacy HP bars + combat log; largely superseded by InRunTopBar |
| `InRunTopBar.svelte` | Landscape/Portrait HUD: HP bar, shield badge, gold, floor/segment, relic tray, fog level, pause. Inline player status effect icons (poison, burn, etc.) to the right of the HP bar — hover to show per-icon popup. `.hp-group` uses `flex: 1 0 auto` (never shrinks when icons are added). Icon size matches HP bar height (`var(--topbar-height) * 0.58`). `.topbar-status-icon` has `background: transparent` and no `border-radius` — icons sit free-floating against the topbar (no dark oval), with a single tight dark outline `drop-shadow(0 0 1px rgba(0,0,0,0.9))` for contrast (2026-04-09: replaced white double glow which washed out small icons). `.topbar-status-sprite` and `.topbar-status-popup-sprite` use browser-default bilinear filtering (no `image-rendering` override). `.topbar-status-popup-sprite` is `28px` (scaled). Status popup is per-wrapper positioned below each icon on hover; backdrop click pattern removed. `.section-left` uses `max-width: 35%`. Accepts optional `statusEffects` prop (from `topBarPlayerEffects` derived in CardApp.svelte). **Icon paths (2026-04-09):** Status icons that exist in `sprites-hires/` use those paths (poison, weakness, vulnerable, strength, regen, immunity) — sharper at small render sizes. burn and bleed remain on the lower-res path until hi-res assets are generated. **Badge consolidation (2026-04-09):** Two separate badges (`.topbar-status-stack` value > 1 at top-right, `.topbar-status-turns` always at bottom) collapsed into ONE `.topbar-status-stack` badge at bottom-right showing `value` whenever `value >= 1`. Turns remaining moved exclusively to the hover popup. Badge has dark border (`rgba(0,0,0,0.5)`) and text-shadow for readability against any icon. **Fog gauge:** `getAuraLevel()` returns 0-10. The gauge maps this to a -5..+5 display range via `{@const displayFl = fl - 5}` — negative = flow (green, fills left), positive = fog (red, fills right), zero = neutral (2026-04-01 fix). **Button sizing (2026-04-04 fix):** `.pause-btn` height is `var(--topbar-height) * 0.7` (reduced from 0.85) so it fits within the topbar with centering margin and no viewport clip; `max-height: 100%` removed (was ineffective). `.relics-row` has `max-height: 100%` to prevent relic buttons from exceeding container height. **2026-04-08 HUD fix (task 5.2):** `.relic-slot-wrapper` wrapper div removed — relic `<button>` and tooltip are now direct children of `.relics-row`. The tooltip `<div>` is a sibling of the button, not nested inside it. `.relics-row` has `position: relative` added to support tooltip absolute positioning. **Fog wing wrapper height (2026-04-10):** `.fog-wing-wrapper` now has explicit `height: calc(28px * var(--layout-scale, 1))` matching its `.fog-wing` child — prevents the hitbox from extending below the visual element (which would overlap the `MultiplayerHUD` below it). **2026-04-09 pill removal:** The `reviewQueueLength` prop and `{#if reviewQueueLength > 0}` pill block were removed — the review queue exists (used by `Recall` card and `Scholar's Crown` relic) but is no longer surfaced in the top bar UI. The `.review-queue-pill` CSS class has been deleted. |
| `MusicWidget.svelte` | Ultra-sleek Spotify-style BGM player widget. Single expanding container: collapsed pill (~56×36px, top-right, `position: fixed`, z-index 201) expands to a 240px glass panel — not two separate elements. Collapsed shows a 6-bar spectrogram canvas (48×32) built from AnalyserNode frequency bins. Expanded shows: wider spectrogram, track title + marquee overflow, **EPIC / LO-FI** category toggle, prev/play-pause/next controls, volume slider with mute toggle, ambient on/off toggle (`.ambient-row` with 'AMB' label + speaker SVG button; green when active, dim when off — synced with `ambientEnabled` store from `cardAudioManager`). The SHOP jukebox button has been removed — track purchases are now in the **Jukebox tab** of `CampUpgradeModal`. Volume and mute synced with `cardAudioManager` `musicVolume`/`musicEnabled` stores (single source of truth, not internal widget state). **Mute button (2026-04-10):** Calls `musicService.toggleMute()` — not `musicEnabled.update()` directly. `toggleMute()` calls `init()` first to ensure store subscriptions are active, then applies volume immediately to `currentAudio`. rAF animation loop driven by `musicService.getFrequencyData()` — idle sine wave when not playing. Glass morphism: `backdrop-filter: blur(20px)`, `rgba(8, 10, 18, 0.4)` background. All sizing uses `clamp()` units (viewport-clamped). Closes on outside click. Rendered in `CardApp.svelte` alongside `InRunTopBar` whenever `showTopBar` is true. `musicService.startIfNotPlaying()` auto-fires on entering any `IN_RUN_SCREENS`. |
| `ChainCounter.svelte` | Animated chain streak badge. **AR-310:** Always-visible active chain color bar (`.active-chain-bar`) is the **sole** chain UI element (2026-04-08 HUD fix — `.chain-display` removed). At chain length 0: shows colored dot + chain name + "Play to chain!" hint. At chain >= 1: shows multiplier in the active chain color. Multiplier color uses `activeChainColor` (the turn's chain type), NOT `chainType` (last played card) — task 7.1 fix. Tier escalation at chains 3/4/5: `.chain-tier-3/4/5` classes on `.active-chain-bar` animate the multiplier span. `.active-chain-bar` uses `z-index: 20` (below `.quiz-backdrop` at 25 — dims during quiz, re-emerges after). Props: `isPerfectTurn`, `chainLength`, `chainType`, `chainMultiplier`, `activeChainColor: number | null`. |
| `ChainIcon.svelte` | Single chain-type icon pip used in ChainCounter and card frames |
| `MultiplayerHUD.svelte` | Co-op/Race opponent progress HUD — fixed top-left panel, expands on click. **z-index: 9** (lowered from 20 on 2026-04-09 — safely below all quiz surfaces: `.quiz-backdrop` at 25, quiz panel at 30). Root element's `backdrop-filter: blur(8px)` previously created an implicit stacking context that caused the HUD to appear above the quiz despite the lower z-index; the new value of 9 plus the `quizVisible` prop together guarantee correct layering regardless of stacking context. **`quizVisible` prop (2026-04-09):** Optional `boolean` (default `false`), passed from `CardApp.svelte` via the `$quizPanelVisible` store (`src/ui/stores/combatUiStore.ts`). When `true`, applies `.quiz-hidden` class: `pointer-events: none; opacity: 0.25; filter: blur(1px); transition: opacity 150ms, filter 150ms`. `CardCombatOverlay.svelte` writes to the store via a `$effect` mirroring its internal `isQuizPanelVisible` derived. **HP color fix (2026-04-09):** `hpColor` derived correctly as green above 50%, amber 25-50%, red below 25% (was always red variants before). **Block overlay (2026-04-09):** Renders partner block as a blue gradient overlay on both the mini HP bar (compact header) and the full HP bar (expanded view). `.mini-hp-bar` and `.hp-bar` both have `position: relative` to support the absolutely-positioned `.mini-block-fill` / `.block-fill` overlay divs. Block percentage computed as `blockValue / playerMaxHp * 100`, clamped 0-100. **Block badge (2026-04-09):** After the `.hp-numbers` span in the expanded view, a `<span class="block-badge">({blockValue})</span>` appears in blue (`#4aa3ff`, font-weight 600) when `blockValue > 0`. Reads `progress.playerBlock` from `RaceProgress` type. Props: `progress: RaceProgress`, `displayName: string`, `mode: MultiplayerMode`, `quizVisible?: boolean`. **Pointer-events (2026-04-10):** `.mp-hud` and `.hud-toggle` both have explicit `pointer-events: auto` — required because parent elements may set `pointer-events: none`. `.mp-hud.quiz-hidden` overrides with `pointer-events: none` to block clicks during quiz. |
| `DamageNumber.svelte` | Floating combat numbers (damage, block, heal, poison, burn, bleed, gold, crit) |
| `StatusEffectBar.svelte` | Row of active status effect icons + counts during combat. Enemy bar positioned at `14vh` (portrait) / `18vh` (landscape override via ). Player StatusEffectBar removed — player effects now inline in InRunTopBar. Icon `.effect-icon` container is `50px` (scaled). `.effect-sprite-icon` is `40px` (scaled); `.popup-sprite-icon` is `30px` (scaled). Both sprite icons use browser-default bilinear filtering (no `image-rendering` override) — avoids aliasing artifacts when downscaling 256px source art to small display sizes. Stack badge (`.effect-stack`) shows for `value >= 1` (not `> 1`), sized 20×20px. Turn counter (`.effect-turns`) font 12px, color `#e2e8f0`, with text-shadow. `brain_fog` and `flow_state` desc functions show context-aware text based on fog level thresholds: ≤2 = Flow State active, 3-6 = Neutral, ≥7 = Brain Fog active. |
| `PassiveEffectBar.svelte` | Persistent passive effects active on player or enemy. `.passive-icon-img` is `18px` (scaled); uses browser-default bilinear filtering (no `image-rendering` override). All sizing (top, left, gap, padding, border-radius, min-width) uses `calc(Npx * var(--layout-scale, 1))` — fully responsive. |
| `EnemyPowerBadges.svelte` | Badges showing elite/boss modifier tags on an enemy. `.badge-icon` is `60px` (scaled); uses browser-default bilinear filtering (no `image-rendering` override). **2026-04-08 HUD fix:** Repositioned from centered under sprite (fixed position) to right of HP bar (`position: absolute; right: 0; top: 50%; transform: translateY(-50%)`). Parent element must have `position: relative`. **2026-04-09 positioning fix:** Repositioned again to `position: fixed; top: 22vh; left: 50%; transform: translateX(-50%); right: auto` — centered horizontally at 22% from the top. Removed the `right: 0; top: 50%` right-side anchor that caused badges to float at mid-screen-right. |
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

- Surcharge waiver conditions: `isSurgeActive || isMomentumMatch || isFreeCharge || isActiveChainMatch`
- `isActiveChainMatch = activeChainColor !== null && card.chainType === activeChainColor` — waives surcharge when card matches the active turn chain color (2026-04-08 task 7.4 fix)
- When free: displays "0 AP" with green badge color
- Badge color: green when `chargeAffordable` (player has enough AP), red when not affordable — always one of the two colors, no neutral state (2026-04-10: changed from `isFreeAp ? green : cost > 1 ? red : undefined` which left 1-AP unaffordable charges uncolored)
- Drag zone indicator uses same formula (includes `isActiveChainMatch`)
- Applies to landscape charge button (~line 978), portrait charge button (~line 1369), landscape drag zone (~line 968), portrait drag zone (~line 1354)

### AP pip rendering — effective mastery-adjusted cost (2026-04-10)

All AP pip displays now read from `getEffectiveApCost(card)` (from `cardUpgradeService.ts`) instead of `card.apCost` directly. This ensures the pip shown to the player matches the AP actually charged — e.g., Smite L5 costs 1 AP (reduced via mastery), not 2.

Components updated:
- **`CardHand.svelte`**: `hasEnoughAp()`, `getDisplayedApCost()`, `getDisplayedChargeApCost()`, `getApGemColor()`, charge drag affordability checks, aria-label, tooltip-cost, card-detail-ap — all use `getEffectiveApCost(card)`.
- **`CardVisual.svelte`**: `apDisplay` fallback (when caller does not supply `displayedApCost`) uses `getEffectiveApCost(card)`.
- **`CardCombatOverlay.svelte`**: `castDisabled` check, `hasPlayableCards`, charge-initiation affordability, cast-direct affordability — all use `getEffectiveApCost(card)`.
- **`CardBrowser.svelte`**: Card row AP label uses `getEffectiveApCost(card)`.
- **`CardRewardScreen.svelte`**: Mini-card AP pip uses `getEffectiveApCost(option)`.
- **`RewardCardDetail.svelte`**: `$derived(getEffectiveApCost(card))` replaces `$derived(card.apCost ?? 1)`.

`getEffectiveApCost(card)` checks `getMasteryStats(card.mechanicId, card.masteryLevel)?.apCost` first, falling back to `card.apCost ?? 1`. Card-building paths (object spreads assigning `apCost`) are intentionally left unchanged.

### CardHand AP badge — live charge cost preview (2026-04-09)

When a card enters **charge-preview state** (dragged into the charge zone or hovering the Charge button), the AP cost badge on the card face updates live to reflect the **real charge cost** (base − focus discount + surcharge, minus any waivers).

- `getDisplayedChargeApCost(card, isMomentumMatch, isActiveChainMatch, isFreeCharge)` — new helper; uses all four waiver signals.
- `isChargePreview` is `true` when `chargeProgress >= 1.0` (fully dragged into charge zone) OR `chargePreviewActive && isSelected` (hover over the charge button).
- When NOT in charge-preview: the badge shows Quick Play cost (base − focus discount), same as before.
- `getChargeApGemColor(chargeApCost, baseApCost)` — gem color: green if charge cost < base, red if greater, amber otherwise.
- Both landscape and portrait `{#each}` blocks wire `displayedApCost` and `apGemColor` using the charge versions when `isChargePreview` is true.

### CardHand glow rule — chain-match only (2026-04-09)

Card glow is **exclusively** driven by active chain color matching. Non-matching playable cards have **no glow**.

- `.card-playable` CSS class: all unconditional `filter: drop-shadow` removed (2026-04-09). The class still exists for layout/state hooks but applies no visual effect.
- `.card-has-frame.card-playable` CSS class: green glow removed (2026-04-09). No filter applied.
- `.drag-ready` CSS class: replaced green glow with neutral white `rgba(255,255,255,0.4)` — signals drag readiness without implying chain color.
- Chain-match glow: inline style `filter: drop-shadow(0 0 6px {activeChainHex}99) drop-shadow(0 0 12px {activeChainHex}55)` — only applied when `isActiveChainMatch && !isSelected && !isDraggingThis && selectedIndex === null`. The charge drag animation overrides with a yellow glow during drag-into-charge-zone.
- `.card--active-chain` class and chain pill pulse animation are unaffected — they continue to work independently.

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
| ~~`QuizOverlay.svelte`~~ | **DELETED 2026-04-08.** Was dead code — never imported anywhere. Visual-verification sweep confirmed the live quiz paths are `CardCombatOverlay → CardExpanded` (combat) and `StudyQuizOverlay` (rest-room study). See `docs/gotchas.md` 2026-04-08 entry. |
| `CardExpanded.svelte` | The in-card combat quiz view (committed-charge overlay). Props: `card`, `question`, `answers`, `correctAnswer`, `factLanguage`, `factPronunciation`, plus baked grammar fields `sentenceFurigana`, `sentenceRomaji`, `sentenceTranslation`, `grammarPointLabel` forwarded from `QuizData` in `CardCombatOverlay`. **Grammar fill-blank (2026-04-08):** when `isJapaneseFact && question.includes('{\_\_\_}')`, a single `<GrammarSentenceFurigana>` call renders the whole sentence from `sentenceFurigana`; `sentenceTranslation` shown below; `sentenceRomaji` row shown when `showRomaji` (`$derived` from `$deckOptions.ja.romaji`). **Grammar typing-mode hints (2026-04-08):** when `effectiveResponseMode === 'typing'` and `quizLanguageCode === 'ja'`, a `.grammar-typing-hints` panel (teal left-border) renders above `GrammarTypingInput` showing `grammarPointLabel` + `sentenceTranslation`. **Cogwheel settings:** `.quiz-options-cogwheel` opens `DeckOptionsPanel`. **Always-Write typing mode:** `alwaysWriteEnabled` reads `$deckOptions[fact.language]?.alwaysWrite`; `isTypingExcluded` is true for image quiz modes, numerical answers (`isNumericalAnswer()`), or answers >80 chars. Renders `GrammarTypingInput` (Japanese) or `TypingInput` (all other languages) when typing mode is active. **Chess puzzle mode (2026-04-10):** `quizResponseMode === 'chess_move'` renders a `<ChessBoard>` component instead of answer buttons. Props `fenPosition` and `solutionMoves` required. `effectiveResponseMode` priority: `chess_move` > `typing` > `choice`. `isTypingExcluded` also returns true for `chess_tactic` quizMode. **Multi-move puzzles (2026-04-10):** `handleChessMove(uci)` drives a full multi-move state machine. New state: `chessCurrentMoveIndex` (current step in sequence), `chessBoardFen` (live FEN updated after each ply), `chessAnimatingOpponent` (blocks input during opponent response animation). Wrong at any step = fail entire puzzle. Correct = `applyMove()` updates `chessBoardFen`, opponent response plays after 600ms via `getOpponentResponse()`, then next player move enabled; final correct = success after 400ms. **Setup animation (2026-04-10):** `chessSetupPhase` state (`'pre-move' | 'animating' | 'ready'`) shows board at `baseFen`, pauses 500ms, then animates opponent's setup move before enabling input. `.chess-setup-label` pulsing text shows while animating. `.chess-move-progress` shows `Move N / M` when `totalPlayerMoves > 1`. **Chess audio (2026-04-10):** Imports `audioManager`. Setup move fires `chess_move`. Player correct move fires `chess_check` or `chess_move` based on resulting check state. Opponent responses fire `chess_move`. Captures fire `chess_capture` via `ChessBoard.onSoundEvent`. **Chess hint level:** `chessHintLevel?: number` prop (default 0). Level 1 = from-square highlighted, level 2 = from+to highlighted. **Map Pin Drop mode (2026-04-10):** `quizResponseMode === 'map_pin'` renders `<MapPinDrop>` instead of answer buttons. New props: `mapCoordinates?: [number, number]` (lat/lng), `mapRegion?: string` (centering), `mapDifficultyTier?: number` (Geo Elo difficulty). `effectiveResponseMode` priority updated to: `'map_pin'` > `'chess_move'` > `'typing'` > `'choice'`. `handleMapPinConfirm(pinCoordinates, distanceKm, accuracy)` updates Geo Elo via `updateGeoElo()`, then calls `onanswer(..., accuracy)` after 500ms. `isTypingExcluded` also returns true when `quizResponseMode === 'map_pin'`. Map state: `mapDisabled` (locks after confirm), `mapEloChange` (shows Elo delta badge using shared `.elo-change-badge` CSS). Container: `.map-pin-quiz-container` (flex column, min-height 300px scaled). |
| `ChessBoard.svelte` | **Chess puzzle board (2026-04-10).** Interactive 8x8 board for chess tactic quiz mode. Pure display + interaction component — no game state. **Props:** `fen: string` (FEN board position), `orientation: 'white' | 'black'` (player side at bottom), `onmove: (uci: string) => void` (move callback), `disabled?: boolean` (lock after answer), `lastMove?: { from, to }` (yellow-tint highlight), `highlightSquares?: string[]` (green hint squares), `isInCheck?: boolean` (red king tint), `showNotationInput?: boolean` (default `false`), `onSoundEvent?: (event: 'move' | 'capture') => void` (optional audio callback — fires before `onmove`; caller uses it to play `chess_move` or `chess_capture` sounds without ChessBoard importing audio directly). **Tap-tap interaction:** tap own piece → selected (golden ring + legal move dots); tap highlighted square → fires `onmove` with UCI string; tap elsewhere → deselects. Legal moves computed via `chess.js`. Pieces rendered as `<img>` tags from `/assets/chess/pieces/{wK,wQ...}.svg`. Board auto-orients for black/white player. Coordinate labels (rank numbers left, file letters bottom) in contrast color per square. Piece landing animation (200ms scale pulse). Fully scalable via `calc(Npx * var(--layout-scale, 1))`. **Callers:** `CardExpanded.svelte` passes `showNotationInput={$isLandscape}` and `onSoundEvent`; `StudyQuizOverlay.svelte` passes `showNotationInput={$isLandscape}`. **Drag-and-drop (2026-04-10):** Pointer-based drag works alongside tap-tap. Capture detection in all three paths (tap, drag, notation): fires `onSoundEvent('capture')` when destination square has an enemy piece, `onSoundEvent('move')` otherwise. Notation path uses `result.flags` from chess.js for capture detection. **Chess hint squares:** `highlightSquares` prop accepts UCI from-square and to-square for hint levels 1 and 2. |
| `MapPinDrop.svelte` | **Geography map pin drop component (2026-04-10).** Canvas-based interactive world map for `quizResponseMode === 'map_pin'`. **Props:** `targetCoordinates: [number, number]` (lat/lng), `targetRegion?: string` (initial centering), `masteryLevel: number` (0–5, controls styling and zoom), `disabled?: boolean` (locks after answer), `onconfirm: (pinCoordinates, distanceKm, accuracy) => void`. Renders a d3-geo Mercator projection on an HiDPI `<canvas>`. Supports pan (drag), tap-to-place, and scroll-to-zoom. After confirmation, draws a connecting arc and shows distance/accuracy readout. Mastery-progressive styling: labels + thick borders at low mastery fade to minimal coastlines at mastery 5. Called by `CardExpanded.svelte` when `effectiveResponseMode === 'map_pin'`. Imports: `geoDataLoader.ts` (world GeoJSON), `geoScoringService.ts` (haversine + accuracy). |
| `ChallengeQuizOverlay.svelte` | Challenge-mode quiz (speed round, mastery) with configurable ChallengeMode |
| `StudyQuizOverlay.svelte` | Rest-room study quiz: boss-quiz–style questions to upgrade card charges. Shows inline `SRS +` / `SRS -` indicator (green/red, 0.65 opacity, scaled `10px`) alongside correct/wrong feedback text. **Japanese grammar rendering (2026-04-08):** When the current question carries `sentenceFurigana` segments, renders via `GrammarSentenceFurigana.svelte` with furigana/kana-only/hover support. Reactively shows `sentenceTranslation` (italic muted) and `sentenceRomaji` (when romaji toggle ON). Always shows `grammarPointLabel` as a teal-bordered hint label below the translation. Grammar rendering is MCQ-only in study mode (no typing path). CSS classes: `.grammar-fill-blank`, `.grammar-translation`, `.grammar-romaji`, `.grammar-hint-label`. **Chess puzzle integration (2026-04-10):** When `question.quizResponseMode === 'chess_move'` and `fenPosition`/`solutionMoves` are set, renders `<ChessBoard>` instead of answer buttons. `$effect` rebuilds `chessContext` (via `getPlayerContext()` from `chessGrader`) whenever the question changes. `handleChessMove(uci)` grades the move, optionally updates chess Elo via `updateChessElo()`, then calls `selectAnswer()` after 400ms (correct) or 800ms (wrong). Board is disabled after the player moves or while feedback is showing. Falls back to standard MCQ if `getPlayerContext()` throws (invalid puzzle data). `showNotationInput={$isLandscape}` passed to ChessBoard. CSS: `.chess-puzzle-container` flex column, centered. |
| `MasteryChallengeOverlay.svelte` | Mastery challenge room: timed quiz sequence for card mastery rewards. Calls `ambientAudio.setContext('mastery_challenge')` on `$effect` when challenge is set |
| `ScholarQuizPanel.svelte` | Scholar-challenge run quiz panel with extended question formats |
| `EventQuiz.svelte` | Quiz embedded inside mystery/special events for branching outcomes. Choice buttons have `data-testid="quiz-answer-{i}"` (0-indexed) for automated testing — matches pattern used in `QuizOverlay.svelte`. **Fact source (2026-04-07):** `buildQuestions()` handles three deck modes: `study` (calls `selectNonCombatStudyQuestion`), `custom_deck` (calls `selectNonCombatPlaylistQuestion` with `run.factSourceDeckMap`), and all other modes fall through to the trivia DB. Before the custom_deck branch was added, custom deck runs fell through to the trivia DB fallback, showing unrelated facts instead of custom deck facts. |
| `GrammarTypingInput.svelte` | Free-text typing input for grammar deck tilde-fragment answers (Japanese-specific: wanakana IME binding, hiragana normalization, politeness variant checking). Props: `correctAnswer`, `acceptableAlternatives?`, `onsubmit`. |
| `TypingInput.svelte` | General-purpose free-text typing input for non-Japanese vocabulary quiz answers. Uses `checkTypedAnswer()` from `typedAnswerChecker.ts` for robust lenient matching (accent folding, slash alternatives, comma synonyms, parenthetical stripping, leading "to " handling). Returns `TypedAnswerResult { correct, closeMatch, synonymMatch }`. Props: `correctAnswer: string`, `acceptableAlternatives?: string[]`, `language: string`, `onsubmit: (isCorrect: boolean, typed: string) => void`. Placeholder: "Type the English meaning...". No IME, no wanakana. **Feedback states (2026-04-07):** Correct = teal border (`.correct`); close match (Levenshtein near-miss) = amber border (`.close-match`) + "Almost! Correct answer: X" in amber (`.typing-close-match`); synonym accepted = teal border (`.correct`) + "Synonym accepted! Answer was: X" in soft teal (`.typing-synonym-accepted`); wrong = red border (`.wrong`) + "Correct: X" in red (`.typing-correct-answer`). All feedback text uses `calc(13px * var(--text-scale, 1))`. |
| `WordHover.svelte` | Hoverable word revealing dictionary definition on hover/tap |
| `GrammarSentenceFurigana.svelte` | Renders a Japanese grammar sentence using pre-baked segment data from `fact.sentenceFurigana`. **Rewritten 2026-04-08:** replaced runtime kuromoji tokenization with a synchronous segment renderer. Props: `segments: Array<{ t: string; r?: string; g?: string }>`, `excludeWords?: string[]`, `fallbackText?: string`. Each segment: `t` = surface text (or `"{___}"` for blank), `r` = hiragana reading (only when t has kanji), `g` = English gloss (content words only). Blank segments render as `<span class="grammar-blank">______</span>`. Reads `$deckOptions.ja.furigana` / `.kanaOnly` reactively — no async dependency. Hover tooltip activates on segments with `g` not in `excludeWords`: shows `r ?? t` as reading and `g` as gloss. When `segments` is empty, renders `fallbackText.split('
')[0]` as plain text. Used in `CardExpanded.svelte` via props forwarded from `CardCombatOverlay.svelte`. (QuizOverlay.svelte was dead code and has been deleted — 2026-04-08.) |
| `ProceduralStudyScreen.svelte` | Full-screen procedural math practice session. Calls `startProceduralSession` on mount, generates questions via `getNextQuestion`, grades with `gradeProceduralAnswer`. Shows running accuracy stats (questions answered, accuracy %). Answer buttons go green/red on feedback with a 1.2s delay before next question. "Stop" button returns to `studyTemple`. Tier badge shows current skill difficulty (Learning/Familiar/Advanced/Mastered). Uses same CSS scaling conventions as other screens. Props: `deckId: string`, `subDeckId?: string`, `onBack: () => void`. |
| `StudySession.svelte` | Standalone study session for the Study Temple screen. After player taps a rating button, shows a floating `SRS +` (green) or `SRS -` (red) label above the rating buttons for the 300ms pause before advancing. State: `srsIndicator: '+' | '-' | null`. |
| `StudyStation.svelte` | Quick-review widget inside the Hub |
| `StudyModeSelector.svelte` | Toggle between multiple-choice / typing / flashcard modes |
| `FactReveal.svelte` | Animates the reveal of a new fact after answering correctly |
| `FactArtwork.svelte` | Displays the artwork image associated with a knowledge fact card |
### CardExpanded — Chess Elo Rating Change Badge (2026-04-10)

`CardExpanded.svelte` now shows a floating Elo rating change badge after a chess puzzle is answered.

**New prop:** `lichessRating?: number` — the Lichess puzzle rating from the fact. Forwarded from `CardCombatOverlay.svelte` via `QuizData.lichessRating` (populated from `fact.lichessRating` in the curated deck path).

When `lichessRating` is present, `handleChessMove` calls `updateChessElo(lichessRating, isCorrect)` from `chessEloService` and stores the `ratingChange` in `eloChange` state. After the solution display, an `.elo-change-badge` div appears with class `.elo-positive` (green, `#22c55e`) or `.elo-negative` (red, `#ef4444`). The badge animates upward with `elo-float` keyframe (1.5s, fades to opacity 0 while translating `calc(-20px * var(--layout-scale, 1))` upward).

`CardCombatOverlay.svelte` `QuizData` interface now includes `lichessRating?: number` and populates it from `fact.lichessRating` in the curated deck fact assembly path.

---

### CardExpanded — Japanese Grammar Props (2026-04-08)

`CardExpanded.svelte` now accepts four additional optional props forwarded from `CardCombatOverlay.svelte`:

| Prop | Type | Purpose |
|------|------|---------|
| `sentenceFurigana` | `Array<{ t: string; r?: string; g?: string }>` | Pre-baked furigana segments; passed to `GrammarSentenceFurigana` when present |
| `sentenceRomaji` | `string` | Whole-sentence romaji; shown below the sentence when the romaji toggle is ON |
| `sentenceTranslation` | `string` | English translation; shown as `.grammar-translation` in MCQ mode and as `.grammar-hint-translation` in typing mode |
| `grammarPointLabel` | `string` | Short label (e.g., "が — subject marker particle"); shown as `.grammar-hint-label` in typing mode |

The `showRomaji` reactive is derived from `$deckOptions?.ja?.romaji`. A `.grammar-typing-hints` panel (teal left-border box) renders above `GrammarTypingInput` when typing mode is active and either label or translation is present. Grammar rendering no longer loops `sentence.split('{___}')` — `GrammarSentenceFurigana` handles blanks internally via `{ t: "{___}" }` segment entries.

`CardCombatOverlay.svelte` forwards these four fields through `QuizData` (interface updated with the same fields) from the curated-deck path in `getStudyModeQuiz()`.

### CardExpanded Landscape Panel Positioning

**`.card-expanded-landscape`** is the combat charge-quiz panel in `CardExpanded.svelte`. It is `position: fixed`, left-aligned, and spans `58vw` wide.

**Vertical positioning (2026-04-08, updated Ch8):**
- `top: calc(var(--topbar-height, 4.5vh) + calc(40px * var(--layout-scale, 1)))` — topbar height + fog meter (28px) + 12px gap ≈ 89px at 1080p. Positions the panel below the fog meter with breathing room.
- `bottom: calc(9vh + calc(16px * var(--layout-scale, 1)))` — stops near the card hand, leaving ~9vh + 16px gap. Extended 15vh lower than before (was 24vh). Overlap with card hand is intentional by design.
- `overflow: hidden` — no scrolling; all content must fit within the available panel height.
- Content uses `flex-direction: column` with `justify-content: center` to distribute space.

**Header (2026-04-08 Ch8):** `.header-domain` shows text only (`deckDisplayName ?? domainName`). The `.header-domain-icon` `<img>` element, `getDomainIconPath` import, and `domainIconPath` derived have all been removed.

**Font sizes (2026-04-08 Ch8):**
- `.card-question` base: `14px` (was 11px)
- `.quiz-text-short` (< 30 chars): `26px` (was 22px)
- `.quiz-text-medium` (< 80 chars): `22px` (was 18px)
- `.quiz-text-long` (≥ 80 chars): `18px` (was 14px)
- `.answer-btn` font: `15px` (was 11px)
- All values use `calc(Npx * var(--text-scale, 1))`

### QuizOverlay Landscape Two-Zone Layout — DELETED (2026-04-08)

**`QuizOverlay.svelte` was dead code (no importers) and has been deleted.** The live combat quiz path is `CardCombatOverlay.svelte` → `CardExpanded.svelte`. The boss/rest-room study path uses `StudyQuizOverlay.svelte` (separate component, unchanged). Always grep for importers before trusting a component is live.

Historical note — **Refactored 2026-04-03:** The landscape quiz overlay uses a space-filling two-zone flex column anchored dynamically between the fog meter and card hand.

**Stage anchoring via ResizeObserver:**
- A `ResizeObserver` on `.card-app` fires on every resize and sets `--quiz-stage-top` / `--quiz-stage-bottom` CSS custom properties on the stage element.
- `--quiz-stage-top` = bottom of `.fog-wing-wrapper` (falls back to `.topbar` bottom). Breathing room is provided by `CardExpanded.svelte` `.card-expanded-landscape` CSS `top` calculation.
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
- `align-items: flex-start` — question content aligns left for readability.
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
- `flex: 0 0 auto` — answer zone does not shrink; sized to content.
- `max-height: 55%` — caps growth so Zone A always has adequate question display space.
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
| `HubScreen.svelte` | Main hub: campfire, NPC sprites, run summary, navigation entry points. Calls `ambientAudio.setContext('hub')` on initial `$effect`. Integrates hub lighting engine, glow canvas, fireflies, moths, custom cursor light, per-sprite brightness with mouse proximity bonus, and background warmth filter. Tracks mouse via `onpointermove`/`onpointerleave`; hides system cursor with `style:cursor="none"` when effects are enabled. Child interactive elements use `cursor: inherit` (not `cursor: pointer`) so the hub cursor:none propagates correctly. **Z-index layering (landscape)**: `.camp-bg-wide` z-0, HubGlowCanvas glow-canvas z-1 / vignette z-2, `.hub-center` z-3 (raised from z-1 on 2026-04-01 so all sprites and HUD inside hub-center paint above the vignette overlay; background image at z-0 still gets darkened by vignette). **Props:** `onOpenMultiplayer: () => void` — triggers `handleOpenMultiplayer()` in CardApp which creates a lobby and navigates to `multiplayerLobby`. The tent sprite button (`.CampSpriteButton` with label "Multiplayer") wires directly to `onOpenMultiplayer` — the standalone `.multiplayer-hub-btn` overlay button was removed (2026-04-07). `onOpenSocial` prop removed (2026-04-07). |
| `HubNavBar.svelte` | Bottom navigation bar (Library, Profile, Leaderboards). **2026-04-07:** Social tab removed; `NavScreen` type no longer includes `'social'`; grid updated to `repeat(5, minmax(0, 1fr))`. |
| `KnowledgeLibrary.svelte` | Full-screen knowledge fact browser (screen: `library`). Props: `onback: () => void`. **Layout (2026-04-06 rewrite):** sidebar + header + main content — identical structure to StudyTempleScreen. Header bar: back arrow, LIBRARY title (purple, Cinzel uppercase), search input (flex:1, max-width 400px), Tier select, Sort select, mastery badge at far right. Sidebar: collapsible (200px → 36px) with breathe-gold animation on toggle arrow when collapsed; categories built from `domainSummaries.filter(s => s.totalFacts > 0)` — All tab (null) plus one entry per domain. Active tab has `border-left-color: #818cf8` and `rgba(99,102,241,0.08)` background. Main content: subcategory chips bar (only visible when a specific domain is active and `domainSubcategories.length > 1`); lore unlock banner + lore grid (only in All tab); fact count summary; scrollable fact grid (`repeat(auto-fill, minmax(300px, 1fr))`); scroll-fade gradient overlay. **State:** `activeTab: FactDomain | null` (null = All), `selectedEntry`, `selectedSubcategory`, `tierFilter`, `sortBy`, `searchQuery`, `sidebarCollapsed`. **Derived:** `allDomainEntries` — when `activeTab` is null, combines `buildDomainEntries()` across all non-empty domains; when a domain is active, calls `buildDomainEntries()` for that domain with tier/sort/subcategory filters. `filteredDomainEntries` applies `searchQuery` on top. **Detail view:** clicking a fact row sets `selectedEntry`; detail card renders in main content area with back button, statement title, domain subtitle, 2-col stats grid (attempts/correct/avgRT/stability/difficulty/nextReview), question variants list, tier history. **Escape key:** closes detail then exits library. Background: `linear-gradient(160deg, #0a0e1a 0%, #1a1035 50%, #0a0e1a 100%)`. z-index: 260. All sizing uses `calc(Npx * var(--layout-scale, 1))` / `calc(Npx * var(--text-scale, 1))` — zero hardcoded px. Removed all landscape/portrait class overrides and `:global([data-layout])` rules. |
| `HubVisitorView.svelte` | Visitor profile view when browsing another player's hub |
| `PendingNextStepsOverlay.svelte` | **Dev-only ambient overlay (added 2026-04-10).** Fetches `.claude/pending-next-steps.json` from the dev-only Vite endpoint `/__rr_pending_next_steps.json` (served by the `pendingNextStepsEndpoint()` plugin in `vite.config.ts`) and renders the top 1–3 `## What's Next` `subject` strings as low-opacity corner text in the hub's top-right (landscape) / bottom of portrait. Closes the loop between the `persist-whats-next.sh` Stop hook that writes the file at session end and the developer noticing their prior-session reminders without running `/catchup`. **Gating:** the component itself does NOT gate — the parent `HubScreen.svelte` wraps the mount in `{#if $devMode}` per `.claude/rules/ui-layout.md` § Dev-only UI Gating. The component tags every rendered element with `data-dev-only="true"` for assertion-based absence tests. **States (per softlock-prevention rule):** `loading` → "Loading…" + dismiss; `empty` → "No pending next-steps from previous session." + dismiss; `error` → "Failed to load: {message}" + dismiss; `ready` → ordered list of subjects + timestamp footer + dismiss. **Dismiss behaviour:** local `dismissed` `$state` — resets on page reload, so each dev session sees the reminders once. A ↻ refresh button re-fetches without reloading. **Sizing:** all dimensions use `calc(Npx * var(--layout-scale, 1))`; fonts use `calc(Npx * var(--text-scale, 1))`. `max-width: calc(360px * var(--layout-scale,1))`, `top: calc(72px * var(--layout-scale,1))`, `right: calc(16px * var(--layout-scale,1))`, `z-index: 95` (above hub layers, below CampUpgradeModal which is z >= 100). **Truncation:** subjects longer than 60 chars are truncated with an ellipsis; the full text is available via the `title` attribute (native browser tooltip). **Test IDs:** `pending-next-steps-overlay`, `pending-next-steps-list`, `pending-next-steps-empty`, `pending-next-steps-error`, `pending-next-steps-loading`, `pending-next-steps-dismiss`, `pending-next-steps-refresh`. **Verified 2026-04-10** via Docker visual test: dev-mode capture shows the overlay with 3 subjects + timestamp; non-dev capture has `overlayCount=0` and passes `assert exists:false`. |
| `CampHudOverlay.svelte` | HUD overlay on the hub: streak, gold, XP progress bar |
| `CampSpriteButton.svelte` | Clickable NPC sprite button in the hub scene. Props: `spriteOffsetX`/`spriteOffsetY` for CSS translate repositioning (applied to the sprite `<img>` only — the `.sprite-hitbox` button receives NO transform; hitbox position values in `HubScreen` must account for the sprite offset directly using the final on-screen pixel coordinates); `brightness` (default 1.0) for campfire lighting via `--sprite-brightness` CSS custom property. `fireShadow` prop removed 2026-04-01 (full-frame sprites caused alpha-channel blob halos). `.sprite-hitbox` uses `cursor: inherit` (updated 2026-04-01, was `cursor: pointer`) so the hub `cursor: none` is not overridden by child buttons — the custom glow cursor IS the hover feedback when effects are active. `buildHitboxStyle()` helper removed 2026-04-08: applying the same CSS `translate()` percentage to the hitbox was incorrect because percentages are relative to the element's own dimensions, not the parent; the sprite image (full container) and tiny hitbox produce wildly different pixel offsets. See "Hub Lighting" section below. |
| `CampSpeechBubble.svelte` | Speech bubble overlay for hub NPC characters |
| `AnimatedPet.svelte` | Canvas-based animated hub pet. Renders 64×64 px horizontal spritesheet strips for 6 `PetBehavior` states (`idle`, `walk`, `sit`, `lick`, `sleep`, `react`) driven by the `petBehavior.ts` state machine and the shared 30fps `hubAnimationLoop`. Position follows `petState.position` (% of `.hub-center` container). Walk bob: sine-wave vertical offset `sin(now * 0.006) * 2` px during walk. Flip: `facingLeft` passed as `flipX` to `drawSpritesheetFrame`. Props: `species?: PetSpecies` (default `'cat'`), `disableEffects?: boolean` (reduces to static frame 0 at campfire, no loop), `onclick?: () => void`. Click triggers `triggerReact()` then the callback. Minimum tap target 44×44px hitbox button overlay. Graceful degradation: if a behavior spritesheet fails to load, that behavior renders nothing. z-index 35. CSS size `calc(64px * var(--layout-scale, 1))`. **NOT mounted in HubScreen (2026-04-04):** pet is rendered as a standard `CampSpriteButton` (tier sprites from `pet/tier-{N}.webp`, hitTop 69% / hitLeft 60% / hitWidth 11% / hitHeight 6%, zIndex 35, `petBright` lighting, preloaded in `_campImagesToPreload`). `AnimatedPet.svelte` and `petBehavior.ts` are retained for potential future reuse. |
| `CampfireCanvas.svelte` | Canvas-based animated campfire flicker effect. CSS size is `calc(200px * var(--layout-scale, 1))` × `calc(250px * var(--layout-scale, 1))`. **z-index: 26** — above campfire sprite (z-25) so ember particles render on top of the fire art. On mount, canvas pixel dimensions are set from `clientWidth`/`clientHeight`; a `ResizeObserver` keeps them in sync. Scale factor (`clientWidth / 200`) is passed to `CampfireEffect` constructor and updated via `setScale()`. |
| `HubGlowCanvas.svelte` | Two-canvas hub glow system (updated 2026-04-01 perf pass): (1) `position: fixed` canvas with `mix-blend-mode: screen` for additive warm orange radial glow; (2) sibling `<canvas class="hub-vignette-canvas">` with `mix-blend-mode: normal` for vignette darkening — replaces the old CSS `<div>` whose reactive `radial-gradient` was being reparsed by Chrome each frame. Props: `campfireCenterFn: () => {x, y}` (absolute viewport pixels), `zIndex?: number` (default 1; vignette canvas gets `zIndex + 1`), `mouseX?: number` / `mouseY?: number` — forwarded to `HubGlowEffect.setMousePosition()`. No longer imports `getHubLightingStore()` — vignette gradient is drawn directly by `HubGlowEffect` onto the second canvas each frame. |
| `HubFireflies.svelte` | Ambient firefly particles driven by **shared-loop sine-wave motion** (updated 2026-04-01 perf pass). Uses `hubAnimationLoop.ts` shared 30fps loop instead of own RAF. Spawns 15 fireflies on mount; keeps count stable by respawning dead ones immediately. **Motion:** each firefly has per-fly `phase`, `ampX`/`ampY`, `freqX`/`freqY`, `depthLayer` (0.5–1.0). Position updated every 30fps tick; Svelte `tick` $state only incremented every 3rd frame (~10fps) to reduce 15-element DOM style-recalc cascade. **Lifecycle:** fadingIn 600ms → alive 4–8s → fadingOut 800ms → dead → respawn. **Alpha:** `maxAlpha = 0.4 + depthLayer * 0.4` (0.6–0.8). **No CSS keyframes** — all motion is JS-driven. **Spawn:** full-screen excluding campfire zone 40–60%x / 55–75%y. **Size:** `(size * depthLayer)px * var(--layout-scale, 1)`. **Reduce-motion:** static positions, no callback registration. |

| `HubMoths.svelte` | 4 tiny moths orbiting the campfire (added 2026-04-01). Each traces an elliptical CSS path centered near the fire (~50%, 58% of container). Orbit radius 3–8% wide, 1.5–3% tall; duration 4–8s; staggered by ~0.8s each. Scale variation in `@keyframes moth-orbit` (0.8–1.1×) simulates depth as moths pass in front of and behind the fire. Separate `@keyframes moth-flutter` (1.2–2.7s) drives irregular opacity (0.5–0.9) simulating wings catching firelight. Appearance: 3×2px dot, `rgba(180,160,120,0.7)` warm tan, subtle warm glow. z-index 26 (matches CampfireCanvas). Rendered via `{#if !disableEffects}<HubMoths />{/if}` in both landscape and portrait hub layouts. |
| `HubCursorLight.svelte` | Mouse-interactive custom cursor + firefly trail for the hub scene. Props: `x: number` (viewport clientX), `y: number` (viewport clientY), `visible: boolean`. Renders a warm orange radial-gradient glowing dot (`position: fixed; z-index: 100; pointer-events: none`) that replaces the system cursor. **Trail (updated 2026-04-01):** warm golden yellow particles `rgba(255, 240, 120, 0.8)` (was green). Max 6 particles (was 10), spawn interval 120ms (was 80ms). **Movement threshold:** only spawns when cursor moves ≥3px — suppresses micro-movement spawning. **Distance pruning:** particles >10% viewport width from current cursor are removed immediately (prevents orphaned spheres when cursor jumps). **Stop cleanup:** all trail particles cleared 500ms after cursor stops moving (via `setTimeout` reset on each move event). Particles drift 10–25px, lifetime 400–800ms. Respects `prefers-reduced-motion` (hides trail, keeps static cursor). |
| `CampfirePause.svelte` | In-run pause menu: resume / return to hub, run stats, and **Quick Settings** collapsible section (audio, gameplay, fullscreen). Props: `currentFloor`, `playerHp`, `playerMaxHp`, `deckSize`, `relicCount`, `accuracy`, `onresume`, `onreturnhub`, `canReturnHub?`. Quick Settings is a collapsible `▸ Quick Settings` button toggling `settingsExpanded $state`. Audio group: SFX/Music/Ambient enable toggles + volume sliders (bound to `sfxEnabled`, `musicEnabled`, `ambientEnabled`, `sfxVolume`, `musicVolume`, `ambientVolume` from `cardAudioManager`). Gameplay group: Answer Speed slider (`answerDisplaySpeed` 0.5–3.0) + Auto-Resume toggle (`autoResumeAfterAnswer`) from `ui/stores/settings`. Fullscreen group: shown only when `!isMobile`, checkbox calls `handleFullscreenToggle()` via `fullscreenService`. Card uses `max-height: 90vh; overflow-y: auto` for scroll on small viewports. All sizing `calc(Npx * var(--layout-scale,1))`. |
| `CampUpgradeModal.svelte` | Modal with three tabs: **Camp Upgrades** (9 sprite elements, tier upgrades with grey matter cost), **Relics** (level-locked relic catalog with XP bar), and **Jukebox** (BGM track shop). Jukebox tab: filter buttons (ALL/EPIC/LO-FI), track list with category badge, title, duration, preview button (pulsing green when active — calls `musicService.previewTrack()`/`stopPreview()`), and buy button (calls `purchaseMusicTrack()` from `playerData` store). Owned tracks show a checkmark. Preview stops automatically when switching away from the Jukebox tab or closing the modal. Jukebox state: `jukeboxFilter`, `previewingTrackId`, `justPurchasedId`. All dimensions use `calc(Npx * var(--layout-scale, 1))`. Landscape max-width 900px. |
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
- Portrait-specific deriveds for shop (`87%, 52%`) and tent (`44%, 66%`) since they differ from landscape positions (`61%, -21%` and `40%, 90%`)
- **Landscape shop hitbox** (2026-04-08): `hitTop="61%" hitLeft="-21%" hitWidth="19%" hitHeight="11%"` — corrected from previous 52%/-2%/16%/13% to match actual chest pixel position after `spriteOffsetX="-73%" spriteOffsetY="-27%"`. Root cause: prior fix incorrectly applied the same `translate()` percentage to the hitbox element, which uses different dimensions than the full-container sprite image, producing wrong pixel offsets. Hitbox now positioned at final on-screen screen coordinates directly (chest occupies X: 52.1–71.2%, Y: 87.6–98.2% of `tier-0.webp`, which maps to left: -20.9%, top: 60.6% after the sprite offset)
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
| `DeckSelectionHub.svelte` | Run-start hub: choose Trivia Dungeon vs. Study Temple. **A11y (BATCH-ULTRA T11, 2026-04-11):** Both panels have `role="button"`, `tabindex="0"`, and `onkeydown` Enter/Space handlers. `aria-label` added: `"Trivia Dungeon — Battle with knowledge across multiple domains"` and `"Study Temple — Master your curated decks with focused learning"`. Focus ring via `.panel:focus-visible` (`3px solid #60a5fa`). Back button also gains `:focus-visible` outline. Fixes issue-1744337400021-11-022. **3D parallax panels:** both panels use `transform-style: preserve-3d` with `--rot-x`/`--rot-y` CSS vars driven by RAF-throttled `makePointerHandlers()` factory (`rotY = (x-0.5)*24`, `rotX = (0.5-y)*24`). Each panel has a `.parallax-wrap` containing a `.plx-layer` image (`/assets/sprites/deckfronts/trivia_dungeon.webp` and `study_temple.webp`) that shifts `(pointer - center) * -0.08%` against pointer and scales 1.08; rendered only when the webp resolves (runtime `Image.onload` check). **Smoke system:** 12 background wisps (`.smoke-container`, z-index 1) + 5 foreground wisps (`.smoke-foreground`, z-index 3) — each is a blurred radial-gradient ellipse (`500px` bg / `350px` fg) animating with `smoke-rise` (vertical drift, 8–14s cycle) and `wind-gust` (periodic lateral shove via `margin-left`, 5–10s). Each wisp has individual `--duration`, `--delay`, `--sway`, `--peak-opacity`, `--gust-duration`, `--gust-delay`, `--gust-shift` CSS vars. **Ground fog:** `.ground-fog` persistent 45%-height layer at bottom (z-index 1) with 3 layered gradients on element + `::before` + `::after`, each drifting independently via `fog-drift` and `fog-sway` keyframes; blurred 15px. **Text overlay:** `.panel-text-overlay` at `translateZ(40px)` with dark `radial-gradient` scrim (`::before`, rgba 0,0,0 0.75→transparent). **Text sizes (all scaled):** title 32px, subtitle 18px, tagline 16px, stats 13px. All text has heavy `text-shadow` 4-direction stroke (2px black). Shine overlay (`radial-gradient` at `--shine-x`/`--shine-y`, opacity 0→1 on hover, z-index 10). Icons removed. Touch devices skip 3D math (`hover: none` detection). All dimensions use `calc(Npx * var(--layout-scale, 1))` / `calc(Npx * var(--text-scale, 1))`. **Reduced-motion:** panel transitions disabled, shine hidden, smoke wisps hidden, ground fog animations stopped. |
| `StudyTempleScreen.svelte` | Full-screen deck library (THE LIBRARY). **Layout:** header (single row, `flex-wrap: nowrap`) + horizontal body split: collapsible left sidebar + right main content. Sidebar (`.sidebar`, default `200px` wide, `calc(200px * var(--layout-scale,1))`) lists categories vertically via `.sidebar-item` buttons; collapses to `36px` when `sidebarCollapsed` is true (toggle arrow button at top). Category data comes from the `categoryList` derived (built from `getDomainMetadata` — `null` id = All tab); **Custom Decks** entry (id `'custom'`) added immediately after All, count = `customDecks.length`; also shows a "My Decks" entry (id `'personal'`) when any deck with `domain === 'personal'` exists. Active item gets indigo-tinted background + `3px` left border in `#818cf8`. Main content (`.main-content`, `flex:1`) has three branches: (1) Workshop tab → `WorkshopBrowser`; (2) Custom Decks tab (`activeTab === 'custom'`) → `.custom-decks-content` with a list of `CustomDeck` rows, each showing name + item count + **View** / **Start** buttons; empty state shown when no custom decks exist; (3) everything else → deck-summary + `.deck-scroll` + `.scroll-fade`. **Header layout (2026-04-07):** `[← Back] [THE LIBRARY] [search] [sort] [spacer flex:1] [filter chips] [Import Anki]` — `.header-spacer` with `flex:1` pushes filter chips and Import Anki button to the right side. **Import Anki button** (`.anki-import-btn`, purple tint, `12px` font) triggers `showAnkiImport` state, mounting `AnkiImportWizard`. **Custom deck View/Start buttons:** View sets `activeCustomDeckId` and `showDeckView = true` → opens `CustomDeckViewModal`; Start sets `activeCustomDeckId` and calls `handleStartCustomRun()`. **Bottom `CustomDeckBar` removed (2026-04-07)** — custom deck access is now through the "Custom Decks" sidebar tab instead. `showCustomDeckBar` derived and `CustomDeckBar` import removed. `getDomainMetadata` imported from `../../data/domainMetadata`. All sizing: `calc(Npx * var(--layout-scale,1))` / `calc(Npx * var(--text-scale,1))`. **Custom deck run support:** `onStartRun` prop accepts `{ mode: 'custom_deck'; items: CustomDeckRunItem[] }`. **Custom deck management:** handlers `handleRemoveDeckItem(itemIndex)`, `handleDeleteDeck()`, `handleRenameDeck(newName)`. **Duplicate toast:** `duplicateToast` state shows 2s fixed-position toast, z-index 400. |
| `DeckBuilder.svelte` | Full deck-builder: browse, filter, and manage curated deck cards |
| `CardBrowser.svelte` | Card collection browser with filtering and sorting in the Library |
| `CardExpanded.svelte` | Full-screen expanded card view with all details and fact text. **Always-Write typing mode (2026-04-04):** `alwaysWriteEnabled` reads `$deckOptions[quizLanguageCode ?? '']?.alwaysWrite`; `effectiveResponseMode = alwaysWriteEnabled || quizResponseMode === 'typing' ? 'typing' : 'choice'`. **Typing exclusions (2026-04-07):** `isTypingExcluded` is true for image quiz modes (`image_question` / `image_answers`), numerical answers (`isNumericalAnswer(correctAnswer)`), or answers >80 chars — falls back to multiple-choice in those cases. **Typing dispatch (2026-04-07):** when `effectiveResponseMode === 'typing' && !isTypingExcluded`, renders `GrammarTypingInput` when `quizLanguageCode === 'ja'`; renders `TypingInput` (general-purpose, language-agnostic) for all other languages. |
| `CardPickerOverlay.svelte` | Pick a specific card from the deck (e.g., transmute target). **Ch15.1 (2026-04-08):** Enhanced with `mode` prop (`single | multi | multiUpTo`) and `confirmLabel` prop. **Props:** `title`, `cards`, `onselect`, `onskip`, `pickCount?` (default 1, backward-compatible), `mode?` (default: inferred from pickCount — `single` when pickCount=1, `multi` otherwise), `confirmLabel?` (default `"Confirm"`). **Mode behavior:** `single` = click auto-confirms (no confirm button); `multi` = must select exactly `pickCount` cards then click Confirm (enabled only when all picks made); `multiUpTo` = select 1..pickCount, Confirm enabled when ≥1 selected. **Card width parity (2026-04-10):** `.card-visual-wrapper` uses a reactive `pickerCardW = (35 * vh / 100) * 0.88 / 1.42` formula (same as `CardHand.landscapeCardW`) applied as inline style — width, height, and `--card-w` are all set dynamically from viewport height so picker cards match hand cards at every resolution. No hardcoded `160px`. **Row layout (Phase 3 refactor 2026-04-09):** `.picker-cards` uses `display: flex; flex-wrap: wrap; justify-content: center` — horizontally centers 3 Transmute candidates. Container `max-width` 960px (scaled). **Confirm button:** disabled/dim when criteria unmet, gold when enabled. **Backward compatibility:** callers that only pass `pickCount` + `onselect` retain identical behavior — no breaking changes. **Multi-mode onselect note:** In `multi` mode, `handleConfirm()` calls `onselect(card)` once per selected card (not as an array). **CardApp wiring (2026-04-08):** `CardApp.svelte` subscribes to `pendingStudyUpgrade` (study upgrade picker, multi mode) and `pendingTransformOptions` (shop transform picker, single mode) from `gameFlowController.ts`. Both render `CardPickerOverlay` when their store is non-null. **CardVisual refactor (2026-04-09 — re-applied after session reset):** All bespoke v2 frame CSS and rendering removed. Each card slot uses `.card-visual-wrapper` (`position: relative`) as a sized container, then renders `<CardVisual {card} />` inside it — frame, art, mechanic name, chain pill, effect text, AP gem all delegated to `CardVisual.svelte`. The old bespoke `.card-v2-frame`, `.frame-layer`, `.card-info`, `.card-name`, `.card-desc` blocks and their CSS have been removed. Imports of `getBorderUrl`, `getBaseFrameUrl`, `getBannerUrl`, `getUpgradeIconUrl`, `getShortCardDescription`, `getMechanicDefinition`, `getChainColor`, `getChainGlowColor` removed — CardVisual owns all that. The `.card-label` div showing mechanic name text below the frame has been deleted (user requested removal). **Post-pick card-hang fix (2026-04-09):** `CardCombatOverlay.svelte` removes the source card from `animatingCards` and calls `resetCardFlow()` immediately when `pendingCardPick` is returned — prevents card floating mid-screen during picker display. **Dev store (2026-04-09):** `debugBridge.ts` now registers `pendingTransformOptions` at `Symbol.for("rr:pendingTransformOptions")` alongside `activeTurnState` and `activeRunState` for visual testing via eval injection. |
| `DeckTileV2.svelte` | Tile component for a curated deck in the selection grid. 3D tilt on hover, shine overlay, deal animation. Single-image CSS parallax when `/assets/sprites/deckfronts/{id}.webp` is found (single image shifts against pointer, 0.08% multiplier, scale 1.08). When `hasImage` is true, adds `.has-image` class: title uses `position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%) translateZ(40px)` (bottom-center of art area, floating in 3D space), and badges float at `translateZ(30px)`. **Procedural deck support:** when `deck.procedural` is true, shows a single skill count bar ("X skills") instead of Seen/Review/Mastered progress bars, with a "Practice to track progress" hint. Description auto-falls back to "X skills" instead of "X facts" for procedural decks. |
| `DeckDetailModal.svelte` | Two-column modal (900px wide) for deck details. **Left column** (scrollable): deck name, description, overall progress bar, Study Focus sub-deck radio list, exam tag filter chips. **Right column** (scrollable when tall): total facts / mastered stat block, Launch Expedition button (curated), Add to Custom Deck button, optional Export to Anki button, optional language display options panel. **Props:** `deck`, `progress`, `onStartRun`, `onClose`, `onAddToCustom?`, `onExportAnki?: (deckId: string, deckName: string) => void` (new 2026-04-05). When `onExportAnki` is provided, renders an `.export-anki-btn` (purple tint, `12px` font, full-width `36px` height) below the Add to Custom Deck button — clicking it calls `onExportAnki(deck.id, deck.name)`. **Language display options (2026-04-07):** For language decks (Japanese, Chinese, Korean) only — renders a `.deck-options-wrapper` containing `DeckOptionsPanel` below the action buttons. Detected via `getLanguageCodeForDeck(deck.id)` + `getLanguageConfig(code)?.options?.length > 0`. CSS variables on `.deck-options-wrapper` override DeckOptionsPanel defaults to match the modal dark blue/indigo palette (--color-surface, --color-surface-dim, --color-border, --color-text-primary, --color-text-muted, --color-accent, --color-accent-hover). Right column changed from `justify-content: center` to `overflow-y: auto` to handle taller content when options panel is visible. Banner icon and gradient removed. Close button is yellow (`#eab308`), no background circle. All sizing uses `calc(Npx * var(--layout-scale, 1))`. **Procedural deck support:** progress shows "X skills", start button reads ">> START PRACTICE". | **Chess Elo display + sparkline (2026-04-10):** When `deck.id === "chess_tactics"`, a `.chess-elo-display` row appears below the progress section showing: chess pawn icon (`♟`, 20px), current Elo rating in gold (`#ffd700`, 24px bold, tabular-nums), Elo label from `getEloLabel()` in muted color, and an Elo sparkline SVG (`<svg class="elo-sparkline">`, 100px × 30px scaled) when `$playerSave.chessEloHistory` has ≥2 entries. Sparkline uses a `<polyline>` — green (`#22c55e`) if trending up, red (`#ef4444`) if trending down (last rating vs first). Shows last 30 entries. `sparklineData` derived from `$playerSave`; `buildSparklinePath()` computes points in a 120×36 viewBox with 20-unit min/max padding. **Skipped-facts warning badge (2026-04-11):** When `deck.skippedFactCount > 0` (runtime metadata set by `curatedDeckStore.ts` when Zod validation skips malformed fact rows), a yellow inline badge is rendered between the deck description and the progress section. Badge text: "{N} facts skipped (malformed)". Hover tooltip: "This deck had N entries that failed schema validation and are not playable. The rest of the deck works normally. Check the browser console for details." Hidden entirely when count is 0. CSS: `.skipped-warning` (amber border/background tint, inline-flex, `overflow: visible` for tooltip), `.skipped-text` (amber, 11px bold), `.skipped-tooltip` (positioned below badge, opacity transition on hover). Source: `DeckRegistryEntry.skippedFactCount` → `skippedFactCount` derived → `{#if skippedFactCount > 0}` block. Test ID: `data-testid="deck-skipped-warning"`.
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
| `CustomDeckBar.svelte` | Horizontal bar showing the active custom deck. **No longer mounted in `StudyTempleScreen` (2026-04-07)** — custom deck access moved to the "Custom Decks" sidebar tab. Still available as a standalone component for other contexts. Fallback name shows "Custom Deck" when no named deck exists. **Props:** `customDecks: CustomDeck[]`, `activeCustomDeckId`, `onSwitchDeck`, `onStartCustomRun`, `onViewDeck`. **Meta display (2026-04-07):** shows deck names instead of item count — up to 3 names joined with commas; 3+ collapses to first two names + "+N more". **View button** wires to `onViewDeck` callback, opens `CustomDeckViewModal`. Renamed from `PlaylistBar.svelte` 2026-04-07. |
| `CustomDeckPickerPopup.svelte` | Popup for adding a deck to a custom deck. **Props:** `customDecks: CustomDeck[]`, `onAddToDeck`, `onCreateAndAdd`, `onClose`. Input placeholder reads "Custom deck name...", aria-labels use "custom deck" terminology. Renamed from `PlaylistPickerPopup.svelte` 2026-04-07. |
| `PlaylistViewModal.svelte` | Rich inspection modal for viewing and editing a custom playlist (upgraded 2026-04-07). **Props:** `playlist: CustomPlaylist`, `onClose`, `onRemoveItem(itemIndex: number)`, `onDeletePlaylist`, `onRenamePlaylist(newName: string)`. **Features:** (1) **Aggregate stats header** — overall progress bar (green fill via `.progress-track`/`.progress-fill`), total/seen/mastered counts; uses `getDeckProgress()` summed across all study items. (2) **Expandable accordion items** — each deck row shows name, mini 80px progress bar, mastery %, fact count, and a chevron (▸/▾) if the deck has sub-decks or exam tags; clicking expands the row using a proper `<button class="expand-trigger">` (a11y-safe, aria-expanded). (3) **Sub-deck drill-down** (in expanded panel) — lists each sub-deck with its own mini progress bar and mastery % via `getSubDeckProgress()`. (4) **Exam tag chips** (in expanded panel) — shows tag display labels (using `TAG_DISPLAY` map matching `DeckDetailModal`) with fact counts via `getTagFactIds()`. Tags are display-only (not toggleable in this context). **Inline name editing**, per-item remove buttons, delete-with-confirmation flow all preserved. Modal width widened from 460px to **560px** to accommodate progress bars. Backdrop z-index 350. All sizing uses `calc(Npx * var(--layout-scale, 1))` / `calc(Npx * var(--text-scale, 1))`. |
| `LanguageGroupHeader.svelte` | Section header grouping language deck entries by family |
| `WorkshopBrowser.svelte` | Steam Workshop deck browser, mounted inside `StudyTempleScreen` when the "Workshop" sidebar tab is active. **Props:** `personalDecks?: PersonalDeck[]`, `onSubscribed?: (deckId, deckName) => void`. **Mock decks removed (2026-04-07):** when `workshopAvailable` is false, `browseResults` is set to `[]` (empty array) instead of showing placeholder mock data — browse view shows an empty state with a message directing users to the Steam build. **Two tabs:** Browse (search + deck grid with Subscribe buttons) and My Published Decks (list of own published decks + Publish section for personal decks). All sizing uses `calc(Npx * var(--layout-scale,1))` / `calc(Npx * var(--text-scale,1))`. |

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

**Badge contrast** — All `.badge` elements receive `box-shadow: 0 1px 4px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.25)` to ensure separation from any deck art background (LOW-18: purple badge was invisible against Philosophy's purple/indigo art). White-text badges (NEW, CONTINUE) also get `text-shadow: 0 1px 2px rgba(0,0,0,0.4)`. Badge opacity increased from 0.85 to 0.95.

**Non-image tiles** — The original centered layout and stacked text-shadow are unchanged when `hasImage` is `false`. Both code paths are fully independent.


---

## Rooms & Events

| Component | Purpose |
|-----------|---------|
| `ShopRoomOverlay.svelte` | Shop: buy/sell cards and relics, card removal, haggle quiz. Calls `ambientAudio.setContext('shop')` on `$effect`. **Layout (2026-04-08):** `.shop-hud` height `48px`, `background: rgba(10, 15, 25, 0.95)`, `border-bottom: 2px solid rgba(194, 157, 72, 0.5)` — matches InRunTopBar gold style. `.unaffordable` uses `filter: grayscale(0.3)` + `border-color: rgba(239, 68, 68, 0.3)` instead of `opacity: 0.4` (keeps text readable). **Synergy system removed (2026-04-08):** `highlightedMechanics` state, `onCardHover`/`onCardLeave` handlers, `deckMechanics` derived, synergy-badge template, `.synergy-match`, `.synergy-none`, `.synergy-highlight`, and `synergy-pulse` keyframes all deleted. **Card display (2026-04-08):** Shop card items now show a `.chain-dot` colored pip (8px circle) inline with the effect label via `.card-sub-row` flex row — indicates chain type without synergy cross-highlighting. **Relic tooltip:** Already rendered when `relicTooltip` state is set (hover triggers `showRelicTooltip()`, mouseleave triggers `dismissRelicTooltip()`). Shows relic name (rarity-colored), description, and trigger; max-width `220px` scaled, z-index 200, dark background. **Haggle fail behavior (2026-04-08):** On haggle quiz failure, NO price penalty is applied — the item keeps its original price and the haggle button is disabled for that item (`haggledThisItem = true`). The `penaltyPrice` state variable and all related markup/computation have been removed. |
| `RestRoomOverlay.svelte` | Rest room: heal HP, study to upgrade a card, meditate to remove one. Calls `ambientAudio.setContext('rest')` on `$effect` |
| `MysteryEventOverlay.svelte` | Mystery event: narrative choice cards with quiz-gated outcomes. Calls `ambientAudio.setContext('mystery')` on `$effect` when event is set. **`buildStudyFacts()` trivia fallback (2026-04-08, task 13.2b):** When `deckMode.type === 'study'`, pulls 3 random facts from the curated deck (existing behavior). When in trivia dungeon mode (no study deck), falls back to `factsDB.getTriviaFacts()` — excludes language/vocab facts and picks 3 random from the trivia pool. Both branches shuffle then slice(0,3). |
| `SpecialEventOverlay.svelte` | Scripted lore/mechanic special events |
| `PostMiniBossRestOverlay.svelte` | Post-mini-boss rest: auto-heal + optional card upgrade |
| `MeditateOverlay.svelte` | Meditate rest option: pick a card to permanently remove |
| `UpgradeSelectionOverlay.svelte` | Rest-room card upgrade: pick one card from candidates |
| `MultiChoicePopup.svelte` | Generic multi-choice modal for event branching and onboarding |
| `NarrativeOverlay.svelte` | Full-screen atmospheric narrative overlay for room transitions and NPC dialogue. **Auto-reveal (2026-04-08):** Lines appear automatically without requiring clicks. `AUTO_REVEAL_START_DELAY = 800ms` before first line (lets overlay fade-in finish). `AUTO_REVEAL_DELAY = 400ms` between successive lines. After all lines reveal, narration stays until player clicks to dismiss. Clicking during auto-reveal cancels the timer and jumps all lines to fully visible (final state). State machine: **REVEALING** (lines appear via auto-reveal) → **DISSOLVING** (ash animation, clicks ignored) → **DONE** (onDismiss fired). Click mid-animation on last line skips to fully visible; click when last line settled begins dissolve. Hint "click to dismiss" shown only after last line settles. Entrance keyframe: `lineReveal` 0.8s (opacity 0→1, translateY 12px→0, scale 0.95→1, glow pulse at 60%). Exit keyframe: `ashDissolve` 0.8s per line, staggered 0.15s, blur+float+letter-spacing expansion. Text: 22px, max-width calc(1100px * var(--layout-scale, 1)), gap calc(28px * var(--layout-scale, 1)). Props: `lines: NarrativeLine[]`, `mode?: 'auto-fade' | 'click-through'` (kept for API compat, always ignored), `onDismiss: () => void`. z-index 950. Driven by `narrativeStore.ts` (`showNarrative()` / `dismissNarrative()`). **Wired into `CardApp.svelte`** — gated by `$narrativeDisplay.active`, renders above other overlays at z-index 950. See docs/mechanics/narrative.md §Display System. |

---

## Rewards & Progression

| Component | Purpose |
|-----------|---------|
| `CardRewardScreen.svelte` | Post-combat reward: animated gold/heal reveal then 3-card pick. **Landscape sizing (2026-04-01):** `.altar-shell` width `min(80vw, 1200px)`, scale 1.5 (was 65vw/900px/1.15). `.altar-option` min-height 300px (was 200px), padding 54/15/18px (was 36/10/12px). `.altar-options` gap 24px (was 16px). `.mini-card-name` 20px (was 15px). `.mini-card-desc` 16px (was 12px). |
| `RewardCardDetail.svelte` | Expanded detail for a single reward card (RewardRoomScene). Renders an identical V2 card frame to CardHand.svelte. AP cost font: `var(--card-w) * 0.14`. Effect text uses `'Kreon', 'Georgia', serif` matching CardHand. Adaptive size classes: `effect-text-md` (>15 chars), `effect-text-sm` (>25), `effect-text-xs` (>35) computed by `effectTextSizeClass()`. `.desc-number` inherits font/color from parent (no override). **Card type area (2026-04-08):** replaced text label with an empty colored pill using `GUIDE_STYLES.cardTypePill` and `getChainColor(card.chainType)` — matches the CardHand pill exactly; no `pill-chain-active` class (no active chain context in reward). The `.v2-card-type` CSS text block (font/color/letter-spacing/text-transform/ellipsis) has been removed. **Description line-break rendering (2026-04-08):** description parts are processed through `groupIntoLines()` before iteration, wrapping each group in a `<div class="desc-line">`. When `cardDescriptionService` emits `\n` inside a text part, clauses break onto separate lines. `.desc-line { display: block; width: 100%; }` added to CSS. **V2 frame refactor (2026-04-09):** All v2 card frame rendering extracted to `CardVisual.svelte` — CardHand no longer contains the frame template or CSS. Each card slot in CardHand renders `<CardVisual {card} effectValue={effectVal} {isChargePreview} {isBtnChargePreview} {modState} masteryFlash={...} {displayedApCost} {apGemColor} chainPillActive={...} />`. Animating (fly-out) instances use `<CardVisual {card} />` with no special props. Cross-boundary interaction styles use `:global()`: `.card-in-hand.insufficient-ap :global(.v2-ap-cost)` for red AP pulse, `:global(.card-selected .card-v2-frame)` for pointer-events none on selected card. |
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
| `RelicPickupOverlay.svelte` | Relic acquisition: accept or decline a found relic. **Buttons (2026-04-08):** "Take" renamed to "Accept" to match card reward convention. Both `.btn-take` and `.btn-leave` use `min-width: calc(140px * var(--layout-scale, 1))` and identical padding (`12px/28px`) for equal sizing — they are `flex-direction: row` horizontally. `.btn-leave` is now red (`background: #dc2626`, hover `#991b1b`, `color: #fff`) instead of grey, making it clearly a rejection action. Base font size for `.relic-description` and `.relic-effect-line` increased from 14px/12px to 20px; button font from 16px to 20px. |
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

---

## Hub Screens (Profile & Journal)

| Component | Purpose |
|-----------|---------|
| `JournalScreen.svelte` | Expedition Log — two-column run history browser with detailed per-run cards. See `docs/ui/screens.md` for full section spec. |
| `ProfileScreen.svelte` | Scholar's Profile — 8-section meta-progression dashboard. See `docs/ui/screens.md` for full section spec. |

### JournalScreen

- **Props**: `summary: RunSummary | null`, `onBack: () => void`
- **Layout**: Fixed `inset: 0`, flex column. Landscape: `grid-template-columns: 3fr 2fr` body.
- **State**: `selectedIndex: number` (which run row is active), `filterResult: 'all' | 'victory' | 'defeat' | 'retreat'`
- **Derived**: `filteredHistory` (runHistory filtered by result), `displayedRun` (filteredHistory[selectedIndex] or summary prop fallback)
- **Data**: Reads `$playerSave.runHistory` reactively; falls back to `summary` prop for legacy callers.
- **Scaling**: All dimensions `calc(Npx * var(--layout-scale, 1))`, fonts `calc(Npx * var(--text-scale, 1))`. Landscape overrides via `.journal-landscape` class selector (not `:global([data-layout="landscape"])`) — avoids dependency on `data-layout` attribute timing.

### ProfileScreen

- **Props**: `onBack: () => void`
- **Layout**: Fixed `inset: 0`, flex column with scrollable body. Landscape: 2-column CSS grid in `.profile-body`.
- **Data**: `$playerSave` + `$activeProfile` stores. Calls `getAllDeckProgress()` inline (synchronous, reads `playerSave` via `get()`).
- **Mastery classification**: Uses `getCardTier(reviewState)` from `tierDerivation.ts` — tier '3' = mastered.
- **Domain accuracy**: Aggregated by summing `correct`/`answered` across all `runHistory[].domainAccuracy` entries.
- **Deck progress**: Filters `getAllDeckProgress()` to entries with `factsEncountered > 0`, sorted by encounters desc.
- **Bestiary**: From `save.lifetimeEnemyKillCounts` — top 5 sorted by kill count desc.
- **Scaling**: Same rules as JournalScreen. Landscape tile grids expand from 2-column to 4-column for record/mastery/streak tiles.

---

## UI Utilities — Card Art

### `src/ui/utils/cardArtManifest.ts`

Single source of truth for card art files. Maps mechanic IDs to PNG filenames under `/assets/cardart/`.

**Exports:**
- `getCardArtUrl(mechanicId: string): string | null` — returns `/assets/cardart/X.png` or `null` if no art.
- `hasCardArt(mechanicId: string): boolean` — fast existence check.
- `CARD_ART_MECHANIC_IDS: readonly string[]` — all mechanic IDs with art (derived from `Object.keys(CARD_ART_MAP)`).

**CARD_ART_MECHANIC_IDS usage:** Imported by `RewardRoomScene.ts` in Phaser to preload all card art textures during `preload()`. This keeps the Phaser preload list automatically in sync with the manifest — adding a new art entry here is the only change needed. Previously the Phaser scene had a hardcoded subset of 31 IDs (out of 96+), causing card art to silently disappear on the reward cloth for any mechanic not in the hardcoded list (2026-04-08 fix).

**Rule:** Never maintain a separate list of mechanic IDs in any Phaser scene — always import `CARD_ART_MECHANIC_IDS`.
