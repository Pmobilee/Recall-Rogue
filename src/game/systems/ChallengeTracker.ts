import type { PlayerSave } from '../../data/types'

export type ChallengeStatKey =
  | 'blocksMinedThisWeek'
  | 'factsLearnedThisWeek'
  | 'fossilsFoundThisWeek'
  | 'deepestLayerThisWeek'
  | 'artifactsFoundThisWeek'
  | 'studySessionsThisWeek'
  | 'diveCompletionsThisWeek'
  | 'quizCorrectThisWeek'
  | 'mineralsCollectedThisWeek'
  | 'dataDiscsFoundThisWeek'

/**
 * Tracks weekly challenge progress. Resets stats every Monday.
 * Progress is stored in PlayerSave.weeklyChallenge to persist between sessions.
 */
export class ChallengeTracker {
  constructor(private getSave: () => PlayerSave, private persistSave: () => void) {}

  private get stats(): Record<ChallengeStatKey, number> {
    const s = this.getSave()
    if (!s.weeklyChallenge) {
      s.weeklyChallenge = this.freshStats()
    }
    this.maybeReset(s)
    return s.weeklyChallenge.stats as Record<ChallengeStatKey, number>
  }

  private freshStats(): { weekStartIso: string; stats: Record<string, number> } {
    return {
      weekStartIso: this.currentWeekStartIso(),
      stats: {
        blocksMinedThisWeek: 0,
        factsLearnedThisWeek: 0,
        fossilsFoundThisWeek: 0,
        deepestLayerThisWeek: 0,
        artifactsFoundThisWeek: 0,
        studySessionsThisWeek: 0,
        diveCompletionsThisWeek: 0,
        quizCorrectThisWeek: 0,
        mineralsCollectedThisWeek: 0,
        dataDiscsFoundThisWeek: 0,
      },
    }
  }

  private currentWeekStartIso(): string {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    return monday.toISOString().slice(0, 10) // YYYY-MM-DD
  }

  private maybeReset(s: PlayerSave): void {
    const current = this.currentWeekStartIso()
    if (!s.weeklyChallenge || s.weeklyChallenge.weekStartIso !== current) {
      s.weeklyChallenge = this.freshStats()
      this.persistSave()
    }
  }

  /** Increment a tracking stat by the given amount. */
  increment(key: ChallengeStatKey, by = 1): void {
    const s = this.getSave()
    this.maybeReset(s)
    const stats = s.weeklyChallenge!.stats as Record<string, number>
    stats[key] = (stats[key] ?? 0) + by
    this.persistSave()
  }

  /** Set a tracking stat to the maximum of its current value and the given value. */
  updateMax(key: ChallengeStatKey, value: number): void {
    const s = this.getSave()
    this.maybeReset(s)
    const stats = s.weeklyChallenge!.stats as Record<string, number>
    stats[key] = Math.max(stats[key] ?? 0, value)
    this.persistSave()
  }

  /** Get the current progress for a tracking key. */
  getProgress(key: ChallengeStatKey): number {
    return this.stats[key] ?? 0
  }

  // Convenience methods called from GameManager:
  /** Record a block being mined. */
  recordBlockMined(): void { this.increment('blocksMinedThisWeek') }
  /** Record a new fact being learned. */
  recordFactLearned(): void { this.increment('factsLearnedThisWeek') }
  /** Record a fossil being found. */
  recordFossilFound(): void { this.increment('fossilsFoundThisWeek') }
  /** Record an artifact being found. */
  recordArtifactFound(): void { this.increment('artifactsFoundThisWeek') }
  /** Record a study session completion. */
  recordStudySession(): void { this.increment('studySessionsThisWeek') }
  /** Record a run completion. */
  recordRunComplete(): void { this.increment('diveCompletionsThisWeek') }
  /** Record a correct quiz answer. */
  recordQuizCorrect(): void { this.increment('quizCorrectThisWeek') }
  /** Record minerals collected. */
  recordMineralsCollected(n: number): void { this.increment('mineralsCollectedThisWeek', n) }
  /** Record a data disc found. */
  recordDataDiscFound(): void { this.increment('dataDiscsFoundThisWeek') }
  /** Record the deepest layer reached this week. */
  recordDeepestLayer(layer: number): void { this.updateMax('deepestLayerThisWeek', layer) }
}
