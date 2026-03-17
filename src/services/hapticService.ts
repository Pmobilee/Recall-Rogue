/**
 * Haptic feedback service for iOS.
 * Uses Capacitor's Haptics plugin (bundled with @capacitor/core).
 * Gracefully no-ops on Android, browser, and Tauri desktop.
 */

import { isMobile } from './platformService';

interface HapticsPlugin {
  impact(options: { style: 'HEAVY' | 'MEDIUM' | 'LIGHT' }): Promise<void>
  notification(options: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }): Promise<void>
  vibrate(): Promise<void>
  selectionStart(): Promise<void>
  selectionChanged(): Promise<void>
  selectionEnd(): Promise<void>
}

// Only register the Capacitor plugin when running on mobile.
// On desktop (Tauri) or plain web, registerPlugin is unavailable / unnecessary.
let Haptics: HapticsPlugin | null = null;
if (isMobile) {
  try {
    const { registerPlugin } = await import('@capacitor/core');
    Haptics = registerPlugin<HapticsPlugin>('Haptics');
  } catch {
    // Plugin unavailable — all haptic calls will no-op via the null guard below.
  }
}

/** Light tap — quiz answer selection, button press */
export async function tapLight(): Promise<void> {
  if (!Haptics) return;
  try { await Haptics.impact({ style: 'LIGHT' }) } catch { /* no-op */ }
}

/** Medium impact — block mined, item collected */
export async function tapMedium(): Promise<void> {
  if (!Haptics) return;
  try { await Haptics.impact({ style: 'MEDIUM' }) } catch { /* no-op */ }
}

/** Heavy impact — boss hit, hazard damage, death */
export async function tapHeavy(): Promise<void> {
  if (!Haptics) return;
  try { await Haptics.impact({ style: 'HEAVY' }) } catch { /* no-op */ }
}

/** Success notification — quiz correct, relic found, level up */
export async function notifySuccess(): Promise<void> {
  if (!Haptics) return;
  try { await Haptics.notification({ type: 'SUCCESS' }) } catch { /* no-op */ }
}

/** Warning notification — low O2, near hazard */
export async function notifyWarning(): Promise<void> {
  if (!Haptics) return;
  try { await Haptics.notification({ type: 'WARNING' }) } catch { /* no-op */ }
}

/** Error notification — quiz wrong, purchase failed */
export async function notifyError(): Promise<void> {
  if (!Haptics) return;
  try { await Haptics.notification({ type: 'ERROR' }) } catch { /* no-op */ }
}

/** Selection tick — scrolling through options */
export async function selectionTick(): Promise<void> {
  if (!Haptics) return;
  try {
    await Haptics.selectionStart()
    await Haptics.selectionChanged()
    await Haptics.selectionEnd()
  } catch { /* no-op */ }
}
