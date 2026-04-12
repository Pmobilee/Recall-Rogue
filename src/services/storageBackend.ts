/**
 * StorageBackend abstraction for Recall Rogue save data.
 *
 * Provides a unified read/write API over two implementations:
 * - LocalStorageBackend: thin wrapper around localStorage (web/mobile)
 * - FileStorageBackend: write-through in-memory cache with debounced file I/O via Tauri IPC (desktop)
 *
 * Usage:
 *   await initStorageBackend()   // once at startup, before any save operations
 *   getBackend().readSync(key)   // sync read (always returns from cache on desktop)
 *   getBackend().write(key, val) // write to cache + schedules async persist
 */

import { isDesktop } from './platformService';

// -------------------------------------------------------------------
// Interface
// -------------------------------------------------------------------

/** Unified storage API — synchronous reads, async persists. */
export interface StorageBackend {
  /** Synchronous read from in-memory cache. Returns null if key not found. */
  readSync(key: string): string | null;
  /** Write to cache immediately + schedule async persist. */
  write(key: string, data: string): void;
  /** Remove key from cache + async delete from persistent storage. */
  remove(key: string): void;
  /** Force-flush all pending writes to persistent storage. */
  flush(): Promise<void>;
  /**
   * Initialize the backend.
   * For FileStorageBackend: reads all known save files into the in-memory cache.
   * For LocalStorageBackend: no-op.
   * Must be called and awaited before any readSync/write/remove calls.
   */
  init(): Promise<void>;
}

// -------------------------------------------------------------------
// LocalStorageBackend — web / Capacitor mobile
// -------------------------------------------------------------------

/**
 * Thin wrapper around localStorage for web and Capacitor mobile targets.
 * All operations are synchronous; flush() and init() are no-ops.
 */
class LocalStorageBackend implements StorageBackend {
  readSync(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  write(key: string, data: string): void {
    try {
      localStorage.setItem(key, data);
    } catch {
      // Silently fail if storage quota exceeded
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  }

  async flush(): Promise<void> {
    // localStorage writes are synchronous; nothing to flush
  }

  async init(): Promise<void> {
    // localStorage is always ready; nothing to initialize
  }
}

// -------------------------------------------------------------------
// FileStorageBackend — Tauri desktop
// -------------------------------------------------------------------

/**
 * Write-through in-memory cache backed by Tauri fs_* IPC commands.
 *
 * Key design decisions:
 * - readSync() always returns from the in-memory cache (populated by init())
 * - write() updates cache immediately and schedules a debounced file write (500 ms)
 * - flush() forces all pending writes synchronously (called on beforeunload/visibilitychange)
 * - Settings keys (anything not profile/run/profiles) are merged into a single settings.json
 *   to avoid unbounded file proliferation.
 *
 * Key-to-filename mapping:
 *   rr_profiles              → profiles.json
 *   recall-rogue-active-run  → run_active.json
 *   rr_save_<id>             → profile_<id>.json
 *   rr_save                  → profile_legacy.json
 *   everything else          → settings.json (merged object)
 */
class FileStorageBackend implements StorageBackend {
  /** Primary key→value cache for all non-settings keys. */
  private cache = new Map<string, string>();

  /**
   * Settings are special: multiple logical keys map to one settings.json file.
   * We track them separately so we can merge on read/write.
   */
  private settingsCache: Record<string, string> = {};

  /** Pending debounce timers, keyed by logical storage key. */
  private pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();

  private readonly DEBOUNCE_MS = 500;

  async init(): Promise<void> {
    // Load primary save files into cache
    const primaryFiles: Array<[filename: string, key: string]> = [
      ['profiles.json', 'rr_profiles'],
      ['run_active.json', 'recall-rogue-active-run'],
    ];

    for (const [filename, key] of primaryFiles) {
      const data = await this.invokeRead(filename);
      if (data !== null) {
        this.cache.set(key, data);
      }
    }

    // Discover profile files from profiles.json
    const profilesRaw = this.cache.get('rr_profiles');
    if (profilesRaw) {
      try {
        const profiles = JSON.parse(profilesRaw) as { profiles?: Array<{ id: string }> };
        for (const p of profiles.profiles ?? []) {
          const data = await this.invokeRead(`profile_${p.id}.json`);
          if (data !== null) {
            this.cache.set(`rr_save_${p.id}`, data);
          }
        }
      } catch {
        // Malformed profiles.json — skip per-profile loading
      }
    }

    // Load legacy profile save
    const legacyData = await this.invokeRead('profile_legacy.json');
    if (legacyData !== null) {
      this.cache.set('rr_save', legacyData);
    }

    // Load settings.json into settingsCache
    const settingsRaw = await this.invokeRead('settings.json');
    if (settingsRaw) {
      try {
        const parsed = JSON.parse(settingsRaw) as Record<string, string>;
        this.settingsCache = parsed;
      } catch {
        // Malformed settings.json — start fresh
      }
    }

    // Register flush-on-exit handlers
    window.addEventListener('beforeunload', () => { void this.flush(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void this.flush();
      }
    });
  }

  readSync(key: string): string | null {
    if (this.isSettingsKey(key)) {
      return this.settingsCache[key] ?? null;
    }
    return this.cache.get(key) ?? null;
  }

  write(key: string, data: string): void {
    if (this.isSettingsKey(key)) {
      this.settingsCache[key] = data;
      this.scheduleFlush('__settings__');
    } else {
      this.cache.set(key, data);
      this.scheduleFlush(key);
    }
  }

  remove(key: string): void {
    if (this.isSettingsKey(key)) {
      delete this.settingsCache[key];
      this.scheduleFlush('__settings__');
    } else {
      this.cache.delete(key);
      // Cancel any pending write for this key
      const timer = this.pendingWrites.get(key);
      if (timer !== undefined) clearTimeout(timer);
      this.pendingWrites.delete(key);
      // Async delete the file
      const filename = this.keyToFilename(key);
      this.invokeDelete(filename).catch(err => {
        console.error(`[FileSave] Failed to delete ${key}:`, err);
      });
    }
  }

  async flush(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [pendingKey, timer] of this.pendingWrites) {
      clearTimeout(timer);

      if (pendingKey === '__settings__') {
        promises.push(
          this.invokeWrite('settings.json', JSON.stringify(this.settingsCache))
        );
      } else {
        const data = this.cache.get(pendingKey);
        if (data !== undefined) {
          promises.push(this.invokeWrite(this.keyToFilename(pendingKey), data));
        }
      }
    }

    this.pendingWrites.clear();
    await Promise.all(promises);
  }

  // -------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------

  /**
   * Returns true for keys that should be merged into settings.json
   * rather than written to their own file.
   */
  private isSettingsKey(key: string): boolean {
    if (key === 'rr_profiles') return false;
    if (key === 'recall-rogue-active-run') return false;
    if (key.startsWith('rr_save_')) return false;
    if (key === 'rr_save') return false;
    // All other keys are settings (preferences, audio, accessibility, etc.)
    return true;
  }

  private keyToFilename(key: string): string {
    if (key === 'rr_profiles') return 'profiles.json';
    if (key === 'recall-rogue-active-run') return 'run_active.json';
    if (key.startsWith('rr_save_')) return `profile_${key.slice(8)}.json`;
    if (key === 'rr_save') return 'profile_legacy.json';
    // Settings keys should never reach here (handled by isSettingsKey)
    return 'settings.json';
  }

  private scheduleFlush(key: string): void {
    const existing = this.pendingWrites.get(key);
    if (existing !== undefined) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.pendingWrites.delete(key);

      if (key === '__settings__') {
        this.invokeWrite('settings.json', JSON.stringify(this.settingsCache)).catch(err => {
          console.error('[FileSave] Write failed for settings.json:', err);
        });
      } else {
        const data = this.cache.get(key);
        if (data !== undefined) {
          this.invokeWrite(this.keyToFilename(key), data).catch(err => {
            console.error(`[FileSave] Write failed for ${key}:`, err);
          });
        }
      }
    }, this.DEBOUNCE_MS);

    this.pendingWrites.set(key, timer);
  }

  // Tauri IPC wrappers — lazy dynamic imports so web builds never load the Tauri module

  private async invokeRead(filename: string): Promise<string | null> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string | null>('fs_read_save', { filename });
  }

  private async invokeWrite(filename: string, data: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke<void>('fs_write_save', { filename, data });
  }

  private async invokeDelete(filename: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke<void>('fs_delete_save', { filename });
  }
}

// -------------------------------------------------------------------
// Singleton factory
// -------------------------------------------------------------------

let _backend: StorageBackend | null = null;

/**
 * Returns the singleton StorageBackend instance.
 * On desktop (Tauri): FileStorageBackend.
 * On web/mobile: LocalStorageBackend.
 *
 * Call initStorageBackend() before the first readSync/write/remove.
 */
export function getBackend(): StorageBackend {
  if (!_backend) {
    _backend = isDesktop ? new FileStorageBackend() : new LocalStorageBackend();
  }
  return _backend;
}

/**
 * Initialize the storage backend.
 * Must be called and awaited exactly once at startup, before initPlayer()
 * or any other save/load operation.
 *
 * On web/mobile this is a no-op (completes synchronously).
 * On desktop (Tauri) this reads all save files into the in-memory cache.
 */
export async function initStorageBackend(): Promise<void> {
  await getBackend().init();
}

// -------------------------------------------------------------------
// Migration: localStorage → file backend (desktop first-launch)
// -------------------------------------------------------------------

/**
 * One-time migration: copies localStorage save data to the file backend
 * on the first desktop launch after updating to the FileStorageBackend.
 *
 * Safe to call multiple times — skips immediately if the migration flag is set.
 * Writes the migration flag to localStorage (not the backend) so it persists
 * across sessions even if the file backend has no data.
 */
export async function migrateLocalStorageToFiles(): Promise<void> {
  if (!isDesktop) return;
  if (localStorage.getItem('rr_file_migration_complete')) return;

  const backend = getBackend();

  // Migrate profiles store
  const profilesRaw = localStorage.getItem('rr_profiles');
  if (profilesRaw) {
    backend.write('rr_profiles', profilesRaw);
    // Migrate each profile's save data
    try {
      const profiles = JSON.parse(profilesRaw) as { profiles?: Array<{ id: string }> };
      for (const p of profiles.profiles ?? []) {
        const saveRaw = localStorage.getItem(`rr_save_${p.id}`);
        if (saveRaw) backend.write(`rr_save_${p.id}`, saveRaw);
      }
    } catch {
      // Ignore parse errors — profiles will be recreated on next launch
    }
  }

  // Migrate legacy profile save
  const legacySave = localStorage.getItem('rr_save');
  if (legacySave) backend.write('rr_save', legacySave);

  // Migrate active run snapshot
  const activeRun = localStorage.getItem('recall-rogue-active-run');
  if (activeRun) backend.write('recall-rogue-active-run', activeRun);

  // Migrate card preferences and settings
  const settingsKeys = [
    'card:difficultyMode',
    'card:isSlowReader',
    'card:textSize',
    'recall-rogue-font-choice',
    'card:highContrastMode',
    'card:reduceMotionMode',
    'card:onboardingState',
    'card:ascensionProfile',
    'settingsMusicVolume',
    'settingsSfxVolume',
    // UI/UX preferences and feature flags
    'recall-rogue-ui-scale',
    'recall-rogue-boot-anim-seen',
    'rr_onboarding_complete',
    'device-tier-override',
    'rr_lang_mode',
    'rr_locale',
    'rr_review_prompt_state',
    'rr_notification_state',
    'rr_scholar_challenge',
    'tutorial:apShown',
    'tutorial:chargeShown',
    'tutorial:comparisonShown',
  ];
  for (const key of settingsKeys) {
    const val = localStorage.getItem(key);
    if (val) backend.write(key, val);
  }

  await backend.flush();

  // Mark migration complete in localStorage (not the file backend) so it survives
  // a clean re-install where the save files are already present
  localStorage.setItem('rr_file_migration_complete', 'true');
  console.log('[StorageBackend] Migration from localStorage to file backend complete');
}
