/** The four player archetypes detected by Day 7 (DD-V2-172). */
export type PlayerArchetype = 'explorer' | 'scholar' | 'collector' | 'sprinter' | 'undetected'

/** Archetype detection state stored in PlayerSave. */
export interface ArchetypeData {
  /** Current detected archetype (or 'undetected' before Day 7 / insufficient data). */
  detected: PlayerArchetype
  /** Player's manual override (null = no override, use detected). */
  manualOverride: PlayerArchetype | null
  /** Date (ISO YYYY-MM-DD) of last weekly re-evaluation. */
  lastEvaluatedDate: string | null
  /** Day number (count of distinct play dates) when archetype was first determined. */
  detectedOnDay: number | null
}

/** Default archetype data for new players. */
export const DEFAULT_ARCHETYPE_DATA: ArchetypeData = {
  detected: 'undetected',
  manualOverride: null,
  lastEvaluatedDate: null,
  detectedOnDay: null,
}

/** Minimal save shape needed for archetype detection. */
interface SaveForArchetype {
  stats: {
    totalDivesCompleted: number
    bestFloor: number
    totalFactsLearned: number
    currentStreak: number
  }
}

interface ArchetypeMetrics {
  avgDepthScore: number
  studyRatioScore: number
  collectionRateScore: number
  divesPerWeekScore: number
  activeDays: number
}

function computeMetrics(save: SaveForArchetype): ArchetypeMetrics {
  const totalDives = save.stats.totalDivesCompleted
  if (totalDives === 0) {
    return { avgDepthScore: 0, studyRatioScore: 0, collectionRateScore: 0, divesPerWeekScore: 0, activeDays: 0 }
  }

  const avgDepthScore = Math.min(save.stats.bestFloor / 20, 1.0)
  const studyRatioScore = Math.min(save.stats.totalFactsLearned / (totalDives * 3), 1.0)
  const collectionRateScore = Math.min(save.stats.totalFactsLearned / (totalDives * 3), 1.0)
  const weeklyRate = totalDives / Math.max(save.stats.currentStreak, 1) * 7
  const divesPerWeekScore = Math.min(weeklyRate / 14, 1.0)
  const activeDays = Math.min(save.stats.currentStreak, 7)

  return { avgDepthScore, studyRatioScore, collectionRateScore, divesPerWeekScore, activeDays }
}

/**
 * Determines the player's archetype from behavioral metrics.
 * Returns 'undetected' if data is insufficient (< 5 dives, < 4 active days).
 */
export function detectArchetype(save: SaveForArchetype): PlayerArchetype {
  if (save.stats.totalDivesCompleted < 5) return 'undetected'

  const metrics = computeMetrics(save)
  if (metrics.activeDays < 4) return 'undetected'

  const scores: Record<PlayerArchetype, number> = {
    explorer:    metrics.avgDepthScore * 0.5 + (1 - metrics.studyRatioScore) * 0.3 + metrics.divesPerWeekScore * 0.2,
    scholar:     metrics.studyRatioScore * 0.6 + (1 - metrics.avgDepthScore) * 0.2 + metrics.collectionRateScore * 0.2,
    collector:   metrics.collectionRateScore * 0.7 + metrics.avgDepthScore * 0.15 + metrics.studyRatioScore * 0.15,
    sprinter:    metrics.divesPerWeekScore * 0.6 + (1 - metrics.avgDepthScore) * 0.2 + (1 - metrics.studyRatioScore) * 0.2,
    undetected:  0,
  }

  const best = (Object.entries(scores) as [PlayerArchetype, number][])
    .filter(([k]) => k !== 'undetected')
    .sort(([, a], [, b]) => b - a)[0]

  return best[0]
}

/**
 * Evaluates whether archetype detection should run (first detection or weekly re-evaluation).
 */
export function evaluateArchetype(save: SaveForArchetype, currentData: ArchetypeData, todayStr: string): ArchetypeData {
  const data = { ...currentData }

  const shouldEvaluate = !data.lastEvaluatedDate || (() => {
    const last = new Date(data.lastEvaluatedDate!)
    const today = new Date(todayStr)
    return (today.getTime() - last.getTime()) >= 7 * 24 * 60 * 60 * 1000
  })()

  if (!shouldEvaluate) return data

  const detected = detectArchetype(save)
  return {
    ...data,
    detected,
    lastEvaluatedDate: todayStr,
    detectedOnDay: data.detectedOnDay ?? (detected !== 'undetected' ? save.stats.totalDivesCompleted : null),
  }
}

/** Returns the effective archetype (manual override takes precedence). */
export function getEffectiveArchetype(data: ArchetypeData): PlayerArchetype {
  return data.manualOverride ?? data.detected
}

/** Keeper message modifiers per archetype. */
export const ARCHETYPE_KEEPER_EMPHASIS: Record<PlayerArchetype, string> = {
  explorer:    'discovery',
  scholar:     'mastery',
  collector:   'completionist',
  sprinter:    'streak',
  undetected:  'neutral',
}
