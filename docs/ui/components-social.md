# UI Components — Social, Account & Utility

> **Purpose:** Non-gameplay Svelte components: social, auth, monetization, onboarding, and utility
> **Last verified:** 2026-04-22 (MpDebugOverlay REMOVED — log-only diagnostics. Added forensic contentSelection logging in MultiplayerLobby. Updated onLobbyUpdate to explicitly spread contentSelection for Svelte reactivity. Also: error banner, visibility picker, PlayerRosterPanel.. BUG-13: game-start guard extended to require mode+deckId+contentSelection; mp-error-banner added to multiplayerLobby screen.)
> **Source files:** `src/ui/components/**/*.svelte`

> **See also:** [`components.md`](components.md) — Gameplay-critical components: Combat UI, Quiz & Study, Hub & Navigation, Dungeon & Map, Card Management, Rooms & Events, Rewards & Progression, Relics.

---

## Social & Multiplayer

| Component | Purpose |
|-----------|---------|
| `SocialScreen.svelte` | Social hub: leaderboards (daily expedition, endless depths, scholar challenge), co-op lobby creation, duels, guilds, relic sanctum access, weekly challenges. Full screen with parental-control gate and back button. Props: see source. **Wiring status (2026-04-11): SUPPRESSED** — social nav tab deliberately removed from HubNavBar (2026-04-07); wiring requires adding `social` to Screen union and adding gameFlowController callbacks (onStartDailyExpedition, onStartEndlessDepths, onStartScholarChallenge, onOpenRelicSanctum) which is game-logic agent work; scheduled post-Steam-launch with full social feature wave. Carries `@wiring-check:skip` suppression comment to silence the orphan-screen lint. |
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
| `MultiplayerMenu.svelte` | Full-screen multiplayer entry screen shown before the lobby. Three tabs: **Create Lobby** (5 mode cards with display name, tagline, description, and player count badge; selected card gets gold highlight; "Create Lobby" button at bottom), **Join Lobby** (monospace 6-char code input, auto-uppercase, "Join Lobby" button disabled until 6 chars entered, inline error message), and **LAN Play** (added 2026-04-15). Props: `onBack: () => void`, `onCreateLobby: (mode: MultiplayerMode, opts: { visibility: LobbyVisibility; password?: string }) => void`, `onJoinLobby: (code: string) => void`, **`onBrowseLobbies: () => void`**. **Visibility picker (2026-04-20):** Added below mode list in Create tab. Three radio pills (Public / Password / Friends Only) — same pill pattern as MultiplayerLobby. Default: `'public'`. When `password` selected, a password input row appears (min 4 chars, show/hide toggle, validated on submit — shows inline error 'Required' or 'Min 4 characters'). `friends_only` pill disabled when `!hasSteam` with tooltip 'Steam only — invite friends via code instead.' Password field clears on visibility change. The `handleCreateLobby` internal function collects visibility+password into the opts object before calling `onCreateLobby`. `data-testid="create-visibility"` on the section; `data-testid="create-password-input"` on the password input. Local state: `selectedMode` (default `'race'`), `joinCode`, `activeTab` (`'create' | 'join' | 'lan'`), `joinError`. Navigated to from the hub "Multiplayer" button via `handleOpenMultiplayer()` in CardApp.svelte. **LAN Play tab (2026-04-15):** Two stacked sections. *Host a LAN Game* — Tauri/desktop only; shows a platform note on web. "Start LAN Server" button calls `startLanServer()` from `lanServerService`; on success calls `setLanServerUrl(ip, port)` and shows green dot + IP:port status. "Stop Server" button calls `stopLanServer()` + `clearLanServerUrl()`. When server is running, a mode selector + "Create Lobby" button lets the host launch a game on the LAN server. `getLanServerStatus()` is called on mount to detect a server already running from a prior session. *Join a LAN Game* — available on all platforms. Scans automatically on tab activation via `scanLanForServers()`; shows "Scanning your network…" while in progress. Discovered servers appear as a list with hostname/IP:port and a "Connect" button (calls `setLanServerUrl()` then `onBrowseLobbies()`). "Rescan Network" button re-runs discovery. Manual IP/port entry row (IP field + port pre-filled with `LAN_DEFAULT_PORT`) with a "Connect" button that calls `probeLanServer()`; shows inline error on failure. When `isLanMode()` is true, a green banner at the top of the LAN panel shows the active server URL with a "Disconnect" button. Services used: `lanServerService`, `lanConfigService`, `lanDiscoveryService`, `platformService`. **Browse Lobbies button (2026-04-11):** A gold `.browse-btn` button (globe emoji + "Browse Lobbies" label) appears in the `.create-footer` row alongside the "Create Lobby" button; calls `onBrowseLobbies`. **Dev badge (2026-04-07):** When `isBroadcastMode()` returns true (i.e. `?mp` is in the URL), a red `.dev-badge` pill reading "DEV MODE — Two-Tab Testing (30-150ms simulated latency)" is shown in the header. **data-testid attributes:** `tab-create`, `tab-join`, `tab-lan` (tab buttons), `mode-{mode}` (each mode `<li>`), `create-visibility` (visibility section), `create-password-input` (password input when visibility=password), `btn-create-lobby`, `btn-browse-lobbies`, `join-code-input`, `btn-join-lobby`, `btn-start-lan-server`, `btn-stop-lan-server`, `btn-lan-create-lobby`, `btn-rescan`, `lan-server-{i}` (each discovered server row), `btn-connect-lan-{i}` (per-server connect button), `lan-ip-input`, `lan-port-input`, `btn-manual-connect`, `btn-lan-disconnect`. **Error banner (2026-04-20):** When a `createLobby` or `joinLobby` call throws in `CardApp.svelte`, `multiplayerError` state is set and a `.mp-error-banner` div (`data-testid="mp-error-banner"`, `role="alert"`) renders at the top of the screen with the error message and a dismiss (✕) button. Cleared on dismiss, back navigation, tab switch, or re-attempt. Error messages: `"Couldn't create lobby. ${detail}"` (create) and `"Couldn't join that lobby. ${detail}"` (join), where `detail` is `error.message` (or `String(error)` for non-Error throws) — raw runtime diagnostic text appended after the opening human copy for in-context debugging. The `.mp-error-banner` is also rendered in the `multiplayerLobby` screen block (BUG-13, 2026-04-22) so game-start validation failures that call `transitionScreen("multiplayerLobby")` surface the error in the lobby view rather than silently dropping it. |
| `MultiplayerLobby.svelte` | Full-screen multiplayer lobby: mode selection (5 modes), player list with ready check, host-editable house rules (turn timer / quiz difficulty / fairness options / ranked), **rich content selection** (replaces bare deck ID input). Props: `lobby: LobbyState`, `localPlayerId: string`, `onBack: () => void`. Host-only controls are disabled (read-only) for non-host players. **Content section (2026-04-07):** "Deck" section replaced with "Content" section — shows type badge (Study Deck/Trivia Mix/Custom Deck) + name, plus a "Choose Content" / "Change Content" gold button (host-only) that opens the `LobbyDeckPicker` modal. Deck selection mode radios (Host Picks/Each Picks/Random) remain. **Visibility controls (2026-04-11):** Host sees a tri-state pill row (Public / Password / Friends Only) that calls `setVisibility(v)` from `multiplayerLobbyService`. "Friends Only" pill is disabled with "Steam only" title when `hasSteam` is false. When `visibility === 'password'`, a password input row appears below the pills: text field (min 4 chars, show/hide eye toggle, commits on blur via `setPassword()`), backed by SHA-256 hashing in the service. **Max Players pills (2026-04-11):** Pill row generated from `MODE_MIN_PLAYERS[mode]` to `MODE_MAX_PLAYERS[mode]` range; calls `setMaxPlayers(n)`. Disabled and single-value for `duel` and `coop` modes (fixed player counts). **Lobby header badge (2026-04-11):** A lock emoji badge (🔒) appears next to the lobby code when `visibility === 'password'`; a people emoji badge (👥) when `visibility === 'friends_only'`. Both use `.vis-badge` CSS class. New state: `passwordInputValue`, `showPasswordText`. New derived: `maxPlayersRange` (`$derived.by`), `isMaxPlayersFixed` (`$derived`). **Wired into app flow (2026-04-06):** navigated to via `screen: 'multiplayerLobby'`. **Dev bot buttons (2026-04-07):** host-only "+ Add Bot" button appears between the player list and action buttons when slots are still open; calls `addLocalBot()` from `multiplayerLobbyService`. A small ✕ remove button appears inline on any player slot whose ID starts with `bot_`, calling `removeLocalBot()`. Both buttons styled with dashed gold / red-on-hover treatment. **Dev badge (2026-04-07):** When `isBroadcastMode()` returns true (i.e. `?mp` is in the URL), a red `.dev-badge` pill reading "DEV MODE" is shown in the header after the h1 title. Uses `let devMode = $derived(isBroadcastMode())`. Same `.dev-badge` CSS as `MultiplayerMenu.svelte`. **data-testid attributes (2026-04-13):** `lobby-code` (copy button), `player-slot-{index}` (each player slot, uses `{#each}` index), `btn-ready`, `btn-start-game`, `visibility-toggle` (pill row), `password-input`, `max-players` (pill row), `btn-deck-picker`, `btn-leave-lobby`, `btn-add-bot`. |
| `LobbyBrowserScreen.svelte` | Full-screen public lobby browser. **Added 2026-04-11.** Props: `localPlayerId: string`, `localDisplayName: string`, `onBack: () => void`, `onJoined: (lobby: LobbyState) => void`. State: `lobbies` (`LobbyBrowserEntry[]`), `modeFilter` (`'all' | MultiplayerMode`), `fullnessFilter` (`'any' | 'open'`), `passwordModalEntry` (`LobbyBrowserEntry | null`), `passwordInput`, `joinError`, `loading`. Auto-refreshes every 5 s via `setInterval` in `$effect` with cleanup return; calls `listPublicLobbies(filter)` from `multiplayerLobbyService`. Filter bar: mode select (all + 5 modes) and fullness select (any/open-only). Lobby grid: 3-column responsive card grid with host name, mode badge, player count (e.g. 2/4), visibility badge (🔒 if password-protected), and a Join button disabled when the lobby is full. Clicking a password-protected lobby opens an inline password modal overlay (input + Submit/Cancel); submit calls `joinLobbyById(entry.lobbyId, localPlayerId, localDisplayName, password)`. Non-password lobbies join directly. `onJoined` fires on success. Softlock prevention: Back button always rendered (`data-testid` equivalent) even in loading, error, and empty states. Empty state div has `data-testid="lobby-browser-empty"`. All sizing via `calc() * var(--layout-scale/--text-scale)`. Uses `fly` transition on mount. Navigated to via `lobbyBrowser` screen state; `onBack` returns to `multiplayerMenu`. **data-testid attributes (2026-04-13):** `btn-back`, `btn-refresh`, `filter-mode` (mode pill group), `lobby-row-{index}` (each lobby card `<li>`, uses `{#each}` index), `btn-join-{index}` (join button per row), `password-modal-input`, `btn-password-submit`, `lobby-browser-empty` (pre-existing). |
| `LobbyDeckPicker.svelte` | Full-screen modal overlay for selecting multiplayer lobby content. **Redesigned Issue 2 (2026-04-11): domain-grouped tabs, multi-select study decks + subdecks, trivia domain picker, selection persists across tab switches.** **Tab bar:** One tab per distinct `deck.domain` value (derived at runtime from loaded curated decks, sorted alphabetically, labeled via `DOMAIN_LABELS` map), plus static "Trivia Mix" and "My Decks" tabs. A gold indicator dot appears on any tab with active selections. **Domain tab content:** List of curated decks for that domain, each as a selectable row with a whole-deck checkbox (checked / indeterminate / unchecked states), gradient color bar, deck name, fact count, and an expand/collapse button when sub-decks exist. Expanded sub-deck list shows individual subdeck buttons with their own checked state (indeterminate on parent means partial subdeck selection). **Trivia Mix tab:** Grid of trivia domain cards (domain color tint, icon, short name) — multi-select toggles, can be combined with study deck selections. **My Decks tab:** List of custom/Anki-imported decks from `PlayerSave.lastDungeonSelection.customDecks`; empty state with "Back to Hub" softlock escape. **State:** `selectedDecks: DeckSelectionMap` (`Map<deckId, Set<subDeckId> | "all">`), `selectedDomains: Set<string>`, `selectedCustomDeckIds: Set<string>` — all persist across tab switches. All mutations REASSIGN (new Map/Set) to trigger Svelte 5 reactivity. **Selection helpers:** `toggleWholeDeck`, `toggleSubDeck`, `deckCheckState`, `isSubDeckSelected`, `buildStudyMultiSelection`, `describeSelection`, `pickerSummary` from `src/ui/utils/lobbyDeckSelection.ts`. **Output:** Emits `LobbyContentSelection` of type `study-multi` (or `custom_deck` for legacy single custom deck). **Footer:** summary line (`pickerSummary`) + Cancel + Confirm (disabled when nothing selected). Props: `onSelect: (selection: LobbyContentSelection) => void`, `onClose: () => void`. Backdrop click and Escape key both close the modal. All sizing via `calc() * var(--layout-scale/--text-scale)`. |
| `MultiplayerHUD.svelte` | Multiplayer opponent progress HUD — compact fixed overlay (**top-left**, 260px wide). Compact mode shows name + floor badge + mini HP bar. Expands on click to show full HP bar, score, accuracy, encounters won (race mode only), and status pill (In Combat / Finished). Props: `progress: RaceProgress`, `displayName: string`, `mode: MultiplayerMode`. **`mode` prop (2026-04-09):** Added `mode: MultiplayerMode` — the Encounters Won row is only rendered when `mode === 'race'`; hidden in co-op since encounters-won is not tracked per-player in that mode. **Position change (2026-04-09):** Moved from top-right to **top-left** (`left: calc(16px * var(--layout-scale, 1)); right: auto`) to avoid colliding with topbar controls. HP bar transitions smoothly with CSS. **Wired into app flow (2026-04-07, updated 2026-04-20):** shown in the `combat` screen block when `isMultiplayerRun` is true AND `!isManyPlayerMode` (i.e. `MODE_MAX_PLAYERS[mode] <= 2`). For modes with more than 2 max players (trivia_night, race 3-4+) the HUD is replaced by `PlayerRosterPanel`. Passes live `opponentProgress` $state (updated via `onOpponentProgressUpdate` from `multiplayerGameService`) and `opponentDisplayName` $state. The `mode` prop is set from `currentLobby?.mode ?? 'race'`. **Co-op partner state (2026-04-09):** `onPartnerStateUpdate` handler now copies `score` and `accuracy` fields from partner state into `opponentProgress` in addition to HP, so the HUD shows meaningful stats in co-op. **Content wiring (2026-04-07, BUG-13 2026-04-22):** `registerGameStartCb` callback reads `lobby.contentSelection` and calls `playerSave.update()` + `persistPlayer()` before `startNewRun()`. Before `startNewRun()` is called, the callback asserts `lobby.mode`, `lobby.selectedDeckId`, AND `lobby.contentSelection` are all present. On failure: `multiplayerError` is set to a message listing the missing fields, `transitionScreen("multiplayerLobby")` is called, and the callback returns early — preventing host/guest divergence on a malformed `mp:lobby:start` payload. **data-testid attributes (2026-04-13):** `mp-hud` (root container), `opponent-hp` (hp-row stat div), `opponent-score` (score stat div). |
| `PlayerRosterPanel.svelte` | Overlay panel listing all other players with HP bars, block, score, and accuracy. **Added 2026-04-20.** Shown instead of `MultiplayerHUD` in modes with more than 2 max players (`trivia_night`, `race` with 3+ players). Opened by clicking the `.roster-trigger-pill` button on the local player's HP bar in `CardCombatOverlay.svelte`. Props: `open: boolean`, `players: Record<string, PartnerState>`, `lobbyPlayers: LobbyPlayer[]`, `localPlayerId: string`, `onclose: () => void`. `otherPlayers` is a `$derived.by` that filters out the local player, resolves display names from `lobbyPlayers`, and sorts by descending HP ratio. Each row shows: name, block badge (when block > 0), HP track (same color logic as solo HP bar: green ≥60%, amber ≥30%, red otherwise), score and accuracy when non-null. Sorted by HP ratio descending (healthiest first). Empty state: "No other players yet." Backdrop click + Escape key both close. Close button always rendered (softlock prevention). HP bar uses `role="progressbar"`. `data-testid` attributes: `roster-panel` (backdrop wrapper), `roster-close-btn` (header X button), `roster-close-btn-footer` (footer Close button), `roster-empty` (empty state p). All sizing via `calc() * var(--layout-scale/--text-scale)`. |
| `DuelOpponentPanel.svelte` | Real-Time Duel live opponent state panel — fixed left-side overlay (~280px wide), vertically centered. Sections: opponent name + HP bar; damage contribution bar (two-color, blue=you vs red=them, with live % labels — the competitive star visual); chain state (color dot + length + name); last-turn summary (cards played, damage dealt, quiz result pill); circular SVG turn timer (stroke-dashoffset animates 0→circumference as time runs out, color shifts green→amber→red); enemy target indicator (flashes red with pulse animation when targeting local player). Props: `opponentName`, `opponentHp`, `opponentMaxHp`, `localDamageTotal`, `opponentDamageTotal`, `opponentChainLength`, `opponentChainColor?`, `lastTurnSummary?` (`cardsPlayed`, `damageDealt`, `quizResult: 'correct'|'wrong'|'quick_play'`), `turnTimerSecs`, `turnTimerMax`, `enemyTargetIsLocal`. All sizing via `calc() * var(--layout-scale/--text-scale)`. |
| `RaceResultsScreen.svelte` | Full-screen race/duel results overlay shown when both players finish. Centered card (~820px). Sections: mode label header; large VICTORY (green glow) / DEFEAT (red glow) banner with flavor subtitle; side-by-side stat comparison table (Score, Floor Reached, Accuracy, Facts Answered, Correct, Duration) with winner-column gold highlight, per-row green arrow on the better value; collapsible score breakdown table (Floors×100, Correct×10, Wrong×-5, total); three action buttons (Play Again / Return to Lobby / Return to Hub). Props: `results: RaceResults`, `localPlayerId: string`, `mode: 'race'|'same_cards'|'duel'`, `onPlayAgain`, `onReturnToLobby`, `onReturnToHub`. Duration formatted as M:SS. All sizing via `calc() * var(--layout-scale/--text-scale)`. **Wiring status (2026-04-11): SUPPRESSED** — wiring blocked on `multiplayerGameService.onRaceComplete` integration in CardApp; no `raceResults` Screen union value or RaceResults store state exists yet; requires game-logic agent work post-multiplayer-lobby freeze. Carries `@wiring-check:skip` suppression comment to silence the orphan-screen lint. |
| ~~`MpDebugOverlay.svelte`~~ | **REMOVED 2026-04-22.** The on-screen MP diagnostics overlay provided no signal beyond what `rrLog → ~/Library/Logs/Recall Rogue/debug.log` already captured, and the Cmd+Shift+D chord + lobby auto-show added surface area without catching the bugs it was meant to catch (BUG 22/23/25 all landed past it). The `window.__rrMpState` snapshot lives on for console/devtools inspection; `setMpDebugState` in `src/services/mpDebugState.ts` remains the authoritative writer. Live diagnostics are now log-only. |
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
| `ParentalControlsPanel.svelte` | Parental controls: session limits, content filters, PIN lock |
| `ParentalControlsOverlay.svelte` | Overlay gate for parental-restricted areas |
| `ParentalPinGate.svelte` | PIN entry gate for parental-lock protection |
| `SessionWarningBanner.svelte` | Banner when approaching parental session time limit |

---

## Monetization & Seasons

| Component | Purpose |
|-----------|---------|
| `RoguePassModal.svelte` | Rogue Pass (battle pass) purchase and tier view modal |
| `PioneerPackModal.svelte` | Early-access Pioneer Pack offer modal |
| `SeasonBanner.svelte` | Persistent season name/end-date banner at hub top |
| `PartnerPortalView.svelte` | Partner/educator portal for class management |
| `ClassJoinPanel.svelte` | Panel for students joining a teacher's class via code |
| `UGCReviewQueue.svelte` | User-generated content review queue for moderators |
| `UGCSubmitOverlay.svelte` | Overlay for submitting a user-generated fact for review |
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
