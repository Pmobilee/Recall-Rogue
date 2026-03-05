/**
 * Content licensing service.
 * Generates Creative Commons attribution metadata and records license grants.
 * DD-V2-201: CC BY 4.0 for text, CC BY-NC 4.0 for pixel art images.
 */
import * as crypto from 'crypto'
import { factsDb } from '../db/facts-db.js'

export type LicenseType = 'CC_BY_4' | 'CC_BY_NC_4'

export interface CcAttribution {
  licenseType: LicenseType
  licenseUrl: string
  shortName: string
  attributionText: string
  attributionHtml: string
  requiresShareAlike: false
  requiresNonCommercial: boolean
}

const LICENSE_URLS: Record<LicenseType, string> = {
  CC_BY_4:    'https://creativecommons.org/licenses/by/4.0/',
  CC_BY_NC_4: 'https://creativecommons.org/licenses/by-nc/4.0/',
}

/**
 * Generate a CC attribution block for a set of fact IDs.
 * Uses CC BY-NC-4.0 if any fact has pixel art (has_pixel_art = 1).
 *
 * @param factIds - Array of fact IDs to generate attribution for.
 * @returns A CcAttribution object with all license metadata.
 */
export function generateAttribution(factIds: string[]): CcAttribution {
  let hasPixelArt = false
  if (factIds.length > 0) {
    const placeholders = factIds.map(() => '?').join(',')
    const row = factsDb.prepare(
      `SELECT 1 FROM facts WHERE id IN (${placeholders}) AND has_pixel_art = 1 LIMIT 1`
    ).get(...factIds as [string, ...string[]])
    hasPixelArt = !!row
  }

  const licenseType: LicenseType = hasPixelArt ? 'CC_BY_NC_4' : 'CC_BY_4'
  const licenseUrl = LICENSE_URLS[licenseType]
  const year = new Date().getFullYear()
  const shortLicenseName = licenseType === 'CC_BY_4' ? 'CC BY 4.0' : 'CC BY-NC 4.0'
  const attributionText =
    `© ${year} Terra Gacha (terragacha.com). Licensed under ${shortLicenseName}.`

  return {
    licenseType,
    licenseUrl,
    shortName: shortLicenseName,
    attributionText,
    attributionHtml:
      `<span xmlns:dct="http://purl.org/dc/terms/">` +
      `Terra Gacha Facts</span> by ` +
      `<a href="https://terragacha.com">Terra Gacha</a> is licensed under ` +
      `<a href="${licenseUrl}">${shortLicenseName}</a>.`,
    requiresShareAlike: false,
    requiresNonCommercial: licenseType === 'CC_BY_NC_4',
  }
}

/**
 * Record a license grant event (called whenever external API fetches facts).
 *
 * @param keyId   - The API key ID that accessed the facts.
 * @param factIds - Array of fact IDs that were accessed.
 */
export function recordLicenseGrant(keyId: string, factIds: string[]): void {
  if (factIds.length === 0) return
  const attribution = generateAttribution(factIds)
  factsDb.prepare(`
    INSERT INTO license_grants (id, key_id, fact_ids, license_type, granted_at, attribution_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(), keyId, JSON.stringify(factIds),
    attribution.licenseType, Date.now(), attribution.attributionText
  )
}
