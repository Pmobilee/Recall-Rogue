/**
 * Email domain validation helper for educator verification requests.
 * Provides heuristic checks for educational domain patterns.
 * These checks are NOT authoritative — manual admin review always follows.
 */

/** Known educational TLD patterns for first-pass heuristic validation. */
const EDUCATIONAL_PATTERNS: RegExp[] = [
  /\.edu$/i,
  /\.edu\./i,       // e.g. .edu.au, .edu.cn
  /\.ac\./i,        // e.g. .ac.uk, .ac.nz
  /\.k12\./i,       // e.g. .k12.ca.us
  /\.school\./i,
  /\.schools\./i,
]

/**
 * Check whether an email domain passes the heuristic educational domain test.
 * This is NOT authoritative — manual review always follows.
 *
 * @param domain - The domain portion of the applicant's email address.
 * @returns True if the domain matches a known educational pattern.
 */
export function looksLikeEducationalDomain(domain: string): boolean {
  return EDUCATIONAL_PATTERNS.some((pattern) => pattern.test(domain))
}

/**
 * Extract the domain from a full email address.
 * Returns null if the email is malformed.
 *
 * @param email - Full email address string.
 * @returns The lowercase domain portion, or null if the email is invalid.
 */
export function extractEmailDomain(email: string): string | null {
  const parts = email.split('@')
  if (parts.length !== 2 || !parts[1] || parts[1].length < 3) return null
  return parts[1].toLowerCase()
}
