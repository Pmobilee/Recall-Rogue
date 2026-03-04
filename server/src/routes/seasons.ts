import { FastifyInstance } from 'fastify'

/** Season configuration */
export interface SeasonConfig {
  id: string
  name: string
  tagline: string
  startDate: string  // ISO 8601
  endDate: string    // ISO 8601
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

// Hardcoded seasons for V1 (server-served in future)
const SEASONS: SeasonConfig[] = [
  {
    id: 'fossil-awakening-2026',
    name: 'Fossil Awakening',
    tagline: 'What sleeps beneath awakens.',
    startDate: '2026-03-15T00:00:00Z',
    endDate: '2026-04-12T23:59:59Z',
    theme: { bannerColor: '#8B4513', accentColor: '#D4AF37', gaiaOutfit: 'paleontologist', domeDecoration: 'fossil_wall_mural' },
    factTags: ['paleontology', 'fossils', 'geology'],
    biomeOverride: { layers: [10, 11, 12], biomeId: 'fossil-bed', probability: 0.5 },
    rewards: [
      { id: 'sr_fossil_frame', type: 'cosmetic', name: 'Amber Frame', milestone: 'discover_10_seasonal_facts', description: 'A dome decoration forged from ancient amber.', requiredCount: 10 },
      { id: 'sr_fossil_title', type: 'title', name: 'Paleontologist', milestone: 'discover_30_seasonal_facts', description: 'Earned by discovering 30 fossil facts.', requiredCount: 30 },
      { id: 'sr_fossil_companion', type: 'companion_fragment', name: 'Trilobite Fragment', milestone: 'discover_50_seasonal_facts', description: 'Collect 3 fragments to revive an ancient trilobite companion.', requiredCount: 50 }
    ]
  },
  {
    id: 'space-month-2026',
    name: 'Space Month',
    tagline: 'Look up. The answers are out there.',
    startDate: '2026-06-15T00:00:00Z',
    endDate: '2026-07-13T23:59:59Z',
    theme: { bannerColor: '#1a1a2e', accentColor: '#e94560', gaiaOutfit: 'astronaut', domeDecoration: 'star_chart' },
    factTags: ['astronomy', 'space', 'physics'],
    biomeOverride: { layers: [16, 17, 18, 19, 20], biomeId: 'void-biome', probability: 0.6 },
    rewards: [
      { id: 'sr_space_wallpaper', type: 'cosmetic', name: 'Nebula Wallpaper', milestone: 'discover_15_seasonal_facts', description: 'A cosmic dome wallpaper.', requiredCount: 15 },
      { id: 'sr_space_title', type: 'title', name: 'Stargazer', milestone: 'discover_40_seasonal_facts', description: 'Earned by discovering 40 space facts.', requiredCount: 40 },
      { id: 'sr_space_bonus', type: 'mineral_bonus', name: 'Cosmic Dust Boost', milestone: 'discover_60_seasonal_facts', description: '2x mineral drops for 24 hours.', requiredCount: 60 }
    ]
  },
  {
    id: 'age-of-dinosaurs-2026',
    name: 'Age of Dinosaurs',
    tagline: 'The past is closer than you think.',
    startDate: '2026-09-15T00:00:00Z',
    endDate: '2026-10-13T23:59:59Z',
    theme: { bannerColor: '#556B2F', accentColor: '#8FBC8F', gaiaOutfit: 'explorer', domeDecoration: 'dino_skeleton' },
    factTags: ['dinosaurs', 'prehistoric-biology', 'extinction'],
    rewards: [
      { id: 'sr_dino_frame', type: 'cosmetic', name: 'Fossil Bone Frame', milestone: 'discover_20_seasonal_facts', description: 'Dome frame made of ancient bones.', requiredCount: 20 },
      { id: 'sr_dino_title', type: 'title', name: 'Mesozoic Scholar', milestone: 'discover_50_seasonal_facts', description: 'Master of prehistoric knowledge.', requiredCount: 50 }
    ]
  },
  {
    id: 'language-festival-2026',
    name: 'Language Festival',
    tagline: 'Every word is a window.',
    startDate: '2026-12-01T00:00:00Z',
    endDate: '2027-01-01T23:59:59Z',
    theme: { bannerColor: '#4B0082', accentColor: '#FFD700', gaiaOutfit: 'linguist', domeDecoration: 'world_flags' },
    factTags: ['language', 'culture', 'linguistics'],
    rewards: [
      { id: 'sr_lang_badge', type: 'cosmetic', name: 'Polyglot Badge', milestone: 'discover_25_seasonal_facts', description: 'Badge earned through linguistic discovery.', requiredCount: 25 },
      { id: 'sr_lang_title', type: 'title', name: 'Linguist', milestone: 'discover_40_seasonal_facts', description: 'Student of many tongues.', requiredCount: 40 }
    ]
  }
]

export async function seasonRoutes(app: FastifyInstance): Promise<void> {
  // GET active season
  app.get('/active', async (_req, reply) => {
    const now = new Date().toISOString()
    const active = SEASONS.find(s => s.startDate <= now && s.endDate >= now) ?? null
    return reply.send({ season: active })
  })

  // GET season by ID
  app.get('/:seasonId', async (req, reply) => {
    const { seasonId } = req.params as { seasonId: string }
    const season = SEASONS.find(s => s.id === seasonId)
    if (!season) return reply.status(404).send({ error: 'Season not found' })
    return reply.send({ season })
  })

  // GET reward progress
  app.get('/:seasonId/rewards', async (req, reply) => {
    const { seasonId } = req.params as { seasonId: string }
    const season = SEASONS.find(s => s.id === seasonId)
    if (!season) return reply.status(404).send({ error: 'Season not found' })
    // In a full implementation, check player's seasonal fact discovery count
    return reply.send({ rewards: season.rewards, playerProgress: {} })
  })

  // POST claim reward
  app.post('/:seasonId/claim-reward', async (req, reply) => {
    const { seasonId } = req.params as { seasonId: string }
    const { rewardId } = req.body as { rewardId: string }
    const season = SEASONS.find(s => s.id === seasonId)
    if (!season) return reply.status(404).send({ error: 'Season not found' })
    const reward = season.rewards.find(r => r.id === rewardId)
    if (!reward) return reply.status(404).send({ error: 'Reward not found' })
    return reply.send({ claimed: true, reward })
  })
}
