/** Season information from server */
export interface ActiveSeason {
  id: string
  name: string
  tagline: string
  startDate: string
  endDate: string
  theme: {
    bannerColor: string
    accentColor: string
    gaiaOutfit: string
    domeDecoration: string
  }
  factTags: string[]
  biomeOverride?: {
    layers: number[]
    biomeId: string
    probability: number
  }
  rewards: SeasonReward[]
}

export interface SeasonReward {
  id: string
  type: 'cosmetic' | 'companion_fragment' | 'mineral_bonus' | 'title'
  name: string
  milestone: string
  description: string
  requiredCount: number
}

export interface SeasonProgress {
  seasonId: string
  factsDiscovered: number
  rewardsClaimed: string[]
}

class SeasonService {
  private activeSeason: ActiveSeason | null = null
  private progress: SeasonProgress | null = null
  private lastCheck: number = 0
  private readonly CHECK_INTERVAL = 1000 * 60 * 60  // 1 hour

  /** Fetch the currently active season from server */
  async fetchActiveSeason(): Promise<ActiveSeason | null> {
    const now = Date.now()
    if (this.activeSeason && now - this.lastCheck < this.CHECK_INTERVAL) {
      return this.activeSeason
    }

    try {
      const res = await fetch('/api/seasons/active')
      if (!res.ok) return null
      const data = await res.json()
      this.activeSeason = data.season
      this.lastCheck = now
      return this.activeSeason
    } catch {
      // Offline — use cached
      return this.activeSeason
    }
  }

  /** Get current season (cached) */
  getActiveSeason(): ActiveSeason | null {
    return this.activeSeason
  }

  /** Check if a season is currently active */
  isSeasonActive(): boolean {
    if (!this.activeSeason) return false
    const now = new Date().toISOString()
    return this.activeSeason.startDate <= now && this.activeSeason.endDate >= now
  }

  /** Get days remaining in current season */
  getDaysRemaining(): number {
    if (!this.activeSeason) return 0
    const endDate = new Date(this.activeSeason.endDate)
    const now = Date.now()
    return Math.max(0, Math.ceil((endDate.getTime() - now) / (1000 * 60 * 60 * 24)))
  }

  /** Track seasonal fact discovery */
  trackSeasonalFact(factId: string): void {
    if (!this.activeSeason) return
    if (!this.progress) {
      this.progress = {
        seasonId: this.activeSeason.id,
        factsDiscovered: 0,
        rewardsClaimed: []
      }
    }
    this.progress.factsDiscovered++
    // Check for milestone rewards
    this.checkRewardMilestones()
  }

  /** Check if any reward milestones have been reached */
  private checkRewardMilestones(): void {
    if (!this.activeSeason || !this.progress) return
    for (const reward of this.activeSeason.rewards) {
      if (
        this.progress.factsDiscovered >= reward.requiredCount &&
        !this.progress.rewardsClaimed.includes(reward.id)
      ) {
        // Reward earned but not yet claimed — emit event
        window.dispatchEvent(new CustomEvent('season:reward-earned', {
          detail: { reward, season: this.activeSeason }
        }))
      }
    }
  }

  /** Claim a seasonal reward */
  async claimReward(rewardId: string): Promise<boolean> {
    if (!this.activeSeason || !this.progress) return false
    try {
      const res = await fetch(`/api/seasons/${this.activeSeason.id}/claim-reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId })
      })
      if (res.ok) {
        this.progress.rewardsClaimed.push(rewardId)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /** Get season progress */
  getProgress(): SeasonProgress | null {
    return this.progress
  }

  /** Get biome override for current season */
  getBiomeOverride(): ActiveSeason['biomeOverride'] | undefined {
    return this.activeSeason?.biomeOverride
  }
}

export const seasonService = new SeasonService()
