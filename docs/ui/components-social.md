# UI Components — Social, Account & Utility

> **Purpose:** Non-gameplay Svelte components: social, auth, monetization, onboarding, and utility
> **Last verified:** 2026-04-07
> **Source files:** `src/ui/components/**/*.svelte`

> **See also:** [`components.md`](components.md) — Gameplay-critical components: Combat UI, Quiz & Study, Hub & Navigation, Dungeon & Map, Card Management, Rooms & Events, Rewards & Progression, Relics.

---

## Social & Multiplayer

| Component | Purpose |
|-----------|---------|
| `SocialScreen.svelte` | Social hub: friends list, guilds, challenges, guestbook |
| `CoopHUD.svelte` | Co-op mode HUD showing partner HP and sync state |
| `CoopEmoteToast.svelte` | Short-lived toast for a co-op partner emote |
| `CoopLobby.svelte` | Co-op lobby: invite friends, set rules, ready check |
| `CoopMatchmaker.svelte` | Matchmaking screen for finding co-op partners |
| `CoopLootSummary.svelte` | Post-co-op loot split summary |
| `CoopRecoveryBanner.svelte` | Banner when a co-op partner disconnects |
| `DuelView.svelte` | 1v1 knowledge duel battle view |
| `DuelInviteModal.svelte` | Modal for sending/accepting duel invitations |
| `GuildView.svelte` | Guild profile and management view |
| `GuildInviteModal.svelte` | Modal for inviting players to a guild |
| `LeaderboardView.svelte` | Single leaderboard table component |
| `LeaderboardsScreen.svelte` | Full leaderboards screen with tabs (global, friends, guild, season) |
| `SeasonLeaderboard.svelte` | Season-specific leaderboard |
| `TradeMarketView.svelte` | Card trading marketplace browse view |
| `TradeOfferModal.svelte` | Modal for creating or reviewing a trade offer |
| `GuestbookModal.svelte` | Hub guestbook: leave messages on other players' hubs |
| `MultiplayerMenu.svelte` | Full-screen multiplayer entry screen shown before the lobby. Two tabs: **Create Lobby** (5 mode cards with display name, tagline, description, and player count badge; selected card gets gold highlight; "Create Lobby" button at bottom) and **Join Lobby** (monospace 6-char code input, auto-uppercase, "Join Lobby" button disabled until 6 chars entered, inline error message). Props: `onBack: () => void`, `onCreateLobby: (mode: MultiplayerMode) => void`, `onJoinLobby: (code: string) => void`. Local state: `selectedMode` (default `'race'`), `joinCode`, `activeTab`, `joinError`. Navigated to from the hub "Multiplayer" button via `handleOpenMultiplayer()` in CardApp.svelte. **Added 2026-04-07.** |
| `MultiplayerLobby.svelte` | Full-screen multiplayer lobby: mode selection (5 modes), player list with ready check, host-editable house rules (turn timer / quiz difficulty / fairness options / ranked), **rich content selection** (replaces bare deck ID input). Props: `lobby: LobbyState`, `localPlayerId: string`, `onBack: () => void`. Host-only controls are disabled (read-only) for non-host players. **Content section (2026-04-07):** "Deck" section replaced with "Content" section — shows type badge (Study Deck/Trivia Mix/Custom Deck) + name, plus a "Choose Content" / "Change Content" gold button (host-only) that opens the `LobbyDeckPicker` modal. Deck selection mode radios (Host Picks/Each Picks/Random) remain. The old deck ID text input and `handleDeckInput`/`deckIdInput` state are removed. **Wired into app flow (2026-04-06):** navigated to via `screen: 'multiplayerLobby'`. |
| `LobbyDeckPicker.svelte` | Full-screen modal overlay for selecting multiplayer lobby content. **Three tabs:** Study Decks (3-column grid of curated deck cards with gradient color bar, name, fact count, gold border on selected; search bar; sub-deck selector appears when a deck with sub-decks is selected), Trivia Mix (4-column grid of domain cards with domain color tint, icon, name; multi-select toggles; selected count summary), My Decks (list of custom decks from `PlayerSave.lastDungeonSelection.customDecks`; **"+ Create New" outlined gold button** at top of tab — toggles an info hint message "Visit Study Temple from the hub to create custom decks."; always visible even when custom decks are present; empty state message if none). Footer shows selection summary + Cancel/Confirm buttons (Confirm disabled until a selection is made). Props: `onSelect: (selection: LobbyContentSelection) => void`, `onClose: () => void`. Backdrop click and Escape key both close the modal. All sizing via `calc() * var(--layout-scale/--text-scale)`. **Added 2026-04-07.** |
| `MultiplayerHUD.svelte` | Race Mode opponent progress HUD — compact fixed overlay (top-right, 260px wide). Compact mode shows name + floor badge + mini HP bar. Expands on click to show full HP bar, score, accuracy, encounters won, and status pill (In Combat / Finished). Props: `progress: RaceProgress`, `displayName: string`. HP bar transitions smoothly with CSS. **Wired into app flow (2026-04-07):** shown in the `combat` screen block when `isMultiplayerRun` is true (i.e. `currentLobby !== null`). Passes live `opponentProgress` $state (updated via `onOpponentProgressUpdate` from `multiplayerGameService`) and `opponentDisplayName` $state. Display name resolved from lobby player list on game start via `registerGameStartCb` (`onGameStart` alias). Both subscriptions are managed in a single `$effect` cleanup block in `CardApp.svelte`. **Content wiring (2026-04-07):** `registerGameStartCb` callback now reads `lobby.contentSelection` and calls `playerSave.update()` + `persistPlayer()` before `startNewRun()` — maps `LobbyContentSelection` to the matching `DeckMode` (`study`, `trivia`, or `custom_deck`). Custom deck items are resolved from `PlayerSave.lastDungeonSelection.customDecks` and filtered to study items only. |
| `DuelOpponentPanel.svelte` | Real-Time Duel live opponent state panel — fixed left-side overlay (~280px wide), vertically centered. Sections: opponent name + HP bar; damage contribution bar (two-color, blue=you vs red=them, with live % labels — the competitive star visual); chain state (color dot + length + name); last-turn summary (cards played, damage dealt, quiz result pill); circular SVG turn timer (stroke-dashoffset animates 0→circumference as time runs out, color shifts green→amber→red); enemy target indicator (flashes red with pulse animation when targeting local player). Props: `opponentName`, `opponentHp`, `opponentMaxHp`, `localDamageTotal`, `opponentDamageTotal`, `opponentChainLength`, `opponentChainColor?`, `lastTurnSummary?` (`cardsPlayed`, `damageDealt`, `quizResult: 'correct'|'wrong'|'quick_play'`), `turnTimerSecs`, `turnTimerMax`, `enemyTargetIsLocal`. All sizing via `calc() * var(--layout-scale/--text-scale)`. |
| `RaceResultsScreen.svelte` | Full-screen race/duel results overlay shown when both players finish. Centered card (~820px). Sections: mode label header; large VICTORY (green glow) / DEFEAT (red glow) banner with flavor subtitle; side-by-side stat comparison table (Score, Floor Reached, Accuracy, Facts Answered, Correct, Duration) with winner-column gold highlight, per-row green arrow on the better value; collapsible score breakdown table (Floors×100, Correct×10, Wrong×-5, total); three action buttons (Play Again / Return to Lobby / Return to Hub). Props: `results: RaceResults`, `localPlayerId: string`, `mode: 'race'|'same_cards'|'duel'`, `onPlayAgain`, `onReturnToLobby`, `onReturnToHub`. Duration formatted as M:SS. All sizing via `calc() * var(--layout-scale/--text-scale)`. |
| `TriviaRoundScreen.svelte` | Full-screen Trivia Night round overlay for 2-8 players. Three phases: **question** (large question text, 2×2 color-coded answer buttons A/B/C/D, circular SVG countdown timer that pulses red under 5 s, "Waiting..." message after local answer); **revealing** (correct answer green glow + checkmark, wrong answer red + X, other options dimmed, animated points pop-up, per-player results table with timing and points earned); **finished** (winner spotlight with crown + CSS confetti if local player won, full leaderboard table with rank/name/points/accuracy/avg-time, three action buttons). Props: `gameState: TriviaGameState`, `localPlayerId: string`, `currentQuestion: TriviaQuestion | null`, `lastRoundResult: TriviaRoundResult | null`, `onAnswer(selectedIndex, timingMs)`, `onPlayAgain`, `onReturnToLobby`, `onReturnToHub`. Delegates all scoring to `triviaNightService`. All sizing via `calc() * var(--layout-scale/--text-scale)`. |

---

## Profile & Account

| Component | Purpose |
|-----------|---------|
| `ProfileScreen.svelte` | Player profile: stats, badges, knowledge tree, run history |
| `AccountSettings.svelte` | Account settings: password, linked accounts, delete account |
| `SettingsPanel.svelte` | In-game settings: audio, accessibility, notifications, account. `.settings-overlay` background is fully opaque `rgb(5, 9, 16)` — prevents Phaser combat scene bleed-through (changed from `rgba(5, 9, 16, 0.88)` 2026-04-06). **Accessibility tab** includes a Fullscreen toggle (hidden on mobile/Capacitor). Uses `fullscreenService.ts` — Tauri API on desktop, standard Fullscreen API on web. State syncs via `fullscreenchange` DOM event so external ESC-to-exit is reflected. F11 keyboard shortcut also triggers toggle globally (registered in `main.ts`). **Audio tab** includes SFX, Music, and Ambient controls — `ambientEnabled` toggle (checkbox) and `ambientVolume` slider (0-100%) appear after the Music Volume row in both landscape and portrait layouts. |
| `InterestAssessment.svelte` | Onboarding interest quiz to pre-select relevant domains |
| `InterestSettings.svelte` | Settings panel for updating domain interest preferences |
| `LanguageModePanel.svelte` | Language learning mode toggle and configuration |
| `LanguageProgressPanel.svelte` | Per-language vocabulary progress visualization |
| `LanguageSelector.svelte` | Picker for the active language deck |
| `RadarChart.svelte` | Radar chart of domain knowledge balance on profile |
| `SparklineChart.svelte` | Mini sparkline chart for progress trends |
| `WeeklyChallenge.svelte` | Weekly challenge widget with progress and rewards |
| `WeeklyReportPreview.svelte` | Preview card for the weekly learning report |
| `ReportModal.svelte` | Full weekly/monthly learning report modal |
| `GaiaReport.svelte` | Gaia AI companion's narrative learning report |
| `ReviewPromptTrigger.svelte` | Triggers App Store / Play Store review prompt at appropriate moments |

---

## Auth & Legal

| Component | Purpose |
|-----------|---------|
| `auth/LoginView.svelte` | Email + password login form |
| `auth/RegisterView.svelte` | New account registration form |
| `auth/ForgotPasswordView.svelte` | Password reset request form |
| `auth/ProfileView.svelte` | Authenticated user profile summary view |
| `profiles/ProfileSelectView.svelte` | Multi-profile switcher screen |
| `profiles/ProfileCreateView.svelte` | New profile creation form (child/adult) |
| `profiles/ProfileManageView.svelte` | Manage existing profiles (rename, delete, PIN) |
| `legal/AgeGate.svelte` | Age verification gate before account creation |
| `legal/PrivacyPolicy.svelte` | In-app privacy policy document view |
| `legal/TermsOfService.svelte` | In-app terms of service document view |
| `AgeSelection.svelte` | Age bracket selection (Kid / Teen / Adult) for content filtering |
| `ATTConsentPrompt.svelte` | iOS App Tracking Transparency consent prompt |
| `SignInWithApple.svelte` | Apple Sign-In button and OAuth handler |
| `ParentalControlsPanel.svelte` | Parental controls: session limits, content filters, PIN lock |
| `ParentalControlsOverlay.svelte` | Overlay gate for parental-restricted areas |
| `ParentalPinGate.svelte` | PIN entry gate for parental-lock protection |
| `SessionWarningBanner.svelte` | Banner when approaching parental session time limit |

---

## Monetization & Seasons

| Component | Purpose |
|-----------|---------|
| `RoguePassModal.svelte` | Rogue Pass (battle pass) purchase and tier view modal |
| `SeasonPassView.svelte` | Season pass overview: tiers, rewards, XP progress |
| `CosmeticStoreModal.svelte` | Cosmetic shop: card backs, hub skins, emotes |
| `PioneerPackModal.svelte` | Early-access Pioneer Pack offer modal |
| `SeasonBanner.svelte` | Persistent season name/end-date banner at hub top |
| `PartnerPortalView.svelte` | Partner/educator portal for class management |
| `ClassJoinPanel.svelte` | Panel for students joining a teacher's class via code |
| `UGCReviewQueue.svelte` | User-generated content review queue for moderators |
| `UGCSubmitOverlay.svelte` | Overlay for submitting a user-generated fact for review |
| `ReferralModal.svelte` | Referral code share modal |
| `GiftModal.svelte` | Gift a subscription / relic / cosmetic to another player |

---

## Onboarding & Cutscenes

| Component | Purpose |
|-----------|---------|
| `OnboardingCutscene.svelte` | Full first-time onboarding cutscene with Gaia introduction |
| `GaiaIntro.svelte` | Gaia companion introduction animation and voice-over |
| `CutscenePanel.svelte` | Generic cutscene panel: image + dialogue + continue button |

---

## Utility & Effects

| Component | Purpose |
|-----------|---------|
| `ErrorBoundary.svelte` | Svelte error boundary: catches render errors, shows fallback UI |
| `WebGLFallback.svelte` | Fallback screen when WebGL is unavailable |
| `ParallaxTransition.svelte` | WebGL depth-parallax room transition (enter / exit-forward / exit-backward) |
| `OfflineToast.svelte` | Toast for network offline / back-online state changes |
| `SyncIndicator.svelte` | Small icon for cloud sync status (syncing / synced / error) |
| `PwaInstallPrompt.svelte` | PWA "Add to Home Screen" install prompt |
| `NotificationPermissionPrompt.svelte` | Push notification permission request dialog |
| `ContextMenu.svelte` | Generic right-click / long-press context menu |
| `KeywordPopup.svelte` | Tooltip popup showing a keyword definition on hover/tap |
| `KeyboardShortcutHelp.svelte` | Overlay listing all keyboard shortcuts for desktop |
| `OverflowLabel.svelte` | Label that truncates with an expand-on-click behavior |
| `ShareCardModal.svelte` | Share a card's fact as a social image |
| `FeedbackButton.svelte` | Floating "Send Feedback" button |

---

## Services

### fullscreenService.ts

`src/services/fullscreenService.ts` — Fullscreen toggle for Steam PC / desktop and web.

| Export | Signature | Description |
|--------|-----------|-------------|
| `toggleFullscreen` | `() => Promise<boolean>` | Toggle fullscreen. Returns new state (true = fullscreen). No-op on mobile (Capacitor). |
| `isFullscreen` | `() => Promise<boolean>` | Returns current fullscreen state. |

Platform behavior:
- **Desktop (Tauri):** uses `@tauri-apps/api/window` `getCurrentWindow().setFullscreen()` — dynamically imported so it tree-shakes on web
- **Web:** standard `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`
- **Mobile (Capacitor):** returns `false` immediately — Capacitor manages fullscreen via native manifest

F11 global shortcut registered in `src/main.ts` via `window.addEventListener('keydown')` — calls `void toggleFullscreen()`, preventDefault to suppress browser default behavior.

### triviaNightService.ts

`src/services/triviaNightService.ts` — Pure quiz party mode service for 2-8 players. No combat, no cards, no FSRS.

| Export | Description |
|--------|-------------|
| `initTriviaGame(players, totalRounds, isHost)` | Initialize game state for all players. Call once when host starts the game. |
| `hostNextQuestion(factId, question, options, correctIndex, domain?, difficulty?)` | Host broadcasts next question via `mp:trivia:question`. Starts auto-resolve timer (DEFAULT_TIME_LIMIT + 500 ms grace). |
| `submitAnswer(selectedIndex, timingMs)` | Local player submits answer via `mp:trivia:answer`. Use -1 for timeout. |
| `hostResolveRound()` | Host scores all answers, updates standings, broadcasts `mp:trivia:scores`. Idempotent (no-op if already resolved). |
| `hostEndGame()` | Host broadcasts `mp:trivia:end` with final standings, transitions to `'finished'` phase. |
| `destroyTriviaGame()` | Clears all state and timers on screen unmount. |
| `getTriviaState()` | Returns current `TriviaGameState` or null. |
| `onTriviaQuestion(cb)` | Register callback for incoming questions (non-host). Returns unsubscribe fn. |
| `onTriviaRoundResult(cb)` | Register callback for round results. Returns unsubscribe fn. |
| `onTriviaGameOver(cb)` | Register callback for final standings. Returns unsubscribe fn. |
| `onTriviaStateChange(cb)` | Register callback for any state mutation. Returns unsubscribe fn. |
| `initTriviaMessageHandlers()` | Wire all four `mp:trivia:*` transport listeners. Returns cleanup fn — call on unmount. |
| `calculateTriviaPoints(correct, timingMs, timeLimitMs)` | Pure scoring: CORRECT_POINTS (1000) + linear speed bonus up to SPEED_BONUS_MAX (500). |

Constants: `DEFAULT_ROUNDS=15`, `MIN_ROUNDS=5`, `MAX_ROUNDS=30`, `DEFAULT_TIME_LIMIT=15` s, `CORRECT_POINTS=1000`, `SPEED_BONUS_MAX=500`, `REVEAL_DELAY_MS=3000`.

Transport protocol: `mp:trivia:question` (host→all), `mp:trivia:answer` (player→host), `mp:trivia:scores` (host→all), `mp:trivia:end` (host→all). All four types pre-registered in `multiplayerTransport.ts`.
