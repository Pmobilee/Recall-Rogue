# Platform & Device Services

> **Purpose:** Device detection, haptics, performance monitoring, analytics, error reporting, input handling, accessibility, notifications, entitlements, Steam integration, Steam P2P networking, and browser compatibility.
> **Last verified:** 2026-04-20 — Tauri v2 desktop detection fix (`__TAURI_INTERNALS__`); Steam lobby async-callback polling added; `tauriInvoke` and all public guards in steamNetworkingService switched to live `isTauriRuntime()` check
> **Source files:** platformService.ts, hapticService.ts, perfService.ts, analyticsService.ts, errorReporting.ts, inputService.ts, keyboardInput.ts, shortcutService.ts, accessibilityManager.ts, notificationService.ts, entitlementService.ts, steamService.ts, steamNetworkingService.ts, reviewPromptService.ts, browserCompat.ts, deviceTierService.ts, kidModeService.ts, legalConstants.ts, sessionTimer.ts, multiplayerTransport.ts

> **See also:** [`platform-audio.md`](platform-audio.md) — audioService, cardAudioManager, and juiceManager (audio synthesis and game-feel coordination).

## Overview

Platform services form the bridge between web-standard APIs and the three deployment targets: Tauri (Steam desktop), Capacitor (iOS/Android), and plain browser. Most services guard every call behind `platformService` constants (`isDesktop`, `isMobile`, `isWeb`) and gracefully no-op on unsupported platforms.

---

## platformService

| | |
|---|---|
| **File** | src/services/platformService.ts |
| **Purpose** | Detects active native wrapper (Tauri/Capacitor/web) at module load time; provides platform constants |
| **Key exports** | `platform`, `isDesktop`, `isMobile`, `isWeb`, `hasSteam`, `Platform` (type) |
| **Key dependencies** | None (window globals only) |
| **Tauri v2 detection** | Checks `window.__TAURI_INTERNALS__` first (always present in Tauri v2 — `invoke` depends on it), then falls back to `window.__TAURI__` (Tauri v1, and v2 with `withGlobalTauri: true`). In production Steam builds that do NOT set `withGlobalTauri: true`, only `__TAURI_INTERNALS__` is injected — the old `__TAURI__`-only check returned `'web'` and broke all Steam features. |

## hapticService

| | |
|---|---|
| **File** | src/services/hapticService.ts |
| **Purpose** | iOS haptic feedback via Capacitor Haptics plugin; gracefully no-ops on Android, desktop, and web |
| **Key exports** | `tapLight`, `tapMedium`, `tapHeavy`, `notifySuccess`, `notifyWarning`, `notifyError` |
| **Key dependencies** | platformService |

## perfService

| | |
|---|---|
| **File** | src/services/perfService.ts |
| **Purpose** | Web Vitals collector (LCP, FCP, CLS, INP, TTFB) via PerformanceObserver; reports once per session |
| **Key exports** | `perfService` (singleton with `observe`) |
| **Key dependencies** | analyticsService |

## analyticsService

| | |
|---|---|
| **File** | src/services/analyticsService.ts |
| **Purpose** | Batches analytics events locally and flushes every 30 s; strips PII; persists queue to localStorage across reloads |
| **Key exports** | `analyticsService` (singleton with `track`, `flush`), event type interfaces |
| **Key dependencies** | uuid utils, playerData store, experimentBucket, analyticsEvents |

## errorReporting

| | |
|---|---|
| **File** | src/services/errorReporting.ts |
| **Purpose** | Lightweight uncaught exception capture; on Steam/desktop (Tauri) logs to console with `[ErrorReport]` prefix instead of HTTP POST — no backend server exists in that build; max 20 errors/session |
| **Key exports** | `initErrorReporting`, `captureError` |
| **Key dependencies** | platformService (`isDesktop`) |
| **Version** | Uses `__RR_VERSION__` (Vite define injection); falls back to `'unknown'` |
| **Platform field** | `ErrorReport.platform` is `'web' \| 'android' \| 'ios' \| 'desktop'`; `'desktop'` is detected via `isDesktop` before UA sniffing |

## inputService

| | |
|---|---|
| **File** | src/services/inputService.ts |
| **Purpose** | Game-action pub/sub dispatcher — decouples keyboard/gamepad/touch from UI components |
| **Key exports** | `inputService` (singleton with `on`, `off`, `dispatch`), `GameAction` (type) |
| **Key dependencies** | None |

## keyboardInput

| | |
|---|---|
| **File** | src/services/keyboardInput.ts |
| **Purpose** | Keyboard listener that dispatches semantic GameActions; landscape-only, context-aware (quiz vs hand mode) |
| **Key exports** | `initKeyboardInput`, `setQuizVisible`, `destroyKeyboardInput` |
| **Key dependencies** | inputService, layoutStore |

## shortcutService

| | |
|---|---|
| **File** | src/services/shortcutService.ts |
| **Purpose** | Centralized keyboard shortcut registry with player-customizable bindings persisted to localStorage |
| **Key exports** | `shortcutService` (singleton with `on`, `off`, `getBinding`, `setBinding`, `getAll`), `ShortcutId` (type) |
| **Key dependencies** | None (localStorage) |

## accessibilityManager

| | |
|---|---|
| **File** | src/services/accessibilityManager.ts |
| **Purpose** | Subscribes to cardPreferences stores and applies `--text-scale`, `high-contrast`, `reduced-motion` to the DOM |
| **Key exports** | `initAccessibilityManager` |
| **Key dependencies** | cardPreferences |

## notificationService

| | |
|---|---|
| **File** | src/services/notificationService.ts |
| **Purpose** | Local push notifications via Capacitor plugin — streak risk, milestone, review due, win-back; max 1/day, quiet hours enforced |
| **Key exports** | `scheduleStreakRiskNotification`, `scheduleMilestoneNotification`, `cancelAllNotifications` |
| **Key dependencies** | platformService |

## entitlementService

| | |
|---|---|
| **File** | src/services/entitlementService.ts |
| **Purpose** | Content-access gating — Steam base game unlocks all; mobile free tier gets BASE_DOMAINS only; Scholar Pass unlocks all |
| **Key exports** | `isDomainUnlocked`, `getAccessibleDomains`, `BASE_DOMAINS` |
| **Key dependencies** | platformService, steamService, subscriptionService |

## steamService

| | |
|---|---|
| **File** | src/services/steamService.ts |
| **Purpose** | Wraps Steamworks SDK calls via Tauri IPC — achievements, stats, DLC ownership; no-ops on non-Steam platforms |
| **Key exports** | `unlockAchievement`, `setStatInt`, `hasDLC`, `getPersonaName` |
| **Key dependencies** | platformService (@tauri-apps/api/core dynamic import) |

## steamNetworkingService

| | |
|---|---|
| **File** | src/services/steamNetworkingService.ts |
| **Purpose** | Wraps Steamworks P2P Networking and Lobby API via Tauri IPC — lobby create/join/leave, lobby metadata, P2P send/receive, callback pump; no-ops on non-Steam platforms |
| **Key exports** | `createSteamLobby`, `joinSteamLobby`, `leaveSteamLobby`, `getLobbyMembers`, `setLobbyData`, `getLobbyData`, `sendP2PMessage`, `readP2PMessages`, `acceptP2PSession`, `runSteamCallbacks`, `startMessagePollLoop` |
| **Key types** | `SteamLobbyType`, `SteamLobbyMember`, `SteamP2PMessage` |
| **Key dependencies** | @tauri-apps/api/core (dynamic import only) — does NOT import platformService |
| **Platform guard** | All public functions and the internal `tauriInvoke` helper use `isTauriRuntime()` — a local live check (`window.__TAURI_INTERNALS__ || window.__TAURI__`) rather than the module-load-time `hasSteam` snapshot. This prevents silent no-ops when `__TAURI_INTERNALS__` is injected after module evaluation (Tauri v2 default). |
| **Poll loop** | `startMessagePollLoop(onMessage, channel?, intervalMs?)` — starts a 16 ms setInterval that pumps Steam callbacks then reads P2P messages; returns cleanup function |
| **Async lobby ops** | `createSteamLobby` and `joinSteamLobby` use an internal `pollPendingResult(pendingCmd, timeoutMs, intervalMs)` helper to bridge Steamworks' async callback model. They kick the Tauri command (returns immediately), then spin `steam_run_callbacks` + `steam_get_pending_lobby_id` / `steam_get_pending_join_lobby_id` at 100 ms intervals until the callback fires (up to 5 s). Both resolve with the lobby ID / true on success, or null / false on timeout. |
| **Tauri commands** | `steam_create_lobby`, `steam_join_lobby`, `steam_leave_lobby`, `steam_get_lobby_members`, `steam_set_lobby_data`, `steam_get_lobby_data`, `steam_send_p2p_message`, `steam_read_p2p_messages`, `steam_accept_p2p_session`, `steam_run_callbacks`, `steam_get_pending_lobby_id`, `steam_get_pending_join_lobby_id` |
| **Arg convention** | All Tauri IPC args use snake_case to match Rust side (`lobby_id`, `lobby_type`, `max_members`, `steam_id`, etc.) |

## reviewPromptService

| | |
|---|---|
| **File** | src/services/reviewPromptService.ts |
| **Purpose** | Triggers App Store / Play Store review prompts at positive peaks (boss kill, Tier 2 promo, 7-day streak); max 1 per 90 days |
| **Key exports** | `checkAndTriggerReviewPrompt`, `recordBossKill`, `recordTier2Promotion`, `recordStreakMilestone` |
| **Key dependencies** | platformService |

## browserCompat

| | |
|---|---|
| **File** | src/services/browserCompat.ts |
| **Purpose** | Feature detection for WebGL, ServiceWorker, IndexedDB, WebAudio, WebShare; reports engine type |
| **Key exports** | `checkCompatibility`, `CompatReport` (interface) |
| **Key dependencies** | errorReporting |

## deviceTierService

| | |
|---|---|
| **File** | src/services/deviceTierService.ts |
| **Purpose** | Classifies device performance tier (low/mid/high) based on GPU renderer, device memory, and CPU concurrency |
| **Key exports** | `getDeviceTier`, `DeviceTier` (type) |
| **Key dependencies** | platformService |


## kidModeService

| | |
|---|---|
| **File** | src/services/kidModeService.ts |
| **Purpose** | Parental controls — daily play time limits, PIN lock, age rating (kid/teen), social toggle |
| **Key exports** | `kidModeService` (singleton with `getControls`, `setControls`, `verifyPin`, `isTimeLimitReached`) |
| **Key dependencies** | localStorage |

## legalConstants

| | |
|---|---|
| **File** | src/services/legalConstants.ts |
| **Purpose** | Shared constants for the age-gate system — `AGE_BRACKET_KEY`, `AgeBracket` type |
| **Key exports** | `AGE_BRACKET_KEY`, `AgeBracket` (type) |
| **Key dependencies** | None |

## sessionTimer

| | |
|---|---|
| **File** | src/services/sessionTimer.ts |
| **Purpose** | Daily play time tracker with gentle 5-min warning and hard-stop at parental time limit |
| **Key exports** | `sessionTimer` (singleton with `start`, `stop`, `getState`, `subscribe`) |
| **Key dependencies** | localStorage |

## multiplayerTransport

| | |
|---|---|
| **File** | src/services/multiplayerTransport.ts |
| **Purpose** | Transport-agnostic multiplayer messaging layer — abstracts over WebSocket (web/mobile), Steam P2P (desktop), and in-memory local bus (same-screen) so game logic never touches any transport directly |
| **Key exports** | `getMultiplayerTransport`, `destroyMultiplayerTransport`, `createTransport`, `createLocalTransportPair`, `WebSocketTransport`, `SteamP2PTransport`, `LocalMultiplayerTransport` |
| **Key types** | `MultiplayerTransport` (interface), `MultiplayerMessage`, `MultiplayerMessageType`, `TransportState` |
| **Key dependencies** | platformService (`hasSteam`), steamNetworkingService (`acceptP2PSession`, `sendP2PMessage`, `startMessagePollLoop`, `leaveSteamLobby`) |
| **Platform selection** | `createTransport('local')` → `LocalMultiplayerTransport`; `hasSteam === true` → `SteamP2PTransport`; otherwise → `WebSocketTransport` |
| **Singleton** | `getMultiplayerTransport(mode?)` creates lazily; `destroyMultiplayerTransport()` disconnects and nulls the instance |
| **WebSocketTransport** | Connects via `ws://` or `wss://` URL with playerId query param; exponential backoff reconnect (5 attempts, 1 s base delay) |
| **SteamP2PTransport** | `connect(peerId, localId)` calls `acceptP2PSession(peerId)` then starts the 16 ms poll loop; `setActiveLobby(id)` registers lobby for cleanup on `disconnect()` |
| **LocalMultiplayerTransport** | In-memory event bus for same-screen play; `connect()` is instantaneous; messages delivered via `queueMicrotask` to avoid stack overflows; `disconnect()` unlinks peer |
| **createLocalTransportPair()** | Returns `[t1, t2]` pre-linked via `linkPeer()` — send on one, receive on the other; use for Race Mode or Trivia Night hot-seat |
| **Message types** | 35 typed values: `mp:lobby:*`, `mp:race:*`, `mp:duel:*`, `mp:coop:*`, `mp:trivia:*`, `mp:workshop:*`, `mp:ping/pong/error/sync` |
