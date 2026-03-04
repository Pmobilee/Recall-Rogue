/** Notification types */
export type NotificationType = 'daily_reminder' | 'streak_alert' | 'season_start' | 'season_ending' | 'weekly_digest' | 'win_back'

export interface ScheduledNotification {
  id: string
  playerId: string
  type: NotificationType
  title: string
  body: string
  scheduledFor: string  // ISO 8601
  sent: boolean
  sentAt?: string
}

/** GAIA-voiced notification templates (DD-V2-159) */
const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; bodies: string[] }> = {
  daily_reminder: {
    title: 'GAIA misses you',
    bodies: [
      'The minerals are restless. Come see what the earth has uncovered.',
      'I catalogued three new specimens while you were away. Want to see?',
      'The Knowledge Tree grew a new branch overnight. Your doing, technically.'
    ]
  },
  streak_alert: {
    title: 'Your streak is glowing',
    bodies: [
      'Day {streak}. The tree remembers every one.',
      '{streak} days of discovery. Not that I\'m counting. (I am counting.)',
      'Your streak hit {streak}. The dome lights up a little brighter.'
    ]
  },
  season_start: {
    title: 'New season: {seasonName}',
    bodies: [
      '{tagline} New facts, new rewards, new mysteries await.',
      'The earth has shifted. {seasonName} has begun — I detect unusual mineral signatures.'
    ]
  },
  season_ending: {
    title: '{seasonName} ends soon',
    bodies: [
      'Only {daysLeft} days remain. The seasonal minerals are fading.',
      'The {seasonName} event closes in {daysLeft} days. Have you claimed your rewards?'
    ]
  },
  weekly_digest: {
    title: 'Your weekly discovery report',
    bodies: [
      'This week: {factsLearned} facts mastered, {mineralsCollected} minerals collected. GAIA approves.',
      '{factsLearned} new facts entered the tree this week. {reviewsDue} reviews await.'
    ]
  },
  win_back: {
    title: 'The dome is quiet without you',
    bodies: [
      'It\'s been {daysSince} days. The Knowledge Tree still grows from your earlier discoveries.',
      'GAIA here. Your tree has {factsCount} facts now. Come see what grew while you were away.'
    ]
  }
}

/**
 * Get a random GAIA-voiced notification body for a given type
 */
export function getNotificationBody(type: NotificationType, vars: Record<string, string | number> = {}): { title: string; body: string } {
  const template = NOTIFICATION_TEMPLATES[type]
  const bodies = template.bodies
  const rawBody = bodies[Math.floor(Math.random() * bodies.length)]
  const rawTitle = template.title

  let body = rawBody
  let title = rawTitle
  for (const [key, value] of Object.entries(vars)) {
    body = body.replace(`{${key}}`, String(value))
    title = title.replace(`{${key}}`, String(value))
  }
  return { title, body }
}

/**
 * Check if a player should receive a notification (DD-V2-159: auto-stop after 7 days silence)
 */
export function shouldSendNotification(lastActiveAt: string, consecutiveSilentDays: number): boolean {
  if (consecutiveSilentDays >= 7) return false  // Auto-stop after 7 days of no app opens
  const daysSinceActive = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24))
  return daysSinceActive >= 1  // Only send if player hasn't been active today
}

/**
 * Schedule a notification for a player
 */
export function createScheduledNotification(
  playerId: string,
  type: NotificationType,
  vars: Record<string, string | number> = {},
  scheduledFor?: Date
): ScheduledNotification {
  const { title, body } = getNotificationBody(type, vars)
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playerId,
    type,
    title,
    body,
    scheduledFor: (scheduledFor ?? new Date()).toISOString(),
    sent: false
  }
}
