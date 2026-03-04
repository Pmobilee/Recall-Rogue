/**
 * @file syncStore.ts
 * Svelte store for the cloud-sync status indicator.
 *
 * Import `syncStatus` in any component that needs to reflect the current
 * synchronisation state (idle / syncing / error).
 */

import { writable } from 'svelte/store'

/** The three possible states for the cloud sync indicator. */
export type SyncState = 'idle' | 'syncing' | 'error'

/**
 * Writable store that holds the current sync state.
 * Updated by `syncService` before and after every network operation.
 */
export const syncStatus = writable<SyncState>('idle')
