/**
 * Generates unique 6-character classroom join codes.
 * Characters are chosen to avoid ambiguous glyphs (I, O, 0, 1).
 */

/** Safe character set for join codes: uppercase letters and digits, excluding I, O, 0, 1. */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generate a unique 6-character classroom join code.
 * Uses rejection-sampling to guarantee uniqueness against the provided set.
 * Collision probability at 1,000 active classes: ~0.003% — acceptable.
 *
 * @param existingCodes - Set of codes currently in use (fetched from DB before calling).
 * @returns A 6-character alphanumeric code guaranteed to not be in existingCodes.
 * @throws If a unique code cannot be generated after 1000 attempts.
 */
export function generateJoinCode(existingCodes: Set<string>): string {
  let code: string
  let attempts = 0
  do {
    code = Array.from({ length: 6 }, () =>
      CHARSET[Math.floor(Math.random() * CHARSET.length)],
    ).join('')
    attempts++
    if (attempts > 1000) {
      throw new Error('Unable to generate unique join code — too many classes in system')
    }
  } while (existingCodes.has(code))
  return code
}
