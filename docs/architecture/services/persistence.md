# Persistence & Sync Services

> **Purpose:** Player save/load, run save/resume, save migration, cloud sync, offline queue, API client, auth tokens, and local auth fallback.
> **Last verified:** 2026-03-31
> **Source files:** saveService.ts, runSaveService.ts, saveMigration.ts, storageMigration.ts, syncService.ts, syncDurabilityService.ts, offlineQueue.ts, apiClient.ts, authedFetch.ts, authTokens.ts, localAuth.ts, profileService.ts

## Overview

Persistence is layered: `saveService` owns the primary `PlayerSave` localStorage blob; `runSaveService` handles the separate active-run snapshot; `syncService` debounces cloud uploads and handles conflict resolution; `offlineQueue` buffers failed operations for replay. Auth is dual-path: `apiClient` handles server registration/login, `localAuth` provides fallback offline credentials.

---

## saveService

| | |
|---|---|
| **File** | src/services/saveService.ts |
| **Purpose** | Primary player save: load/save `PlayerSave` to localStorage, create default save, profile-namespaced keys |
| **Key exports** | `load`, `save`, `createDefaultSave`, `SAVE_KEY`, `SAVE_VERSION` |
| **Key dependencies** | profileService, archetypeDetector, engagementScorer |

## runSaveService

| | |
|---|---|
| **File** | src/services/runSaveService.ts |
| **Purpose** | Save/resume system for active runs — persists full RunState snapshot to localStorage; one slot only |
| **Key exports** | `saveActiveRun`, `loadActiveRun`, `clearActiveRun`, `hasActiveRun`, `RunSaveState` (interface) |
| **Key dependencies** | runManager, floorManager, seededRng, ascension |

## saveMigration

| | |
|---|---|
| **File** | src/services/saveMigration.ts |
| **Purpose** | Versioned save migration — V1→V2 relic catalogue replacement (50→42 relics) with rename/refund/drop actions |
| **Key exports** | `migrateV1ToV2`, `V1_TO_V2_RELIC_MAP`, `V1RelicMigrationAction` (type) |
| **Key dependencies** | None (pure data transforms) |

## storageMigration

| | |
|---|---|
| **File** | src/services/storageMigration.ts |
| **Purpose** | One-time localStorage key prefix migration from legacy `terra_` to `rr_`; called once at app startup |
| **Key exports** | `runStorageMigrations` |
| **Key dependencies** | None (localStorage only) |

## syncService

| | |
|---|---|
| **File** | src/services/syncService.ts |
| **Purpose** | Coordinates local save with cloud via debounced uploads (30 s minimum gap); conflict resolution by `lastPlayedAt` timestamp |
| **Key exports** | `syncService` (singleton with `pushToCloud`, `pullFromCloud`, `syncAll`) |
| **Key dependencies** | apiClient, saveService, offlineQueue, syncStore |

## syncDurabilityService

| | |
|---|---|
| **File** | src/services/syncDurabilityService.ts |
| **Purpose** | Registers a single `visibilitychange` listener to trigger cloud sync when app backgrounds; avoids saveService↔syncService circular dependency |
| **Key exports** | `initSyncDurabilityListener` |
| **Key dependencies** | syncService |

## offlineQueue

| | |
|---|---|
| **File** | src/services/offlineQueue.ts |
| **Purpose** | Offline operation queue — persists pending sync operations to localStorage for replay on reconnect; max 5 retries |
| **Key exports** | `offlineQueue` (singleton with `enqueue`, `flush`, `clear`), `QueuedOperation` (interface) |
| **Key dependencies** | uuid utils, localStorage |

## apiClient

| | |
|---|---|
| **File** | src/services/apiClient.ts |
| **Purpose** | Typed HTTP client — handles auth (register/login/logout), cloud save upload/download, leaderboard operations; auto-refreshes expired tokens |
| **Key exports** | `apiClient` (singleton with `register`, `login`, `logout`, `uploadSave`, `downloadSave`, `submitLeaderboard`), `ApiError` (class) |
| **Key dependencies** | authTokens |

## authedFetch

| | |
|---|---|
| **File** | src/services/authedFetch.ts |
| **Purpose** | Low-level authenticated fetch wrapper — injects Bearer token from authTokens, exposes `authedGet` and `authedPost` |
| **Key exports** | `authedGet`, `authedPost` |
| **Key dependencies** | authTokens, apiClient (ApiError) |

## authTokens

| | |
|---|---|
| **File** | src/services/authTokens.ts |
| **Purpose** | localStorage read/write for access and refresh tokens; safe wrappers that no-op on storage errors |
| **Key exports** | `readAccessToken`, `persistAccessToken`, `clearAccessToken`, `readRefreshToken`, `persistRefreshToken`, `clearRefreshToken`, `clearAllAuthTokens` |
| **Key dependencies** | None (localStorage only) |

## localAuth

| | |
|---|---|
| **File** | src/services/localAuth.ts |
| **Purpose** | localStorage-only fallback authentication when the backend API is unreachable; uses SHA-256 password hashing |
| **Key exports** | `localRegister`, `localLogin`, `localLogout`, `getLocalCurrentUser` |
| **Key dependencies** | crypto.subtle (Web Crypto API) |

## profileService

| | |
|---|---|
| **File** | src/services/profileService.ts |
| **Purpose** | Multi-profile management (up to 4 profiles) — creates/switches/deletes profiles with namespaced save keys (`rr_save_<id>`) |
| **Key exports** | `profileService` (singleton with `getProfiles`, `createProfile`, `switchProfile`, `deleteProfile`, `getSaveKey`, `getActiveProfile`) |
| **Key dependencies** | localStorage, uuid utils |
