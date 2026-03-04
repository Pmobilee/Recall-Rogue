/** Email template types */
export type EmailTemplate = 'gaia_letter' | 'season_announcement' | 'weekly_digest' | 'win_back'

export interface EmailPayload {
  to: string
  subject: string
  template: EmailTemplate
  variables: Record<string, string | number>
}

/**
 * Send an email (stub — in production, integrate with SendGrid/SES/Resend)
 */
export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean; messageId?: string }> {
  // Production: integrate with email provider
  // For now, log the email payload
  console.log(`[EmailService] Would send ${payload.template} to ${payload.to}: ${payload.subject}`)
  return { sent: true, messageId: `msg-${Date.now()}` }
}

/**
 * Build GAIA Letter email for win-back (DD-V2-160)
 */
export function buildGaiaLetterEmail(playerName: string, daysSince: number, factsCount: number, treeGrowth: string): EmailPayload {
  return {
    to: '', // Filled by caller
    subject: `GAIA has a message for you, ${playerName}`,
    template: 'gaia_letter',
    variables: {
      playerName,
      daysSince,
      factsCount,
      treeGrowth,
      gaiaMessage: daysSince > 30
        ? `It's been ${daysSince} days. The dome is still here. Your tree still stands at ${factsCount} facts. No pressure — but I've been cataloguing some interesting specimens.`
        : `${daysSince} days since your last dive. The Knowledge Tree added a few leaves on its own — ${treeGrowth}. Come see.`
    }
  }
}

/**
 * Build season announcement email
 */
export function buildSeasonAnnouncementEmail(seasonName: string, tagline: string, startDate: string): EmailPayload {
  return {
    to: '',
    subject: `New Season: ${seasonName}`,
    template: 'season_announcement',
    variables: { seasonName, tagline, startDate }
  }
}
