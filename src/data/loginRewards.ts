import type { PlayerSave } from './types'


/** Login calendar reward definitions. */
export const LOGIN_CALENDAR_REWARDS = [
  { day: 1, type: 'gold', amount: 50,  icon: 'icon_gold',    label: '50 Gold',            description: 'A small stash to get you going.' },
  { day: 2, type: 'card', amount: 1,   icon: 'icon_card',    label: 'Random Card',        description: 'A card for your deck.' },
  { day: 3, type: 'gold', amount: 100, icon: 'icon_gold',    label: '100 Gold',           description: 'Double the haul.' },
  { day: 4, type: 'streak_freeze', amount: 1, icon: 'icon_freeze', label: 'Streak Freeze', description: 'Protect your streak from one missed day.' },
  { day: 5, type: 'relic', amount: 1,  icon: 'icon_relic',   label: 'Random Relic',       description: 'A relic for your run.' },
  { day: 6, type: 'card', amount: 1,   icon: 'icon_card',    label: 'Bonus Card',         description: 'Adds to your card pool.' },
  { day: 7, type: 'gold', amount: 200, icon: 'icon_gold',    label: '200 Gold',           description: "The week's prize." },
] as const

/** Returns the current login calendar day (1-7) for a player save. */
export function getLoginCalendarDay(s: PlayerSave): number {
  return s.loginCalendarDay ?? 1
}

/** Returns whether today's login reward has already been claimed. */
export function isTodayClaimed(s: PlayerSave): boolean {
  if (!s.loginCalendarLastClaimed) return false
  const lastDate = new Date(s.loginCalendarLastClaimed)
  const today = new Date()
  return (
    lastDate.getFullYear() === today.getFullYear() &&
    lastDate.getMonth()    === today.getMonth() &&
    lastDate.getDate()     === today.getDate()
  )
}

/**
 * Claims today's login reward and advances the calendar.
 * Returns the reward that was claimed.
 * Caller is responsible for applying the reward to the PlayerSave and calling save().
 */
export function claimLoginReward(s: PlayerSave): (typeof LOGIN_CALENDAR_REWARDS)[number] {
  const day = getLoginCalendarDay(s)
  const reward = LOGIN_CALENDAR_REWARDS.find(r => r.day === day)!

  // Advance to next day; wrap from 7 back to 1
  const nextDay = day >= 7 ? 1 : day + 1

  s.loginCalendarDay = nextDay
  s.loginCalendarLastClaimed = Date.now()

  return reward
}

/** Returns number of days since last login, or 0 if same day. */
export function daysSinceLastLogin(s: PlayerSave): number {
  if (!s.lastLoginDate) return 0
  const last = new Date(s.lastLoginDate)
  const now = new Date()
  const diffMs = now.getTime() - last.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/** Updates lastLoginDate to now. Call once per session. */
export function recordLogin(s: PlayerSave): void {
  s.lastLoginDate = Date.now()
}
