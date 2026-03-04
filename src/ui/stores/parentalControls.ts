import { writable, derived } from 'svelte/store'
import { kidModeService } from '../../services/kidModeService'

/** Whether kid mode is currently active */
export const kidModeEnabled = writable<boolean>(kidModeService.isKidMode())

/** Remaining play minutes (updates every minute when kid mode is active) */
export const remainingMinutes = writable<number>(kidModeService.getRemainingMinutes())

/** Whether the time-limit warning should be shown */
export const showTimeLimitWarning = derived(
  remainingMinutes,
  $mins => $mins <= 5 && $mins > 0 && kidModeService.isKidMode()
)

/** Whether the time limit has been reached */
export const timeLimitReached = derived(
  remainingMinutes,
  $mins => $mins <= 0 && kidModeService.isKidMode()
)

/** Update remaining minutes periodically */
let updateInterval: ReturnType<typeof setInterval> | null = null

export function startPlaytimeTracking(): void {
  kidModeService.startSession()
  if (updateInterval) clearInterval(updateInterval)
  updateInterval = setInterval(() => {
    remainingMinutes.set(kidModeService.getRemainingMinutes())
    kidModeEnabled.set(kidModeService.isKidMode())
  }, 60000)  // Update every minute
}

export function stopPlaytimeTracking(): void {
  kidModeService.endSession()
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
}
