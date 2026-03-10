import { apiClient } from './apiClient'
import type { FactDomain } from '../data/card-types'
import {
  readCachedLeaderboardRows,
  withAbortTimeout,
  writeCachedLeaderboardRows,
} from './leaderboardFetch'

export interface ScholarChallengeAttempt {
  weekKey: string
  seed: number
  playerId: string
  playerName: string
  primaryDomain: FactDomain
  secondaryDomain: FactDomain
  startedAt: number
  completedAt: number | null
  status: 'reserved' | 'completed'
  score: number
  floorReached: number
  accuracy: number
  bestCombo: number
  runDurationMs: number
}

export interface ScholarChallengeLeaderboardEntry {
  rank: number
  playerId: string
  playerName: string
  score: number
  source: 'bot' | 'player'
}

export interface ScholarChallengeStatus {
  weekKey: string
  seed: number
  primaryDomain: FactDomain
  secondaryDomain: FactDomain
  canAttempt: boolean
  attempt: ScholarChallengeAttempt | null
  leaderboard: ScholarChallengeLeaderboardEntry[]
  playerRank: number | null
}

interface ScholarChallengeState {
  attempts: Record<string, ScholarChallengeAttempt>
}

interface CompletionMetrics {
  score: number
  floorReached: number
  accuracy: number
  bestCombo: number
  runDurationMs: number
}

const STORAGE_KEY = 'recall-rogue-scholar-challenge-v1'
const GLOBAL_CACHE_KEY_PREFIX = 'recall-rogue-scholar-challenge-global-v1'
const MAX_LEADERBOARD_ROWS = 20

const BOT_NAMES = [
  'Archivist-AI', 'Echo Scholar', 'Depth Scribe', 'Gaia Analyst', 'Curio Miner',
  'Atlas Pilot', 'Lore Diver', 'Rune Reader', 'Quiz Sentinel', 'Factkeeper',
]

const DOMAIN_ROTATION: Array<{ primary: FactDomain; secondary: FactDomain }> = [
  { primary: 'history', secondary: 'geography' },
  { primary: 'natural_sciences', secondary: 'space_astronomy' },
  { primary: 'animals_wildlife', secondary: 'human_body_health' },
  { primary: 'art_architecture', secondary: 'mythology_folklore' },
  { primary: 'general_knowledge', secondary: 'food_cuisine' },
]

function getMondayUtc(now = new Date()): Date {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = date.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + offset)
  return date
}

function weekKey(now = new Date()): string {
  const monday = getMondayUtc(now)
  const year = monday.getUTCFullYear()
  const month = String(monday.getUTCMonth() + 1).padStart(2, '0')
  const day = String(monday.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function challengeSeed(currentWeekKey: string): number {
  return hashString(`scholar-challenge:${currentWeekKey}`)
}

function challengeDomains(seed: number): { primary: FactDomain; secondary: FactDomain } {
  return DOMAIN_ROTATION[seed % DOMAIN_ROTATION.length]
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let n = Math.imul(t ^ (t >>> 15), 1 | t)
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

function emptyState(): ScholarChallengeState {
  return { attempts: {} }
}

function readState(): ScholarChallengeState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<ScholarChallengeState>
    if (!parsed || typeof parsed !== 'object') return emptyState()
    return {
      attempts: typeof parsed.attempts === 'object' && parsed.attempts !== null
        ? parsed.attempts as Record<string, ScholarChallengeAttempt>
        : {},
    }
  } catch {
    return emptyState()
  }
}

function writeState(state: ScholarChallengeState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore quota/storage failures.
  }
}

function buildBotLeaderboard(seed: number): ScholarChallengeLeaderboardEntry[] {
  const rng = mulberry32(seed)
  const rows: ScholarChallengeLeaderboardEntry[] = []
  for (let index = 0; index < BOT_NAMES.length; index += 1) {
    const depth = 8 + Math.floor(rng() * 16)
    const accuracy = 72 + Math.floor(rng() * 26)
    const combo = 2 + Math.floor(rng() * 8)
    const speedFactor = 0.9 + (rng() * 0.7)
    const score = Math.round(accuracy * speedFactor * depth * combo * 1.1)
    rows.push({
      rank: index + 1,
      playerId: `scholar-bot-${index + 1}`,
      playerName: BOT_NAMES[index],
      score,
      source: 'bot',
    })
  }
  return rows
}

function buildLeaderboard(seed: number, attempt: ScholarChallengeAttempt | null): ScholarChallengeLeaderboardEntry[] {
  const rows = buildBotLeaderboard(seed)
  if (attempt?.status === 'completed') {
    rows.push({
      rank: 0,
      playerId: attempt.playerId,
      playerName: attempt.playerName,
      score: attempt.score,
      source: 'player',
    })
  }

  rows.sort((left, right) => right.score - left.score)
  return rows.slice(0, MAX_LEADERBOARD_ROWS).map((row, index) => ({ ...row, rank: index + 1 }))
}

export function getScholarChallengeStatus(): ScholarChallengeStatus {
  const currentWeekKey = weekKey()
  const seed = challengeSeed(currentWeekKey)
  const domains = challengeDomains(seed)
  const state = readState()
  const attempt = state.attempts[currentWeekKey] ?? null
  const leaderboard = buildLeaderboard(seed, attempt)
  const playerRow = attempt?.status === 'completed'
    ? leaderboard.find((entry) => entry.playerId === attempt.playerId && entry.source === 'player')
    : undefined

  return {
    weekKey: currentWeekKey,
    seed,
    primaryDomain: domains.primary,
    secondaryDomain: domains.secondary,
    canAttempt: attempt === null,
    attempt,
    leaderboard,
    playerRank: playerRow?.rank ?? null,
  }
}

export function reserveScholarChallengeAttempt(
  playerId: string,
  playerName: string,
): { ok: true; attempt: ScholarChallengeAttempt } | { ok: false; reason: string } {
  const currentWeekKey = weekKey()
  const state = readState()
  if (state.attempts[currentWeekKey]) {
    return { ok: false, reason: 'already_attempted_this_week' }
  }

  const seed = challengeSeed(currentWeekKey)
  const domains = challengeDomains(seed)
  const attempt: ScholarChallengeAttempt = {
    weekKey: currentWeekKey,
    seed,
    playerId,
    playerName: playerName.trim() || 'Rogue',
    primaryDomain: domains.primary,
    secondaryDomain: domains.secondary,
    startedAt: Date.now(),
    completedAt: null,
    status: 'reserved',
    score: 0,
    floorReached: 0,
    accuracy: 0,
    bestCombo: 0,
    runDurationMs: 0,
  }

  state.attempts[currentWeekKey] = attempt
  writeState(state)
  return { ok: true, attempt }
}

export function completeScholarChallengeAttempt(metrics: CompletionMetrics): ScholarChallengeAttempt | null {
  const currentWeekKey = weekKey()
  const state = readState()
  const current = state.attempts[currentWeekKey]
  if (!current) return null

  const updated: ScholarChallengeAttempt = {
    ...current,
    status: 'completed',
    completedAt: Date.now(),
    score: Math.max(0, Math.round(metrics.score)),
    floorReached: Math.max(0, Math.round(metrics.floorReached)),
    accuracy: Math.max(0, Math.min(100, Math.round(metrics.accuracy))),
    bestCombo: Math.max(0, Math.round(metrics.bestCombo)),
    runDurationMs: Math.max(0, Math.round(metrics.runDurationMs)),
  }
  state.attempts[currentWeekKey] = updated
  writeState(state)
  return updated
}

export async function getScholarChallengeGlobalLeaderboard(
  currentWeekKey: string,
  limit = 20,
): Promise<ScholarChallengeLeaderboardEntry[] | null> {
  const safeLimit = Math.max(1, Math.floor(limit))
  const cacheKey = `${GLOBAL_CACHE_KEY_PREFIX}:${currentWeekKey}:${safeLimit}`
  try {
    const rows = await withAbortTimeout(
      (signal) => apiClient.getLeaderboard('scholar_challenge', safeLimit, { weekKey: currentWeekKey, signal }),
    )
    const mapped = rows.map((row) => ({
      rank: row.rank,
      playerId: row.userId,
      playerName: row.displayName || 'Rogue',
      score: row.score,
      source: 'player' as const,
    }))
    writeCachedLeaderboardRows(cacheKey, mapped)
    return mapped
  } catch {
    return readCachedLeaderboardRows<ScholarChallengeLeaderboardEntry>(cacheKey)
  }
}
