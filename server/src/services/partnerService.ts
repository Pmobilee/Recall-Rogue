/**
 * Partner organization service.
 * Handles institution verification logic and license tier management.
 * DD-V2-200: Educational partnerships for institutional API access.
 */
import { factsDb } from '../db/facts-db.js'

export interface PartnerOrg {
  id: string
  name: string
  domain: string
  orgType: 'k12' | 'university' | 'nonprofit' | 'edtech' | string
  contactEmail: string
  contactName: string
  licenseTier: 'pending' | 'institutional' | 'enterprise'
  apiKeyId: string | null
  contentConfig: PartnerContentConfig
  verified: boolean
  createdAt: number
  updatedAt: number
}

export interface PartnerContentConfig {
  ageRating?: 'child' | 'teen' | 'adult'
  categories?: string[]
  maxDifficulty?: number
}

/** Raw DB row shape for partner_orgs table. */
interface PartnerOrgRow {
  id: string
  name: string
  domain: string
  org_type: string
  contact_email: string
  contact_name: string
  license_tier: string
  api_key_id: string | null
  content_config: string
  verified: number
  created_at: number
  updated_at: number
}

/** Map snake_case DB row to camelCase PartnerOrg interface. */
function rowToPartnerOrg(row: PartnerOrgRow): PartnerOrg {
  let contentConfig: PartnerContentConfig = {}
  try {
    contentConfig = JSON.parse(row.content_config) as PartnerContentConfig
  } catch {
    // Malformed JSON — use empty config
  }
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    orgType: row.org_type,
    contactEmail: row.contact_email,
    contactName: row.contact_name,
    licenseTier: row.license_tier as PartnerOrg['licenseTier'],
    apiKeyId: row.api_key_id,
    contentConfig,
    verified: row.verified === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Get a partner organization by ID.
 *
 * @param partnerId - The UUID of the partner organization.
 * @returns The PartnerOrg record, or null if not found.
 */
export function getPartnerOrg(partnerId: string): PartnerOrg | null {
  const row = factsDb.prepare(
    'SELECT * FROM partner_orgs WHERE id = ?'
  ).get(partnerId) as PartnerOrgRow | undefined
  return row ? rowToPartnerOrg(row) : null
}

/**
 * Update the content configuration for a partner organization.
 *
 * @param partnerId    - The UUID of the partner organization.
 * @param contentConfig - The new content configuration to apply.
 */
export function updateContentConfig(
  partnerId: string,
  contentConfig: PartnerContentConfig
): void {
  factsDb.prepare(
    'UPDATE partner_orgs SET content_config = ?, updated_at = ? WHERE id = ?'
  ).run(JSON.stringify(contentConfig), Date.now(), partnerId)
}

/**
 * Validate that an email domain matches an organization's registered domain.
 * Used for basic institutional email verification.
 *
 * @param email  - The email address to validate.
 * @param domain - The expected domain.
 * @returns True if the email's domain matches.
 */
export function emailMatchesDomain(email: string, domain: string): boolean {
  const emailDomain = email.split('@')[1]?.toLowerCase()
  return emailDomain === domain.toLowerCase()
}
