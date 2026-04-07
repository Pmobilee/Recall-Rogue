/**
 * Steam Rich Presence watcher.
 *
 * Subscribes to `currentScreen` and updates Steam Rich Presence on each
 * transition. For combat screens, reads floor + enemy info from the active run
 * and turn state stores.
 *
 * This module is a no-op on non-Steam platforms — `updateRichPresence` already
 * guards behind `hasSteam` before making any IPC calls.
 */

import { get } from 'svelte/store';
import { currentScreen } from '../ui/stores/gameState';
import { updateRichPresence } from './steamService';
import { activeRunState } from './runStateStore';
import { activeTurnState } from './encounterBridge';

/**
 * Initialize the Steam Rich Presence watcher.
 * Call once at boot (after stores are initialized).
 * Returns an unsubscribe function — in practice the watcher runs for the
 * full session so callers can ignore the return value.
 */
export function initSteamPresence(): () => void {
  return currentScreen.subscribe((screen) => {
    if (screen === 'combat') {
      // Read floor from run state and enemy name from turn state.
      const run = get(activeRunState);
      const turn = get(activeTurnState);
      const floor = run?.floor.currentFloor ?? 1;
      const enemy = turn?.enemy?.template?.name ?? undefined;
      updateRichPresence('combat', { floor, enemy });
    } else if (screen === 'dungeonMap') {
      const run = get(activeRunState);
      const floor = run?.floor.currentFloor ?? 1;
      updateRichPresence('dungeonMap', { floor });
    } else {
      updateRichPresence(screen);
    }
  });
}
