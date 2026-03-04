/**
 * @file badgeService.ts
 * Client-side badge service. Fetches earned badges and triggers
 * sharing via the share card pipeline.
 */

export interface BadgeDefinition {
  id: string
  label: string
  description: string
  iconSvgPath: string  // Path within the badge SVG template
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id:          'century_scholar',
    label:       'Century Scholar',
    description: '100 facts mastered',
    iconSvgPath: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  },
  {
    id:          'deep_diver',
    label:       'Deep Diver',
    description: 'Reached Layer 15',
    iconSvgPath: 'M20 14l-8 8-8-8 1.4-1.4L11 17.2V4h2v13.2l5.6-5.6L20 14z',
  },
  {
    id:          'streak_legend',
    label:       'Streak Legend',
    description: '30-day login streak',
    iconSvgPath: 'M13 2.05V4.05C17.39 4.59 20.5 8.58 19.96 13C19.5 16.61 16.64 19.5 13 19.93V21.93C18.5 21.38 22.5 16.5 21.95 11C21.5 6.25 17.73 2.5 13 2.05Z',
  },
  {
    id:          'guild_champion',
    label:       'Guild Champion',
    description: 'Guild completed 3 challenges',
    iconSvgPath: 'M12 1L15.39 8.28L23 9.27L17.5 14.64L18.78 22.27L12 18.77L5.22 22.27L6.5 14.64L1 9.27L8.61 8.28L12 1Z',
  },
  {
    id:          'pioneer',
    label:       'Pioneer',
    description: 'Early Supporter',
    iconSvgPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z',
  },
]

export interface EarnedBadge {
  id:       string
  earnedAt: string  // ISO timestamp
}

/** Fetch earned badges from the server for the current player. */
export async function fetchEarnedBadges(): Promise<EarnedBadge[]> {
  try {
    const res = await fetch('/api/badges/me', { credentials: 'include' })
    if (!res.ok) return []
    const data = await res.json() as { badges: EarnedBadge[] }
    return data.badges ?? []
  } catch {
    return []
  }
}

/**
 * Evaluate which new badges the player has earned based on their current save.
 * Returns an array of badge IDs that are newly earned (not yet in earnedBadges).
 *
 * @param save - Relevant fields from PlayerSave for badge evaluation.
 * @param alreadyEarned - Set of badge IDs already earned by this player.
 * @returns Array of newly earned badge IDs.
 */
export function evaluateNewBadges(
  save: {
    reviewStates?: Record<string, { interval: number }> | Array<{ interval: number }>
    deepestLayer?: number
    loginStreak?: number
    guildChampionWins?: number
    isPioneer?: boolean
  },
  alreadyEarned: Set<string>,
): string[] {
  const newBadges: string[] = []

  let masteredCount = 0
  if (save.reviewStates) {
    const states = Array.isArray(save.reviewStates)
      ? save.reviewStates
      : Object.values(save.reviewStates)
    masteredCount = states.filter(r => r.interval >= 60).length
  }

  if (masteredCount >= 100 && !alreadyEarned.has('century_scholar')) {
    newBadges.push('century_scholar')
  }
  if ((save.deepestLayer ?? 0) >= 15 && !alreadyEarned.has('deep_diver')) {
    newBadges.push('deep_diver')
  }
  if ((save.loginStreak ?? 0) >= 30 && !alreadyEarned.has('streak_legend')) {
    newBadges.push('streak_legend')
  }
  if ((save.guildChampionWins ?? 0) >= 3 && !alreadyEarned.has('guild_champion')) {
    newBadges.push('guild_champion')
  }
  if (save.isPioneer && !alreadyEarned.has('pioneer')) {
    newBadges.push('pioneer')
  }

  return newBadges
}

/**
 * Return the public badge page URL for sharing.
 * This URL serves a meta-tag-enriched HTML page that unfurls in social media.
 *
 * @param playerId - The player's UUID.
 * @param badgeId - The badge identifier.
 * @returns Full URL string for the badge page.
 */
export function getBadgeShareUrl(playerId: string, badgeId: string): string {
  return `https://terragacha.com/badge/${encodeURIComponent(playerId)}/${encodeURIComponent(badgeId)}`
}
