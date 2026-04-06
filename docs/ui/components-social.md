# UI Components — Social, Account & Utility

> **Purpose:** Non-gameplay Svelte components: social, auth, monetization, onboarding, and utility
> **Last verified:** 2026-04-05
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

---

## Profile & Account

| Component | Purpose |
|-----------|---------|
| `ProfileScreen.svelte` | Player profile: stats, badges, knowledge tree, run history |
| `AccountSettings.svelte` | Account settings: password, linked accounts, delete account |
| `SettingsPanel.svelte` | In-game settings: audio, accessibility, notifications, account. **Accessibility tab** includes a Fullscreen toggle (hidden on mobile/Capacitor). Uses `fullscreenService.ts` — Tauri API on desktop, standard Fullscreen API on web. State syncs via `fullscreenchange` DOM event so external ESC-to-exit is reflected. F11 keyboard shortcut also triggers toggle globally (registered in `main.ts`). |
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
