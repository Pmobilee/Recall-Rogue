# UI Component Catalog

> **Purpose:** Gameplay-critical Svelte components: Combat UI, Quiz & Study, Hub & Navigation, Dungeon & Map, Card Management, Rooms & Events, Rewards & Progression, Relics.
> **Last verified:** 2026-03-31
> **Source files:** `src/ui/components/**/*.svelte` (181 files), `src/CardApp.svelte`

> **See also:** [`components-social.md`](components-social.md) — Social & Multiplayer, Profile & Account, Auth & Legal, Monetization & Seasons, Onboarding & Cutscenes, Utility & Effects.

---

## Combat UI

| Component | Purpose |
|-----------|---------|
| `CardHand.svelte` | Renders the player's hand with V2 card frames, art, mastery glow, chain color groups, and damage-modifier coloring (green=buffed, red=nerfed via `damagePreviews` prop) |
| `CardCombatOverlay.svelte` | Root combat screen: wraps CardHand + QuizOverlay, handles surge/boss phases, landscape/portrait. Computes `damagePreviews` via `damagePreviewService` and passes to CardHand |
| `CombatHUD.svelte` | Legacy HP bars + combat log; largely superseded by InRunTopBar |
| `InRunTopBar.svelte` | Landscape/Portrait HUD: HP bar, shield badge, gold, floor/segment, relic tray, fog level, pause. Inline player status effect icons (poison, burn, etc.) to the right of the HP bar — hover to show per-icon popup. `.hp-group` uses `flex: 1 0 auto` (never shrinks when icons are added). Icon size matches HP bar height (`var(--topbar-height) * 0.58`). Status popup is per-wrapper positioned below each icon on hover; backdrop click pattern removed. `.section-left` uses `max-width: 35%`. Accepts optional `statusEffects` prop (from `topBarPlayerEffects` derived in CardApp.svelte). |
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
| `HubScreen.svelte` | Main hub: campfire, NPC sprites, run summary, navigation entry points |
| `HubNavBar.svelte` | Bottom navigation bar (Library, Profile, Social, Leaderboards) |
| `HubVisitorView.svelte` | Visitor profile view when browsing another player's hub |
| `CampHudOverlay.svelte` | HUD overlay on the hub: streak, gold, XP progress bar |
| `CampSpriteButton.svelte` | Clickable NPC sprite button in the hub scene. Supports `spriteOffsetX`/`spriteOffsetY` props for CSS translate repositioning without re-rendering art assets (used for landscape-only layout adjustments) |
| `CampSpeechBubble.svelte` | Speech bubble overlay for hub NPC characters |
| `CampfireCanvas.svelte` | Canvas-based animated campfire flicker effect |
| `CampfirePause.svelte` | In-run pause menu: resume / return to hub, run stats |
| `CampUpgradeModal.svelte` | Modal for purchasing permanent camp upgrades |
| `FireflyBackground.svelte` | Ambient animated firefly particles on the global background |
| `DomeCanvas.svelte` | Starfield dome canvas rendered behind the hub |
| `LoginCalendar.svelte` | Daily login streak calendar widget |
| `AnnouncementBanner.svelte` | Scrolling banner for server announcements / seasonal events |
| `WelcomeBackOverlay.svelte` | Overlay shown after a multi-day absence |

---

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
