import { apiClient } from './apiClient'
import {
  readCachedLeaderboardRows,
  withAbortTimeout,
  writeCachedLeaderboardRows,
} from './leaderboardFetch'

export interface EndlessDepthsEntry {
  rank: number
  playerId: string
  playerName: string
  score: number
  floorReached: number
  source: 'bot' | 'player'
}

interface EndlessDepthsRecord {
  playerId: string
  playerName: string
  score: number
  floorReached: number
  completedAt: number
}

interface EndlessDepthsState {
  records: EndlessDepthsRecord[]
}

const STORAGE_KEY = 'recall-rogue-endless-depths-v1'
const GLOBAL_CACHE_KEY_PREFIX = 'recall-rogue-endless-depths-global-v1'
const MAX_RECORDS = 40

const BOT_BASELINE: Array<{ name: string; floor: number; score: number }> = [
  { name: 'Astra', floor: 28, score: 24400 },
  { name: 'Glyph', floor: 26, score: 22800 },
  { name: 'Nova', floor: 24, score: 21050 },
  { name: 'Rune', floor: 22, score: 19440 },
  { name: 'Kestrel', floor: 20, score: 17620 },
  { name: 'Echo', floor: 19, score: 16800 },
  { name: 'Talon', floor: 18, score: 16020 },
  { name: 'Vesper', floor: 17, score: 15110 },
  { name: 'Quill', floor: 16, score: 14220 },
  { name: 'Orion', floor: 15, score: 13650 },
]

function emptyState(): EndlessDepthsState {
  return { records: [] }
}

function readState(): EndlessDepthsState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<EndlessDepthsState>
    if (!parsed || !Array.isArray(parsed.records)) return emptyState()
    return { records: parsed.records }
  } catch {
    return emptyState()
  }
}

function writeState(state: EndlessDepthsState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures.
  }
}

export function recordEndlessDepthsRun(
  playerId: string,
  playerName: string,
  score: number,
  floorReached: number,
): void {
  const state = readState()
  state.records.push({
    playerId,
    playerName: playerName.trim() || 'Rogue',
    score: Math.max(0, Math.round(score)),
    floorReached: Math.max(0, Math.round(floorReached)),
    completedAt: Date.now(),
  })
  state.records.sort((left, right) => right.score - left.score)
  state.records = state.records.slice(0, MAX_RECORDS)
  writeState(state)
}

export function getEndlessDepthsLeaderboard(limit = 20): EndlessDepthsEntry[] {
  const state = readState()
  const entries: EndlessDepthsEntry[] = [
    ...BOT_BASELINE.map((bot, index) => ({
      rank: index + 1,
      playerId: `bot-${index + 1}`,
      playerName: bot.name,
      score: bot.score,
      floorReached: bot.floor,
      source: 'bot' as const,
    })),
    ...state.records.map((record) => ({
      rank: 0,
      playerId: record.playerId,
      playerName: record.playerName,
      score: record.score,
      floorReached: record.floorReached,
      source: 'player' as const,
    })),
  ]
  entries.sort((left, right) => right.score - left.score)
  return entries.slice(0, Math.max(1, limit)).map((entry, index) => ({ ...entry, rank: index + 1 }))
}

export async function getEndlessDepthsGlobalLeaderboard(limit = 20): Promise<EndlessDepthsEntry[] | null> {
  const safeLimit = Math.max(1, Math.floor(limit))
  const cacheKey = `${GLOBAL_CACHE_KEY_PREFIX}:${safeLimit}`
  try {
    const rows = await withAbortTimeout(
      (signal) => apiClient.getLeaderboard('endless_depths', safeLimit, { signal }),
    )
    const mapped = rows.map((row) => {
      const metadata = (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata))
        ? row.metadata as Record<string, unknown>
        : null
      const floorFromMetadata = Number(metadata?.floorReached ?? 0)
      return {
        rank: row.rank,
        playerId: row.userId,
        playerName: row.displayName || 'Rogue',
        score: row.score,
        floorReached: Number.isFinite(floorFromMetadata) ? floorFromMetadata : 0,
        source: 'player' as const,
      }
    })
    writeCachedLeaderboardRows(cacheKey, mapped)
    return mapped
  } catch {
    return readCachedLeaderboardRows<EndlessDepthsEntry>(cacheKey)
  }
}
