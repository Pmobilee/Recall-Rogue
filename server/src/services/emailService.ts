/**
 * Email service using Resend REST API for transactional email delivery.
 * Falls back to console.log in development when RESEND_API_KEY is not set.
 * DD-V2-160: Win-back email campaigns.
 */

import { config } from '../config.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESEND_API = 'https://api.resend.com/emails'

/** Email template identifiers */
export type EmailTemplate =
  | 'gaia_letter'
  | 'season_announcement'
  | 'weekly_digest'
  | 'win_back'
  | 'welcome'

export interface EmailPayload {
  to: string
  subject: string
  template: EmailTemplate
  variables: Record<string, string | number>
}

/**
 * Load an HTML template file and interpolate {{variable}} placeholders.
 *
 * @param template - The template identifier.
 * @param variables - Key-value pairs to substitute into the template.
 * @returns Rendered HTML string.
 */
function renderTemplate(
  template: EmailTemplate,
  variables: Record<string, string | number>
): string {
  const name = template.replace(/_/g, '-')
  const filePath = join(__dirname, '..', 'templates', 'email', `${name}.html`)
  let html = readFileSync(filePath, 'utf-8')
  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, String(value))
  }
  return html
}

/**
 * Send a transactional email via Resend REST API.
 * Falls back to console.log in development when RESEND_API_KEY is not set.
 *
 * @param payload - Email content and recipient details.
 * @returns Object with sent status and optional message ID.
 */
export async function sendEmail(
  payload: EmailPayload
): Promise<{ sent: boolean; messageId?: string }> {
  if (!config.resendApiKey) {
    console.log(
      `[EmailService] DEV — would send "${payload.subject}" to ${payload.to}`
    )
    console.log('[EmailService] Variables:', payload.variables)
    return { sent: true, messageId: `dev-${Date.now()}` }
  }

  const unsubscribeUrl = `${config.emailUnsubscribeBaseUrl}?token=PLACEHOLDER_TOKEN`
  const html = renderTemplate(payload.template, {
    ...payload.variables,
    unsubscribeUrl,
  })

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.fromEmail ?? 'GAIA <gaia@terra-gacha.app>',
      to: [payload.to],
      subject: payload.subject,
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { id: string }
  return { sent: true, messageId: data.id }
}

/**
 * Build GAIA Letter email for win-back campaign (DD-V2-160).
 *
 * @param playerName - The player's display name.
 * @param daysSince - Days since the player was last active.
 * @param factsCount - Number of facts the player has learned.
 * @param treeGrowth - Description of passive tree growth (e.g. "a few new leaves").
 * @returns EmailPayload ready to pass to sendEmail.
 */
export function buildGaiaLetterEmail(
  playerName: string,
  daysSince: number,
  factsCount: number,
  treeGrowth: string
): EmailPayload {
  return {
    to: '', // Filled by caller
    subject: `GAIA has a message for you, ${playerName}`,
    template: 'gaia_letter',
    variables: {
      playerName,
      daysSince,
      factsCount,
      treeGrowth,
      gaiaMessage:
        daysSince > 30
          ? `It's been ${daysSince} days. The dome is still here. Your tree still stands at ${factsCount} facts. No pressure — but I've been cataloguing some interesting specimens.`
          : `${daysSince} days since your last dive. The Knowledge Tree added a few leaves on its own — ${treeGrowth}. Come see.`,
    },
  }
}

/**
 * Send a partner welcome email to a newly registered educational institution.
 * Notifies the contact that their application has been received.
 *
 * @param contactEmail - The institution contact's email address.
 * @param orgName      - The institution's registered name.
 * @returns Promise resolving when the email is sent (or logged in dev).
 */
export async function sendPartnerWelcomeEmail(
  contactEmail: string,
  orgName: string
): Promise<void> {
  if (!config.resendApiKey) {
    console.log(
      `[EmailService] DEV — Partner welcome email to ${contactEmail} for "${orgName}"`
    )
    return
  }

  const html = `
    <h2>Terra Gacha Partner Application Received</h2>
    <p>Thank you for registering <strong>${orgName}</strong> as an educational partner.</p>
    <p>Your application is under review. We will contact you within 2 business days.</p>
    <p>Questions? Email <a href="mailto:partners@terragacha.com">partners@terragacha.com</a></p>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.fromEmail ?? 'GAIA <gaia@terra-gacha.app>',
      to: [contactEmail],
      subject: 'Terra Gacha Partner Application Received',
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend error ${res.status}: ${text}`)
  }
}

/**
 * Build season announcement email.
 *
 * @param seasonName - Name of the new season.
 * @param tagline - Short tagline for the season.
 * @param startDate - ISO date string for the season start.
 * @returns EmailPayload ready to pass to sendEmail.
 */
export function buildSeasonAnnouncementEmail(
  seasonName: string,
  tagline: string,
  startDate: string
): EmailPayload {
  return {
    to: '',
    subject: `New Season: ${seasonName}`,
    template: 'season_announcement',
    variables: { seasonName, tagline, startDate },
  }
}
