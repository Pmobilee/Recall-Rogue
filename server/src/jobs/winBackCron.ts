// Re-export helpers so they can be used by the production implementation when wired up.
export { getWinBackAction } from '../services/winBackService.js'
export { buildGaiaLetterEmail, sendEmail } from '../services/emailService.js'

/**
 * Win-back cron job — runs daily, checks for churned players and sends appropriate outreach.
 * DD-V2-159: Respects auto-stop rules. DD-V2-160: Tiered win-back approach.
 */
export async function runWinBackCron(): Promise<{ processed: number; emailsSent: number }> {
  // In production: query database for players with lastActiveAt older than 3 days
  // For now: stub implementation
  console.log('[WinBackCron] Running daily win-back check...')

  const processed = 0
  const emailsSent = 0

  // Stub: would iterate over churned players
  // const churnedPlayers = await db.query('SELECT * FROM players WHERE last_active_at < NOW() - INTERVAL 3 DAY')
  // for (const player of churnedPlayers) {
  //   const daysSince = Math.floor((Date.now() - new Date(player.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24))
  //   const action = getWinBackAction(daysSince)
  //   if (action && action.channel === 'email') {
  //     const email = buildGaiaLetterEmail(player.name, daysSince, player.factsCount, 'a few new leaves')
  //     email.to = player.email
  //     await sendEmail(email)
  //     emailsSent++
  //   }
  //   processed++
  // }

  console.log(`[WinBackCron] Processed ${processed} players, sent ${emailsSent} emails`)
  return { processed, emailsSent }
}

/**
 * Content cadence report — tracks seasonal content health
 */
export function generateContentCadenceReport(): {
  activeSeason: string | null
  factsByTag: Record<string, number>
  upcomingSeasons: string[]
} {
  return {
    activeSeason: null,
    factsByTag: {},
    upcomingSeasons: []
  }
}
