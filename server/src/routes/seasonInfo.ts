/**
 * Season Info routes — Phase 56: Social & Live-Ops Foundation.
 * Provides /api/v1/season/current and /api/v1/season/:seasonId/leaderboard.
 */

import { FastifyInstance } from 'fastify'

/** Hardcoded season data for the initial launch period. */
const SEASON_01 = {
  id: 'season-01',
  name: 'Age of Dinosaurs',
  theme: 'The Cretaceous period roars back. Excavate dinosaur-era fossils and master paleontology facts.',
  startDate: '2026-04-01',
  endDate: '2026-05-13',
  boostedCategory: 'Life Sciences',
  boostMultiplier: 1.5,
  cosmeticSetId: 'cosmetic_set_dino',
  leaderboardMetric: 'facts_mastered_in_category',
  isActive: true,
}

/** Mock leaderboard entries. */
const MOCK_LEADERBOARD = [
  { rank: 1, displayName: 'PaleoQueen', score: 142, isCurrentPlayer: false },
  { rank: 2, displayName: 'DinoMaster', score: 128, isCurrentPlayer: false },
  { rank: 3, displayName: 'FossilFinder', score: 115, isCurrentPlayer: false },
  { rank: 4, displayName: 'CretaceousKid', score: 99, isCurrentPlayer: false },
  { rank: 5, displayName: 'You', score: 87, isCurrentPlayer: true },
  { rank: 6, displayName: 'TerraScholar', score: 82, isCurrentPlayer: false },
  { rank: 7, displayName: 'BoneDigger', score: 71, isCurrentPlayer: false },
  { rank: 8, displayName: 'EarthWorm', score: 64, isCurrentPlayer: false },
  { rank: 9, displayName: 'GeoNerd42', score: 55, isCurrentPlayer: false },
  { rank: 10, displayName: 'MineralMaven', score: 48, isCurrentPlayer: false },
]

/**
 * Register season info routes under the /api/v1 prefix.
 * Expected registration: `fastify.register(seasonInfoRoutes, { prefix: '/api/v1' })`
 */
export async function seasonInfoRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/v1/season/current — returns the current active season. */
  app.get('/season/current', async (_req, reply) => {
    return reply.send(SEASON_01)
  })

  /** GET /api/v1/season/:seasonId/leaderboard — returns mock leaderboard. */
  app.get('/season/:seasonId/leaderboard', async (req, reply) => {
    const { seasonId } = req.params as { seasonId: string }
    if (seasonId !== SEASON_01.id && seasonId !== 'current') {
      return reply.status(404).send({ error: 'Season not found' })
    }
    return reply.send({
      seasonId: SEASON_01.id,
      seasonName: SEASON_01.name,
      endDate: SEASON_01.endDate,
      boostedCategory: SEASON_01.boostedCategory,
      entries: MOCK_LEADERBOARD,
    })
  })
}
