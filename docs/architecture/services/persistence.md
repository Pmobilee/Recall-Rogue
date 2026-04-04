# Persistence & Sync Services

> **Purpose:** Player save/load, run save/resume, save migration, cloud sync, offline queue, API client, auth tokens, and local auth fallback.
> **Last verified:** 2026-04-04
> **Source files:** storageBackend.ts, saveService.ts, runSaveService.ts, saveMigration.ts, storageMigration.ts, syncService.ts, syncDurabilityService.ts, offlineQueue.ts, apiClient.ts, authedFetch.ts, authTokens.ts, localAuth.ts, profileService.ts

## Overview

Persistence is layered: `storageBackend` provides a unified read/write API over either localStorage (web/mobile) or Tauri file I/O (desktop); `saveService` owns the primary `PlayerSave` blob; `runSaveService` handles the active-run snapshot; `syncService` debounces cloud uploads and handles conflict resolution; `offlineQueue` buffers failed operations for replay. Auth is dual-path: `apiClient` handles server registration/login, `localAuth` provides fallback offline credentials.

---

## storageBackend (NEW — 2026-04-04)

| | |
|---|---|
| **File** | src/services/storageBackend.ts |
| **Purpose** | Platform-agnostic storage abstraction — `LocalStorageBackend` for web/mobile, `FileStorageBackend` for Tauri desktop. All save services route through this layer instead of calling `localStorage` directly. |
| **Key exports** | `StorageBackend` (interface), `getBackend`, `initStorageBackend`, `migrateLocalStorageToFiles` |
| **Key dependencies** | platformService (isDesktop), @tauri-apps/api/core (desktop only, lazy-loaded) |

### StorageBackend interface

```typescript
interface StorageBackend {
  readSync(key: string): string | null;  // sync read from in-memory cache
  write(key: string, data: string): void; // cache + debounced async persist
  remove(key: string): void;              // cache delete + async file delete
  flush(): Promise<void>;                 // force all pending writes now
  init(): Promise<void>;                  // populate cache from disk (desktop only)
}
```

### LocalStorageBackend

Thin wrapper around `localStorage`. All operations are synchronous. `init()` and `flush()` are no-ops. Used on web and Capacitor mobile.

### FileStorageBackend

Write-through in-memory cache with 500 ms debounced file I/O via Tauri IPC commands (`fs_read_save`, `fs_write_save`, `fs_delete_save`).

- `init()` reads all known save files into cache before returning
- `readSync()` always returns from cache (never blocks)
- `write()` / `remove()` update cache immediately, schedule debounced flush
- `flush()` is called synchronously on `beforeunload` / `visibilitychange:hidden`
- Settings keys (preferences, audio, accessibility — anything not a profile/run save) are merged into a single `settings.json` file

**Key-to-filename mapping:**

| Key | File |
|-----|------|
| `rr_profiles` | `profiles.json` |
| `recall-rogue-active-run` | `run_active.json` |
| `rr_save_<id>` | `profile_<id>.json` |
| `rr_save` | `profile_legacy.json` |
| all others (preferences) | `settings.json` (merged object) |

### Startup sequence

`initStorageBackend()` must be called and awaited in `bootGame()` before `initPlayer()`:

```
bootGame()
  → await initStorageBackend()        // populate cache from disk (desktop); no-op (web)
  → await migrateLocalStorageToFiles() // one-time migration on first desktop launch
  → profileService.reload()           // re-read profiles from populated cache (desktop)
  → initPlayer()                      // reads from cache via saveService.load()
```

On web/mobile this adds zero overhead — all three calls complete synchronously.

### migrateLocalStorageToFiles()

One-time migration that copies all save data from `localStorage` to the file backend on the first desktop launch. Idempotent — skips if `rr_file_migration_complete` flag is set in `localStorage`. Migrates: profiles store, all profile saves, legacy save, active run, and all preference keys.

---

## saveService

| | |
|---|---|
| **File** | src/services/saveService.ts |
| **Purpose** | Primary player save: load/save `PlayerSave` via `storageBackend`, create default save, profile-namespaced keys |
| **Key exports** | `load`, `save`, `deleteSave`, `createNewPlayer`, `SAVE_KEY`, `SAVE_VERSION` |
| **Key dependencies** | storageBackend (getBackend), profileService, archetypeDetector, engagementScorer |

`save()` and `load()` are synchronous. They call `getBackend().write()` / `readSync()`. On desktop the cache is pre-populated by `initStorageBackend()`, so reads are always immediate.

## runSaveService

| | |
|---|---|
| **File** | src/services/runSaveService.ts |
| **Purpose** | Save/resume system for active runs — persists full RunState snapshot via `storageBackend`; one slot only |
| **Key exports** | `saveActiveRun`, `loadActiveRun`, `clearActiveRun`, `hasActiveRun`, `RunSaveState` (interface) |
| **Key dependencies** | storageBackend (getBackend), runManager, floorManager, seededRng, ascension |

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
| **Purpose** | One-time localStorage key prefix migration from legacy `terra_` to `rr_`; called once at app startup before `initStorageBackend()` |
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
| **Purpose** | Multi-profile management (up to 4 profiles) — creates/switches/deletes profiles with namespaced save keys (`rr_save_<id>`); reads/writes through `storageBackend` |
| **Key exports** | `profileService` (singleton with `getProfiles`, `createProfile`, `deleteProfile`, `getSaveKey`, `getActiveProfile`, `reload`) |
| **Key dependencies** | storageBackend (getBackend), uuid utils |

Note: the `ProfileService` constructor calls `loadStore()` at import time (before `initStorageBackend()` completes). On desktop, `loadStore()` returns an empty store because the FileStorageBackend cache is not yet populated. After `initStorageBackend()` resolves in `bootGame()`, call `profileService.reload()` to re-read the correct store from the populated cache. `reload()` is a no-op on web since `LocalStorageBackend` is always ready.
