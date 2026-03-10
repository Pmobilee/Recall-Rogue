import { writable } from 'svelte/store'
import type { RunState } from './runManager'

/**
 * Shared active run store used by game flow and encounter systems.
 * Separated to avoid orchestration-layer circular dependencies.
 */
export const activeRunState = writable<RunState | null>(null)

