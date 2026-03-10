export interface DailyExpeditionAttempt {
  dateKey: string
  seed: number
  playerId: string
  playerName: string
  startedAt: number
  completedAt: number | null
  status: 'reserved' | 'completed'
  score: number
  floorReached: number
  accuracy: number
  bestCombo: number
  runDurationMs: number
}

export interface DailyExpeditionLeaderboardEntry {
  rank: number
  playerId: string
  playerName: string
  score: number
  source: 'bot' | 'player'
}

export interface DailyExpeditionStatus {
  dateKey: string
  seed: number
  canAttempt: boolean
  attempt: DailyExpeditionAttempt | null
  leaderboard: DailyExpeditionLeaderboardEntry[]
  playerRank: number | null
  rewardBand: 'top_10' | 'top_25' | 'top_50' | 'participation' | null
  rewardLabel: string | null
  rewardPreview: string[]
}

interface DailyExpeditionState {
  attempts: Record<string, DailyExpeditionAttempt>
}

interface CompletionMetrics {
  score: number
  floorReached: number
  accuracy: number
  bestCombo: number
  runDurationMs: number
}

const STORAGE_KEY = 'recall-rogue-daily-expedition-v1'
const MAX_LEADERBOARD_ROWS = 20
const REWARD_PREVIEW = [
  'Top 10%: Champion badge + highest bonus',
  'Top 25%: Elite badge + medium bonus',
  'Top 50%: Explorer badge + small bonus',
  'Everyone else: Participation badge',
]

const BOT_NAMES = [
  'Astra', 'Glyph', 'Nova', 'Rune', 'Kestrel', 'Echo', 'Talon', 'Vesper', 'Quill', 'Orion',
  'Lyra', 'Sable', 'Mira', 'Iris', 'Zephyr', 'Coral', 'Rook', 'Sorin', 'Vale', 'Nyx',
  'Piper', 'Thorn', 'Rhea', 'Atlas', 'Juno',
]

function todayKey(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
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

function expeditionSeed(dateKey: string): number {
  return hashString(`daily-expedition:${dateKey}`)
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

function emptyState(): DailyExpeditionState {
  return { attempts: {} }
}

function readState(): DailyExpeditionState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<DailyExpeditionState>
    if (!parsed || typeof parsed !== 'object') return emptyState()
    return {
      attempts: typeof parsed.attempts === 'object' && parsed.attempts !== null
        ? parsed.attempts as Record<string, DailyExpeditionAttempt>
        : {},
    }
  } catch {
    return emptyState()
  }
}

function writeState(state: DailyExpeditionState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore quota/storage failures.
  }
}

function buildBotLeaderboard(seed: number): DailyExpeditionLeaderboardEntry[] {
  const rng = mulberry32(seed)
  const entries: DailyExpeditionLeaderboardEntry[] = []
  for (let index = 0; index < BOT_NAMES.length; index += 1) {
    const depth = 5 + Math.floor(rng() * 20)
    const accuracy = 62 + Math.floor(rng() * 35)
    const combo = 1 + Math.floor(rng() * 7)
    const speedFactor = 0.85 + (rng() * 0.9)
    const score = Math.round(accuracy * speedFactor * depth * combo)
    entries.push({
      rank: index + 1,
      playerId: `bot-${index + 1}`,
      playerName: BOT_NAMES[index],
      score,
      source: 'bot',
    })
  }
  return entries
}

function buildLeaderboard(seed: number, attempt: DailyExpeditionAttempt | null): DailyExpeditionLeaderboardEntry[] {
  const entries = buildBotLeaderboard(seed)
  if (attempt?.status === 'completed') {
    entries.push({
      rank: 0,
      playerId: attempt.playerId,
      playerName: attempt.playerName,
      score: attempt.score,
      source: 'player',
    })
  }

  entries.sort((left, right) => right.score - left.score)
  return entries.slice(0, MAX_LEADERBOARD_ROWS).map((entry, index) => ({ ...entry, rank: index + 1 }))
}

function getRewardBandForRank(rank: number, totalEntries: number): {
  band: 'top_10' | 'top_25' | 'top_50' | 'participation'
  label: string
} {
  const safeTotal = Math.max(1, totalEntries)
  const percentile = rank / safeTotal
  if (percentile <= 0.10) {
    return { band: 'top_10', label: 'Top 10% • Champion bonus' }
  }
  if (percentile <= 0.25) {
    return { band: 'top_25', label: 'Top 25% • Elite bonus' }
  }
  if (percentile <= 0.50) {
    return { band: 'top_50', label: 'Top 50% • Explorer bonus' }
  }
  return { band: 'participation', label: 'Participation badge' }
}

export function getDailyExpeditionStatus(): DailyExpeditionStatus {
  const dateKey = todayKey()
  const seed = expeditionSeed(dateKey)
  const state = readState()
  const attempt = state.attempts[dateKey] ?? null
  const leaderboard = buildLeaderboard(seed, attempt)
  const playerRow = attempt?.status === 'completed'
    ? leaderboard.find((row) => row.playerId === attempt.playerId && row.source === 'player')
    : undefined
  const reward = playerRow ? getRewardBandForRank(playerRow.rank, leaderboard.length) : null
  return {
    dateKey,
    seed,
    canAttempt: attempt === null,
    attempt,
    leaderboard,
    playerRank: playerRow?.rank ?? null,
    rewardBand: reward?.band ?? null,
    rewardLabel: reward?.label ?? null,
    rewardPreview: REWARD_PREVIEW,
  }
}

export function reserveDailyExpeditionAttempt(playerId: string, playerName: string): { ok: true; attempt: DailyExpeditionAttempt } | { ok: false; reason: string } {
  const state = readState()
  const dateKey = todayKey()
  if (state.attempts[dateKey]) {
    return { ok: false, reason: 'already_attempted_today' }
  }

  const attempt: DailyExpeditionAttempt = {
    dateKey,
    seed: expeditionSeed(dateKey),
    playerId,
    playerName: playerName.trim() || 'Rogue',
    startedAt: Date.now(),
    completedAt: null,
    status: 'reserved',
    score: 0,
    floorReached: 0,
    accuracy: 0,
    bestCombo: 0,
    runDurationMs: 0,
  }

  state.attempts[dateKey] = attempt
  writeState(state)
  return { ok: true, attempt }
}

export function completeDailyExpeditionAttempt(metrics: CompletionMetrics): DailyExpeditionAttempt | null {
  const state = readState()
  const dateKey = todayKey()
  const current = state.attempts[dateKey]
  if (!current) return null

  const updated: DailyExpeditionAttempt = {
    ...current,
    status: 'completed',
    completedAt: Date.now(),
    score: Math.max(0, Math.round(metrics.score)),
    floorReached: Math.max(0, Math.round(metrics.floorReached)),
    accuracy: Math.max(0, Math.min(100, Math.round(metrics.accuracy))),
    bestCombo: Math.max(0, Math.round(metrics.bestCombo)),
    runDurationMs: Math.max(0, Math.round(metrics.runDurationMs)),
  }
  state.attempts[dateKey] = updated
  writeState(state)
  return updated
}
