/**
 * Fact of the Day route.
 * Returns a deterministic daily fact from a curated pool.
 * Public endpoint — no authentication required.
 */

import type { FastifyInstance } from 'fastify'

/** Curated fact pool for daily rotation. */
const FACTS_OF_DAY = [
  { factId: 'nsci-001', statement: "Water covers about 71% of the Earth's surface.", category: 'Natural Sciences', explanation: "Most of Earth's surface water is in the oceans.", gaiaComment: 'I remember when there was more land. Times change.' },
  { factId: 'hist-001', statement: 'The Great Wall of China is over 13,000 miles long.', category: 'History', explanation: 'Built over many centuries to protect against invasions.', gaiaComment: "They built it to keep things out. You dig to find what's within." },
  { factId: 'geo-001', statement: 'Mount Everest is the tallest mountain above sea level.', category: 'Geography', explanation: 'At 8,849 meters, it was first summited in 1953.', gaiaComment: 'Impressive height. But you dig deeper than they ever climbed.' },
  { factId: 'nsci-002', statement: 'The human body contains about 206 bones.', category: 'Natural Sciences', explanation: 'Babies are born with around 270 bones that fuse over time.', gaiaComment: 'Even your bones tell a story of growth. Everything changes.' },
  { factId: 'hist-002', statement: 'The first Olympic Games were held in 776 BC in Olympia, Greece.', category: 'History', explanation: 'Athletes competed in a single event: a footrace called the stadion.', gaiaComment: 'Humans always loved a challenge. Mining is just another race.' },
  { factId: 'geo-002', statement: 'The Sahara Desert is roughly the same size as the United States.', category: 'Geography', explanation: 'It covers about 9.2 million square kilometers across North Africa.', gaiaComment: 'Sand above, treasures below. Every grain hides a secret.' },
  { factId: 'nsci-003', statement: 'Light travels at approximately 299,792 km per second.', category: 'Natural Sciences', explanation: 'Nothing with mass can reach or exceed the speed of light.', gaiaComment: 'Fast, but knowledge travels even faster once it takes root.' },
]

/**
 * Register the /api/v1/fact-of-day GET route.
 *
 * @param app - Fastify instance.
 */
export async function factOfDayRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/fact-of-day', async (_request, reply) => {
    const today = new Date().toISOString().slice(0, 10)
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
    const fact = FACTS_OF_DAY[dayIndex % FACTS_OF_DAY.length]!
    return reply.send({ ...fact, date: today })
  })
}
